import {
  esmFileFormat,
  fromFileUrl,
  info,
  join,
  type Loader,
  type MediaType,
  type Plugin,
  type Source,
  toFileUrl,
} from "../deps.ts";
import { isBuiltin } from "node:module";
import {
  loadAsFile,
  resolveNpmDependency,
  resolveSideEffects,
} from "./modules/npm.ts";
import {
  formatToMediaType,
  isLikePath,
  isObject,
  parseNpmPkg,
} from "./utils.ts";
import type { PluginData } from "./types.ts";
import { existFile, readFile } from "./context.ts";
import { resolveBrowser } from "./browser.ts";
import { resolveModuleEntryLike } from "./modules/module.ts";
import { resolveNodeModule } from "./modules/node.ts";
import { resolveAssertedModule } from "./modules/asserted.ts";
import { resolveDependency } from "./modules/esm.ts";
import { resolveConditions } from "./conditions.ts";

export function denoPlugin(options?: {
  existDir(url: URL): Promise<boolean>;
  readFile(url: URL): Promise<string | null | undefined>;
}): Plugin {
  return {
    name: "deno",
    setup(build) {
      const sourceCache = new Map<string, Source>();

      build.onResolve(
        { filter: /^npm:|^jsr:|^https?:|^data:|^node:/ },
        async ({ path: specifier, kind }) => {
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
            conditions,
          });
        },
      );

      build.onResolve({ filter: /.*/, namespace: "deno" }, async (args) => {
        const pluginData = args.pluginData as PluginData;
        const module = pluginData.module;
        const source = pluginData.source;
        let specifier = args.path;
        console.log(
          `⬥ [VERBOSE] Resolving import "${args.path}" from "${args.importer}"`,
        );
        const conditions = resolveConditions({
          kind: args.kind,
          platform: build.initialOptions.platform,
          conditions: build.initialOptions.conditions,
        });

        switch (module.kind) {
          case "npm": {
            const npmContext = pluginData.npm;

            if (!npmContext) throw new Error();

            const pjson = npmContext.pjson;
            const packageURL = npmContext.packageURL;
            const browser = pjson?.browser;

            if (isObject(browser)) {
              const result = resolveBrowser(specifier, browser);

              if (result) {
                if (result.specifier === null) {
                  const path = isLikePath(specifier)
                    ? fromFileUrl(join(packageURL, specifier))
                    : specifier;

                  return { path, namespace: "(disabled)" };
                } else {
                  specifier = result.specifier;
                }
              }
            }

            if (specifier.startsWith("./") || specifier.startsWith("../")) {
              const base = toFileUrl(args.importer);
              const url = new URL(specifier, base);
              const fileResult = await loadAsFile(url);

              if (fileResult) {
                const format = await esmFileFormat(fileResult, {
                  readFile,
                  existFile,
                });
                const mediaType: MediaType = format
                  ? formatToMediaType(format)
                  : "Unknown";
                const pluginData = {
                  mediaType,
                  module,
                  source,
                  npm: { pjson, packageURL },
                } satisfies PluginData;
                const path = fromFileUrl(fileResult);
                const sideEffects = resolveSideEffects(
                  pjson?.sideEffects,
                  fromFileUrl(packageURL),
                  path,
                );

                return {
                  path,
                  namespace: "deno",
                  pluginData,
                  sideEffects,
                };
              }

              // const dirResult = await loadAsDirectory(url);

              throw new Error("not found");
            }

            if (isBuiltin(specifier)) return { external: true };

            const result = resolveNpmDependency(module, source, {
              specifier,
              conditions,
            });

            if (result) return result;

            const { subpath } = parseNpmPkg(specifier);
            // The case where dependencies cannot be detected is when optional: true in peerDependency.
            // In this case, version resolution is left to the user
            const pkg = `npm:/${specifier}${subpath.slice(1)}`;

            return build.resolve(pkg, {
              importer: args.importer,
              kind: args.kind,
              pluginData: args.pluginData,
              resolveDir: args.resolveDir,
              pluginName: "deno",
            });
          }

          case "esm": {
            const dep = resolveDependency(specifier, module);

            const mod = source.modules.find((module) =>
              module.specifier === dep.code.specifier
            );

            return resolveModuleEntryLike(mod, source, {
              specifier,
              conditions,
            });
          }

          case "node":
            return resolveNodeModule(module);

          case "asserted":
            return resolveAssertedModule(module, source);
        }
      });

      build.onLoad({ filter: /.*/, namespace: "deno" }, async (args) => {
        const pluginData = args.pluginData as PluginData;
        const contents = await Deno.readTextFile(args.path);
        const loader = mediaTypeToLoader(pluginData.mediaType);

        return {
          contents,
          loader,
          pluginData: args.pluginData,
          // resolveDir: pluginData.resolveDir,
        };
      });

      build.onLoad({ filter: /.*/, namespace: "(disabled)" }, () => {
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
