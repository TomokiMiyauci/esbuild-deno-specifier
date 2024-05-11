import { info, type Plugin, type Source } from "../deps.ts";
import type { PluginData } from "./types.ts";
import { resolveModuleEntryLike } from "./modules/module.ts";
import { resolveConditions } from "./conditions.ts";
import { Namespace } from "./constants.ts";
import { mediaTypeToLoader } from "./utils.ts";
import { resolve } from "./resolve.ts";

const NAME = "deno";

export function denoPlugin(options?: {
  existDir(url: URL): Promise<boolean>;
  readFile(url: URL): Promise<string | null | undefined>;
}): Plugin {
  return {
    name: NAME,
    setup(build) {
      const sourceCache = new Map<string, Source>();

      build.onResolve({ filter: /.*/, namespace: Namespace.Deno }, (args) => {
        const pluginData = args.pluginData as PluginData;
        const module = pluginData.module;
        const source = pluginData.source;
        const { path: specifier, importer: referrer } = args;
        // console.log(
        //   `⬥ [VERBOSE] Resolving import "${args.path}" from "${args.importer}"`,
        // );
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

          return resolveModuleEntryLike(module, {
            specifier,
            referrer,
            conditions,
            source,
          });
        },
      );

      build.onLoad(
        { filter: /.*/, namespace: Namespace.Deno },
        async (args) => {
          const pluginData = args.pluginData as PluginData;
          const contents = await Deno.readTextFile(args.path);
          const loader = mediaTypeToLoader(pluginData.mediaType);

          return {
            contents,
            loader,
            pluginData: args.pluginData,
            // resolveDir: pluginData.resolveDir,
          };
        },
      );

      build.onLoad({ filter: /.*/, namespace: Namespace.Disabled }, () => {
        return { contents: "" };
      });
    },
  };
}
