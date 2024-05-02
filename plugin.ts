import { toFileUrl } from "jsr:@std/path@^0.221.0/to-file-url";
import {
  type Loader,
  type MediaType,
  type Module,
  type NpmModule,
  type Plugin,
  type Source,
} from "./deps.ts";
import { exists } from "jsr:@std/fs@^0.221.0";
import { join } from "jsr:@std/url@^0.221.0";
import { info } from "./modules/deno/info.ts";

interface PluginData {
  // mediaType: MediaType;
  // resolveDir: string;
  // url: URL;
  // context: any;
  pjson: PackageJson | null;
  module: Module;
  source: Source;
  mediaType: MediaType;
}

async function readFile(url: URL): Promise<string | null> {
  try {
    return await Deno.readTextFile(url);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return null;
    }

    if (e instanceof Deno.errors.IsADirectory) {
      return null;
    }

    throw e;
  }
}

const cacheForExist = new Map<string, boolean>();

async function existFile(url: URL) {
  const key = url.toString();

  if (cacheForExist.has(key)) {
    // console.log("Cached exist file", key);
    return cacheForExist.get(key)!;
  }

  const result = await exists(url, { isFile: true });

  cacheForExist.set(key, result);

  return result;
}

const cacheForExistDir = new Map<string, boolean>();

async function existDir(url: URL) {
  const key = url.toString();

  if (cacheForExistDir.has(key)) {
    // console.log("Cached exist dir", key);
    return cacheForExistDir.get(key)!;
  }

  const result = await exists(url, { isDirectory: true });

  cacheForExistDir.set(key, result);

  return result;
}

import {
  esmFileFormat,
  type Format,
  packageExportsResolve,
  type PackageJson,
  readPackageJson,
} from "jsr:@miyauci/node-esm-resolver@1.0.0-beta.8";
import { DenoDir, fromFileUrl } from "../deno-module-resolution/deps.ts";
import { isBuiltin } from "node:module";

export function denoPlugin(options?: {
  existDir(url: URL): Promise<boolean>;
  readFile(url: URL): Promise<string | null | undefined>;
}): Plugin {
  return {
    name: "deno",
    setup(build) {
      build.onResolve(
        { filter: /^npm:|^jsr:|^https?:|^data:/ },
        async (args) => {
          const source = await info(args.path);
          const normalized = source.redirects[args.path] ?? args.path;
          const module = source.modules.find((module) =>
            module.specifier === normalized
          );

          if (!module) throw new Error("Cannot find module");
          if ("error" in module) throw new Error(module.error);

          switch (module.kind) {
            case "node": {
              return { external: true, path: module.specifier };
            }

            case "asserted":
            case "esm": {
              const path = module.local;

              if (!path) throw new Error();

              return {
                path,
                namespace: "deno",
                pluginData: {
                  mediaType: module.mediaType,
                },
              };
            }

            case "npm": {
              const { url, pjson, format } = await npmResolve(module, source);
              const sideEffects = typeof pjson?.sideEffects === "boolean"
                ? pjson.sideEffects
                : undefined;

              if (!url) {
                return {
                  path: `${args.path}`,
                  namespace: "(disabled)",
                  sideEffects,
                };
              }

              const mediaType: MediaType = format
                ? formatToMediaType(format)
                : "Unknown";
              const pluginData = {
                pjson,
                module,
                source,
                mediaType,
              } satisfies PluginData;

              return {
                path: fromFileUrl(url),
                namespace: "deno",
                sideEffects,
                pluginData,
              };
            }
          }
        },
      );

      build.onResolve({ filter: /.*/, namespace: "deno" }, async (args) => {
        const pluginData = args.pluginData as PluginData;
        const module = pluginData.module;
        const pjson = pluginData.pjson;
        const source = pluginData.source;
        const specifier = args.path;

        switch (module.kind) {
          case "npm": {
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
                  pjson,
                  source,
                } satisfies PluginData;
                return {
                  path: fromFileUrl(fileResult),
                  namespace: "deno",
                  pluginData,
                };
              }

              throw new Error("not found");
            }

            if (isBuiltin(specifier)) {
              console.log(pjson?.browser, specifier, args.importer);
              return { external: true };
            }

            const npm = pluginData.source.npmPackages[module.npmPackage];

            if (!npm) {
              throw new Error("npm not found");
            }

            const { name, subpath } = parseNpmPkg(specifier);

            if (npm.name === name) {
              const childModule = {
                kind: "npm",
                specifier: `npm:/${npm.name}@${npm.version}${subpath.slice(1)}`,
                npmPackage: module.npmPackage,
              } satisfies NpmModule;

              const { pjson, url, format } = await npmResolve(
                childModule,
                source,
              );

              const mediaType: MediaType = format
                ? formatToMediaType(format)
                : "Unknown";
              const pluginData = {
                source,
                module,
                pjson,
                mediaType,
              } satisfies PluginData;
              const sideEffects = typeof pjson?.sideEffects === "boolean"
                ? pjson.sideEffects
                : undefined;

              if (!url) {
                return {
                  path: `${args.path}`,
                  namespace: "(disabled)",
                  sideEffects,
                };
              }

              return {
                path: fromFileUrl(url),
                namespace: "deno",
                pluginData,
              };
            }

            const depsMap = new Map<string, string>(
              npm.dependencies.map((nameWithVersion) => {
                const name = extractName(nameWithVersion);
                return [name, nameWithVersion];
              }),
            );

            const nameWithVersion = depsMap.get(name);
            const dep = nameWithVersion &&
              source.npmPackages[nameWithVersion];

            if (dep) {
              const module = {
                kind: "npm",
                specifier: `npm:/${dep.name}@${dep.version}${subpath.slice(1)}`,
                npmPackage: nameWithVersion,
              } satisfies NpmModule;
              const { pjson, url, format } = await npmResolve(
                module,
                source,
                // options,
              );

              const mediaType: MediaType = format
                ? formatToMediaType(format)
                : "Unknown";
              const pluginData = {
                source,
                module,
                pjson,
                mediaType,
              } satisfies PluginData;
              const sideEffects = typeof pjson?.sideEffects === "boolean"
                ? pjson.sideEffects
                : undefined;

              if (!url) {
                return {
                  path: `${args.path}`,
                  namespace: "(disabled)",
                  sideEffects,
                };
              }

              return {
                path: fromFileUrl(url),
                namespace: "deno",
                pluginData,
                sideEffects,
              };
            }

            // The case where dependencies cannot be detected is when optional: true in peerDependency.
            // In this case, version resolution is left to the user
            const pkg = `npm:/${specifier}${subpath.slice(1)}`;

            return build.resolve(pkg, {
              importer: args.importer,
              kind: args.kind,
            });
          }

          default: {
            throw new Error("module not supported");
          }
        }

        const browser = pjson?.browser;
        if (pjson && isObject(browser)) {
          const mappedValue = resolveBrowser(specifier, browser);

          if (mappedValue === false) {
            return { path: args.path, namespace: "(disabled)" };
          }

          if (typeof mappedValue === "string") {
            throw new Error("");
          }
        }

        if (isBuiltin(specifier)) {
          throw new Error();
        }

        if (specifier.startsWith("./")) {
          const url = new URL(specifier, toFileUrl(args.importer));

          const fileResult = await loadAsFile(url);
          const pluginData = {
            pjson,
          } satisfies PluginData;

          if (fileResult) {
            return {
              path: fromFileUrl(fileResult),
              namespace: "deno",
              pluginData,
            };
          }

          const s = await loadAsDirectory(url, pluginData.pjson);
          throw new Error("");
        }

        throw new Error();
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

interface NpmResult {
  url: URL | null | undefined;
  pjson: PackageJson | null;
  format: Format | null;
}

async function npmResolve(
  module: NpmModule,
  source: Source,
): Promise<NpmResult> {
  const npm = source.npmPackages[module.npmPackage];

  if (!npm) throw new Error("npm not found");

  const { name, version } = npm;

  const npmSpecifier = `npm:/${name}@${version}`;
  const subpath = module.specifier.slice(npmSpecifier.length);
  const packageSubpath = `.${subpath}` as const;

  const denoDir = new DenoDir().root;
  const packageURL = createPackageURL(denoDir, name, version);

  if (!await existDir(packageURL)) {
    throw new Error();
  }

  const pjson = await readPackageJson(packageURL, { readFile });
  const result = await resolveNodeModules(
    packageURL,
    pjson,
    packageSubpath,
  );
  const format = result && await esmFileFormat(result, { existFile, readFile });

  return {
    url: result,
    pjson,
    format: format ?? null,
  };
}

function resolveBrowser(
  specifier: string,
  browser: { [key: string]: unknown },
): unknown {
  for (
    const key of [
      specifier,
      ...[".js", ".json", ".node"].map((ext) => specifier + ext),
    ]
  ) {
    if (key in browser) return browser[key];
  }
}

function formatToMediaType(format: Format): MediaType {
  switch (format) {
    case "commonjs":
      return "Cjs";
    case "module":
      return "Mjs";
    case "json":
      return "Json";
    case "wasm":
      return "Wasm";
  }
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

function resolveNodeModules(
  packageURL: URL,
  pjson: PackageJson | null,
  subpath: `.${string}`,
): Promise<URL | null | undefined> | URL | null | undefined {
  const isEsModule = pjson?.type === "module";

  return isEsModule
    ? resolveEsmPackage(packageURL, pjson, subpath)
    : resolveCjsPackage(packageURL, pjson, subpath);
}

function resolveEsmPackage(
  packageURL: URL,
  pjson: PackageJson | null,
  subpath: `.${string}`,
) {
  if (pjson && pjson.exports) {
    return packageExportsResolve(
      packageURL,
      subpath,
      pjson.exports,
      conditions,
      {
        existDir,
        existFile,
        readFile,
      },
    );
  }

  if (pjson && pjson.browser) {
    return packageBrowserResolve(packageURL, subpath, pjson.browser);
  }

  throw new Error();
}

const conditions = ["import"];

async function resolveCjsPackage(
  packageURL: URL,
  pjson: PackageJson | null,
  subpath: `.${string}`,
) {
  if (pjson && pjson.exports) {
    return packageExportsResolve(
      packageURL,
      subpath,
      pjson.exports,
      conditions,
      { existDir, existFile, readFile },
    );
  }

  if (pjson && "browser" in pjson) {
    if (typeof pjson.browser === "string") {
      const url = join(packageURL, pjson.browser);

      if (await existFile(url)) return url;
    }
  }

  const fileResult = await loadAsFile(packageURL);
  if (fileResult) return fileResult;

  const dirResult = await loadAsDirectory(packageURL, pjson);
  if (dirResult) return dirResult;

  throw new Error();
}

async function loadAsFile(packageURL: URL): Promise<URL | undefined> {
  // 1. If X is a file, load X as its file extension format. STOP
  if (await existFile(packageURL)) return packageURL;

  const withJs = concatPath(packageURL, ".js");
  // 2. If X.js is a file,
  if (await existFile(withJs)) return withJs;
  //     a. Find the closest package scope SCOPE to X.
  //     b. If no scope was found, load X.js as a CommonJS module. STOP.
  //     c. If the SCOPE/package.json contains "type" field,
  //       1. If the "type" field is "module", load X.js as an ECMAScript module. STOP.
  //       2. Else, load X.js as an CommonJS module. STOP.

  // 3. If X.json is a file, load X.json to a JavaScript Object. STOP
  // 4. If X.node is a file, load X.node as binary addon. STOP
  // 5. If X.mjs is a file, and `--experimental-require-module` is enabled,
  //    load X.mjs as an ECMAScript module. STOP
}

async function loadAsIndex(packageURL: URL): Promise<URL | undefined> {
  const indexJs = join(packageURL, "index.js");

  if (await existFile(indexJs)) return indexJs;
  // 1. If X/index.js is a file
  //     a. Find the closest package scope SCOPE to X.
  //     b. If no scope was found, load X/index.js as a CommonJS module. STOP.
  //     c. If the SCOPE/package.json contains "type" field,
  //       1. If the "type" field is "module", load X/index.js as an ECMAScript module. STOP.
  //       2. Else, load X/index.js as an CommonJS module. STOP.
  // 2. If X/index.json is a file, parse X/index.json to a JavaScript object. STOP
  // 3. If X/index.node is a file, load X/index.node as binary addon. STOP
}

async function loadAsDirectory(
  packageURL: URL,
  pjson: PackageJson | null,
): Promise<URL | undefined> {
  //   1. If X/package.json is a file,
  if (pjson) {
    //   a. Parse X/package.json, and look for "main" field.
    const main = pjson.main;

    //   b. If "main" is a falsy value, GOTO 2.
    if (typeof main !== "string") return loadAsIndex(packageURL);

    //   c. let M = X + (json main field)
    const M = join(packageURL, main);

    //   d. LOAD_AS_FILE(M)
    const fileResult = await loadAsFile(M);
    if (fileResult) return fileResult;

    //   e. LOAD_INDEX(M)
    const indexResult = await loadAsIndex(M);
    if (indexResult) return indexResult;
    //   f. LOAD_INDEX(X) DEPRECATED

    //   g. THROW "not found"
    throw new Error();
  }

  // 2. LOAD_INDEX(X)
  return loadAsIndex(packageURL);
}

function packageBrowserResolve(
  packageURL: URL,
  subpath: `.${string}`,
  browser: unknown,
): URL | undefined {
  // 1. If subpath is equal to ".", then
  if (subpath === "." && typeof browser === "string") {
    return join(packageURL, browser);
  }
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" &&
    value.constructor === Object;
}

function createPackageURL(
  denoDir: string,
  name: string,
  version: string,
): URL {
  const denoDirURL = toFileUrl(denoDir);
  const baseURL = join(denoDirURL, "npm", "registry.npmjs.org");

  const packageURL = join(baseURL, name, version);

  return packageURL;
}

function concatPath(url: URL | string, path: string): URL {
  url = new URL(url);

  url.pathname = url.pathname + path;

  return url;
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
