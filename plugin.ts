import { toFileUrl } from "jsr:@std/path@^0.221.0/to-file-url";
import {
  type AssertedModule,
  esmFileFormat,
  type EsmModule,
  type Format,
  type Loader,
  type MediaType,
  type Module,
  type ModuleEntry,
  type NodeModule,
  type NpmModule,
  type OnResolveResult,
  packageExportsResolve,
  type PackageJson,
  type Plugin,
  readPackageJson,
  type Source,
} from "./deps.ts";
import { exists } from "jsr:@std/fs@^0.221.0";
import { join } from "jsr:@std/url@^0.221.0";
import { info } from "./modules/deno/info.ts";
import { DenoDir, fromFileUrl } from "../deno-module-resolution/deps.ts";
import { isBuiltin } from "node:module";
import {
  matchSideEffects,
  normalizeSideEffects,
  validateSideEffects,
} from "./src/side_effects.ts";

interface PluginData {
  module: Module;
  source: Source;
  mediaType: MediaType;
  npm?: NpmContext;
}

interface NpmContext {
  pjson: PackageJson | null;
  packageURL: URL;
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

              const dirResult = await loadAsDirectory(url);

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

function resolveModuleEntryLike(
  moduleEntry: ModuleEntry | undefined,
  source: Source,
): Promise<OnResolveResult> | OnResolveResult {
  if (!moduleEntry) throw new Error();

  if ("error" in moduleEntry) throw new Error(moduleEntry.error);

  switch (moduleEntry.kind) {
    case "esm":
      return resolveEsmModule(moduleEntry, source);

    case "node":
      return resolveNodeModule(moduleEntry);

    case "asserted":
      return resolveAssertedModule(moduleEntry, source);

    case "npm":
      return resolveNpmModule(moduleEntry, source);
  }
}

function resolveEsmModule(module: EsmModule, source: Source): OnResolveResult {
  const path = module.local;

  if (!path) throw new Error();

  const pluginData = {
    mediaType: module.mediaType,
    module,
    source,
  } satisfies PluginData;

  return { path, namespace: "deno", pluginData };
}

function resolveNodeModule(module: NodeModule): OnResolveResult {
  return { external: true, path: module.specifier };
}

async function resolveNpmModule(
  module: NpmModule,
  source: Source,
): Promise<OnResolveResult> {
  const { url, pjson, format, packageURL } = await npmResolve(
    module,
    source,
  );

  if (!url) {
    return { namespace: "(disabled)" };
  }

  const mediaType: MediaType = format ? formatToMediaType(format) : "Unknown";
  const pluginData = {
    module,
    source,
    mediaType,
    npm: { pjson, packageURL },
  } satisfies PluginData;
  const path = fromFileUrl(url);
  const sideEffects = resolveSideEffects(
    pjson?.sideEffects,
    fromFileUrl(packageURL),
    path,
  );

  return { path, namespace: "deno", sideEffects, pluginData };
}

function resolveAssertedModule(
  module: AssertedModule,
  source: Source,
): OnResolveResult {
  const path = module.local;

  if (!path) throw new Error();

  const pluginData = {
    mediaType: module.mediaType,
    module,
    source,
  } satisfies PluginData;

  return { path, namespace: "deno", pluginData };
}

function resolveSideEffects(
  sideEffects: unknown,
  packagePath: string,
  path: string,
): undefined | boolean {
  if (!validateSideEffects(sideEffects)) return undefined;

  const normalizedSideEffects = normalizeSideEffects(
    sideEffects,
    packagePath,
  );

  return matchSideEffects(normalizedSideEffects, path);
}

interface NpmResult {
  url: URL | null;
  pjson: PackageJson | null;
  format: Format | null;
  packageURL: URL;
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
    packageURL,
  };
}

function resolveBrowser(
  specifier: string,
  browser: PackageJson,
) {
  for (
    const key of [
      specifier,
      ...[".js", ".json", ".node"].map((ext) => specifier + ext),
    ]
  ) {
    if (key in browser) {
      return resolveBrowserValue(browser[key]);
    }
  }
}

function resolveBrowserValue(value: unknown): {
  specifier: string | null;
} | undefined {
  if (value === false) return { specifier: null };

  if (typeof value === "string") return { specifier: value };
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
): Promise<URL | null> | URL | null {
  const isEsModule = pjson?.type === "module";

  return isEsModule
    ? resolveEsmPackage(packageURL, pjson, subpath)
    : resolveCjsPackage(packageURL, pjson, subpath);
}

async function resolveEsmPackage(
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

  if (pjson && "browser" in pjson) {
    if (typeof pjson.browser === "string") {
      const url = join(packageURL, pjson.browser);

      if (await existFile(url)) return url;
    }
  }
  throw new Error("ESM");
}

const conditions = ["import", "browser", "module"];

async function resolveCjsPackage(
  packageURL: URL,
  pjson: PackageJson | null,
  subpath: `.${string}`,
): Promise<URL | null> {
  if (pjson && "exports" in pjson) {
    return packageExportsResolve(
      packageURL,
      subpath,
      pjson.exports,
      conditions,
      { existDir, existFile, readFile },
    );
  }

  const fileResult = await loadAsFile(join(packageURL, subpath));
  if (fileResult) return fileResult;

  return loadAsDirectory(join(packageURL, subpath));
}

const mainFields = ["browser", "module", "main"];

async function loadAsFile(X: URL): Promise<URL | undefined> {
  // 1. If X is a file, load X as its file extension format. STOP
  if (await existFile(X)) return X;

  const withJs = concatPath(X, ".js");
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
  M: URL,
): Promise<URL | null> {
  const pjson = await readPackageJson(M, { readFile });

  if (pjson) {
    const fieldSet = mainFields.map((field) => ({ field, value: pjson[field] }))
      .filter((v): v is { field: string; value: string } =>
        typeof v.value === "string"
      );
    const browser = pjson.browser;
    const isBrowser = isObject(browser);

    if (fieldSet.length) {
      for (const { value } of fieldSet) {
        let url: URL;

        if (isBrowser) {
          const result = resolveBrowser(value, browser);

          if (result) {
            if (result.specifier === null) {
              return null;
            }

            url = join(M, result.specifier);
          } else {
            url = join(M, value);
          }
        } else {
          url = join(M, value);
        }

        const fileResult = await loadAsFile(url);
        if (fileResult) return fileResult;

        const indexResult = await loadAsIndex(url);
        if (indexResult) return indexResult;
      }

      throw new Error("c");
    }
  }

  const indexResult = await loadAsIndex(M);
  if (!indexResult) {
    throw new Error();
  }

  return indexResult;
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
