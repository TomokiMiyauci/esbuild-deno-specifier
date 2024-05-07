import {
  esmFileFormat,
  type Format,
  fromFileUrl,
  type Loader,
  type MediaType,
  type Module,
  type NpmModule,
  type OnResolveResult,
  type PackageJson,
  type Plugin,
  type Source,
  toFileUrl,
} from "./deps.ts";
import { info } from "./modules/deno/info.ts";
import { isBuiltin } from "node:module";
import {
  loadAsFile,
  npmResolve,
  resolveSideEffects,
} from "./src/modules/npm.ts";
import { formatToMediaType, isObject } from "./src/utils.ts";
import type { PluginData } from "./src/types.ts";
import { existFile, readFile } from "./src/context.ts";
import { resolveBrowser } from "./src/browser.ts";
import { resolveModuleEntryLike } from "./src/modules/module.ts";
import { resolveNodeModule } from "./src/modules/node.ts";
import { resolveAssertedModule } from "./src/modules/asserted.ts";

export function denoPlugin(options?: {
  existDir(url: URL): Promise<boolean>;
  readFile(url: URL): Promise<string | null | undefined>;
}): Plugin {
  return {
    name: "deno",
    setup(build) {
      build.onResolve(
        { filter: /^npm:|^jsr:|^https?:|^data:|^node:/ },
        async (args) => {
          const { path: specifier } = args;
          const source = await info(specifier);
          const normalized = source.redirects[args.path] ?? args.path;
          const module = source.modules.find((module) =>
            module.specifier === normalized
          );

          return resolveModuleEntryLike(module, source);
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
                  return {
                    path: `${args.path}`,
                    namespace: "(disabled)",
                  };
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

            if (isBuiltin(specifier)) {
              return { external: true };
            }

            const npm = pluginData.source.npmPackages[module.npmPackage];

            if (!npm) throw new Error("npm not found");

            const { name, subpath } = parseNpmPkg(specifier);

            if (npm.name === name) {
              const childModule = {
                kind: "npm",
                specifier: `npm:/${npm.name}@${npm.version}${subpath.slice(1)}`,
                npmPackage: module.npmPackage,
              } satisfies NpmModule;

              const result = await npmResolve(childModule, source);

              return npmResultToResolveResult(result, {
                module: childModule,
                source,
                path: args.path,
              });
            }

            const nameWithVersion = npm.dependencies.find((nameWithVersion) => {
              const onlyName = extractName(nameWithVersion);

              return onlyName === name;
            });

            const dep = nameWithVersion &&
              source.npmPackages[nameWithVersion];

            if (dep) {
              const module = {
                kind: "npm",
                specifier: `npm:/${dep.name}@${dep.version}${subpath.slice(1)}`,
                npmPackage: nameWithVersion,
              } satisfies NpmModule;

              const result = await npmResolve(module, source);

              return npmResultToResolveResult(result, {
                source,
                module,
                path: args.path,
              });
            }

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
            const dep = module.dependencies?.find((dep) =>
              dep.specifier === specifier
            );

            if (!dep) throw new Error();
            if ("error" in dep.code) throw new Error(dep.code.error);

            const mod = source.modules.find((module) =>
              module.specifier === dep.code.specifier
            );

            return resolveModuleEntryLike(mod, source);
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

function npmResultToResolveResult(
  result: NpmResult,
  context: { module: Module; source: Source; path: string },
): OnResolveResult {
  const { url, format, pjson, packageURL } = result;

  if (!url) {
    return { path: `${context.path}`, namespace: "(disabled)" };
  }

  const mediaType: MediaType = format ? formatToMediaType(format) : "Unknown";
  const pluginData = {
    source: context.source,
    module: context.module,
    mediaType,
    npm: { pjson, packageURL },
  } satisfies PluginData;

  const path = fromFileUrl(url);
  const sideEffects = resolveSideEffects(
    pjson?.sideEffects,
    fromFileUrl(packageURL),
    path,
  );

  return { path, namespace: "deno", pluginData, sideEffects };
}

interface NpmResult {
  url: URL | null;
  pjson: PackageJson | null;
  format: Format | null;
  packageURL: URL;
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

function parseNpmPkg(specifier: string) {
  const index = specifier.startsWith("@")
    ? secondIndexOf(specifier, "/")
    : specifier.indexOf("/");

  const name = index === -1 ? specifier : specifier.slice(0, index);

  return {
    name,
    subpath: `.${specifier.slice(name.length)}`,
  };
}

function extractName(input: string): string {
  const at = input.startsWith("@")
    ? secondIndexOf(input, "@")
    : input.indexOf("@");
  return at === -1 ? input : input.slice(0, at);
}

function secondIndexOf(input: string, searchString: string): number {
  const firstIndex = input.indexOf(searchString);

  if (firstIndex === -1) return -1;

  return input.indexOf(searchString, firstIndex + 1);
}