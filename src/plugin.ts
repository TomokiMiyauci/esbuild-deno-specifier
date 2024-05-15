import {
  ConsoleHandler,
  info,
  type Plugin,
  setup,
  type Source,
} from "../deps.ts";
import type { PluginData } from "./types.ts";
import { resolveModule } from "./modules/module.ts";
import { resolveConditions } from "./conditions.ts";
import { Namespace } from "./constants.ts";
import { logger, mediaTypeToLoader, normalizePlatform } from "./utils.ts";
import { resolve, resolveBrowserMap, toOnResolveResult } from "./resolve.ts";
import { assertModule, assertModuleEntry } from "./modules/utils.ts";
import { resolveMainFields } from "./main_fields.ts";

const NAME = "deno";

export function denoPlugin(): Plugin {
  return {
    name: NAME,
    setup(build) {
      setup({
        handlers: {
          console: new ConsoleHandler("INFO"),
        },
        loggers: {
          "deno": {
            level: "INFO",
            handlers: ["console"],
          },
        },
      });

      const sourceCache = new Map<string, Source>();

      build.onResolve(
        { filter: /^npm:|^jsr:|^https?:|^data:|^node:|^file:/ },
        async ({ path: specifier, kind, importer: referrer }) => {
          logger().info(
            `Resolving import "${specifier}" from "${referrer}"`,
          );

          const source = sourceCache.has(specifier)
            ? sourceCache.get(specifier)!
            : await info(specifier);

          sourceCache.set(specifier, source);
          const normalized = source.redirects[specifier] ?? specifier;
          const module = source.modules.find((module) =>
            module.specifier === normalized
          );

          assertModuleEntry(module, specifier);
          assertModule(module);

          const conditions = resolveConditions({
            kind,
            platform: build.initialOptions.platform,
            conditions: build.initialOptions.conditions,
          });
          const mainFields = resolveMainFields({
            platform: build.initialOptions.platform,
            mainFields: build.initialOptions.mainFields,
          });
          const platform = normalizePlatform(build.initialOptions.platform);

          const result = await resolveModule(module, {
            specifier,
            referrer,
            conditions,
            source,
            mainFields,
            resolve: platform === "browser" ? resolveBrowserMap : undefined,
          });

          return toOnResolveResult(result, {
            conditions,
            module,
            source,
            specifier,
            mainFields,
          });
        },
      );

      build.onResolve({ filter: /.*/, namespace: Namespace.Deno }, (args) => {
        const pluginData = args.pluginData as PluginData;
        const module = pluginData.module;
        const source = pluginData.source;
        const { path: specifier, importer: referrer } = args;
        logger().info(
          `Resolving import "${args.path}" from "${args.importer}"`,
        );
        const conditions = resolveConditions({
          kind: args.kind,
          platform: build.initialOptions.platform,
          conditions: build.initialOptions.conditions,
        });
        const mainFields = resolveMainFields({
          platform: build.initialOptions.platform,
          mainFields: build.initialOptions.mainFields,
        });
        const platform = normalizePlatform(build.initialOptions.platform);

        return resolve(specifier, referrer, {
          conditions,
          module,
          source,
          next: (specifier) => {
            return build.resolve(specifier, {
              kind: args.kind,
              importer: args.importer,
              pluginName: NAME,
              resolveDir: args.resolveDir,
            });
          },
          platform,
          mainFields,
        });
      });

      build.onLoad(
        { filter: /.*/, namespace: Namespace.Deno },
        async (args) => {
          const pluginData = args.pluginData as PluginData;
          const contents = await Deno.readTextFile(args.path);
          const loader = mediaTypeToLoader(pluginData.mediaType);

          return { contents, loader, pluginData: args.pluginData };
        },
      );

      build.onLoad({ filter: /.*/, namespace: Namespace.Disabled }, () => {
        return { contents: "" };
      });
    },
  };
}
