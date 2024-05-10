import {
  info,
  type Loader,
  type MediaType,
  type Plugin,
  type Source,
} from "../deps.ts";
import type { PluginData } from "./types.ts";
import {
  resolveModuleDependency,
  resolveModuleEntryLike,
} from "./modules/module.ts";
import { resolveConditions } from "./conditions.ts";
import { Namespace } from "./constants.ts";

const NAME = "deno";

export function denoPlugin(options?: {
  existDir(url: URL): Promise<boolean>;
  readFile(url: URL): Promise<string | null | undefined>;
}): Plugin {
  return {
    name: NAME,
    setup(build) {
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

          return resolveModuleEntryLike(module, source, {
            specifier,
            referrer,
            conditions,
          });
        },
      );

      build.onResolve({ filter: /.*/, namespace: Namespace.Deno }, (args) => {
        const pluginData = args.pluginData as PluginData;
        const module = pluginData.module;
        const source = pluginData.source;
        const specifier = args.path;
        // console.log(
        //   `⬥ [VERBOSE] Resolving import "${args.path}" from "${args.importer}"`,
        // );
        const conditions = resolveConditions({
          kind: args.kind,
          platform: build.initialOptions.platform,
          conditions: build.initialOptions.conditions,
        });

        return resolveModuleDependency(module, source, {
          conditions,
          specifier,
          referrer: args.importer,
          npm: pluginData.npm,
          platform: build.initialOptions.platform,
          next: (specifier) => {
            return build.resolve(specifier, {
              kind: args.kind,
              importer: args.importer,
              pluginName: NAME,
              resolveDir: args.resolveDir,
            });
          },
        });
      });

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

function mediaTypeToLoader(mediaType: MediaType): Loader {
  switch (mediaType) {
    case "Cjs":
    case "Mjs":
    case "JavaScript":
      return "js";
    case "Mts":
    case "Cts":
    case "Dcts":
    case "Dmts":
    case "Dts":
    case "TypeScript":
      return "ts";
    case "JSX":
      return "jsx";
    case "TSX":
      return "tsx";
    case "Json":
      return "json";
    default:
      return "default";
  }
}
