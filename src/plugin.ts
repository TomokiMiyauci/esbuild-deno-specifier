import {
  ConsoleHandler,
  info,
  type Plugin,
  setup,
  type Source,
  toFileUrl,
} from "../deps.ts";
import type { PluginData } from "./types.ts";
import { resolveConditions } from "./conditions.ts";
import { Namespace } from "./constants.ts";
import { logger, mediaTypeToLoader, normalizePlatform } from "./utils.ts";
import { resolve } from "./resolve.ts";
import { resolveMainFields } from "./main_fields.ts";

export function denoPlugin(): Plugin {
  return {
    name: "deno",
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

      const cachedInfo = async (specifier: string): Promise<Source> => {
        const source = sourceCache.has(specifier)
          ? sourceCache.get(specifier)!
          : await info(specifier);

        sourceCache.set(specifier, source);

        return source;
      };

      build.onResolve(
        { filter: /^npm:|^jsr:|^https?:|^data:|^node:|^file:/ },
        ({ path: specifier, kind, importer: referrer }) => {
          logger().info(
            `Resolving import "${specifier}" from "${referrer}"`,
          );

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

          return resolve(specifier, "", {
            conditions,
            info: cachedInfo,
            mainFields,
            platform,
          });
        },
      );

      build.onResolve({ filter: /.*/, namespace: Namespace.Deno }, (args) => {
        logger().info(
          `Resolving import "${args.path}" from "${args.importer}"`,
        );

        const pluginData = args.pluginData as PluginData;
        const { module, source } = pluginData;
        const { path: specifier, importer } = args;
        const referrer = toFileUrl(importer);

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
          platform,
          mainFields,
          info: cachedInfo,
        }, { module, source });
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
