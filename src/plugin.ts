import { info, type Plugin, type Source } from "../deps.ts";
import type { PluginData } from "./types.ts";
import { resolveModule } from "./modules/module.ts";
import { resolveConditions } from "./conditions.ts";
import { Namespace } from "./constants.ts";
import { mediaTypeToLoader } from "./utils.ts";
import { resolve, toOnResolveResult } from "./resolve.ts";
import { assertModule, assertModuleEntry } from "./modules/utils.ts";

const NAME = "deno";

export function denoPlugin(): Plugin {
  return {
    name: NAME,
    setup(build) {
      build.onResolve({ filter: /.*/, namespace: Namespace.Deno }, (args) => {
        const pluginData = args.pluginData as PluginData;
        const module = pluginData.module;
        const source = pluginData.source;
        const { path: specifier, importer: referrer } = args;
        console.log(
          `⬥ [VERBOSE] Resolving import "${args.path}" from "${args.importer}"`,
        );
        const conditions = resolveConditions({
          kind: args.kind,
          platform: build.initialOptions.platform,
          conditions: build.initialOptions.conditions,
        });

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
          platform: build.initialOptions.platform,
        });
      });

      const sourceCache = new Map<string, Source>();

      build.onResolve(
        { filter: /^npm:|^jsr:|^https?:|^data:|^node:|^file:/ },
        async ({ path: specifier, kind, importer: referrer }) => {
          const source = sourceCache.has(specifier)
            ? sourceCache.get(specifier)!
            : await info(specifier);

          sourceCache.set(specifier, source);
          const normalized = source.redirects[specifier] ?? specifier;
          const module = source.modules.find((module) =>
            module.specifier === normalized
          );

          const conditions = resolveConditions({
            kind,
            platform: build.initialOptions.platform,
            conditions: build.initialOptions.conditions,
          });

          assertModuleEntry(module, specifier);
          assertModule(module);

          const result = await resolveModule(module, {
            specifier,
            referrer,
            conditions,
            source,
          });

          return toOnResolveResult(result, {
            conditions,
            module,
            source,
            specifier,
          });
        },
      );

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
