import {
  esmFileFormat,
  type Format,
  fromFileUrl,
  join,
  type MediaType,
  type NpmModule,
  type OnResolveResult,
  packageExportsResolve,
  type PackageJson,
  readPackageJson,
  type Source,
  toFileUrl,
} from "../../deps.ts";
import {
  formatToMediaType,
  isLikePath,
  isObject,
  parseNpmPkg,
} from "../utils.ts";
import type { PluginData } from "../types.ts";
import {
  denoDir,
  existDir,
  existFile,
  mainFields,
  readFile,
} from "../context.ts";
import { resolveBrowser } from "../browser.ts";
import {
  matchSideEffects,
  normalizeSideEffects,
  validateSideEffects,
} from "../side_effects.ts";
import type { Context } from "./types.ts";
import { isBuiltin } from "node:module";
import { Namespace } from "../constants.ts";

export async function resolveNpmModule(
  module: NpmModule,
  source: Source,
  context: Context,
): Promise<OnResolveResult> {
  const { url, pjson, format, packageURL } = await npmResolve(
    module,
    source,
    context,
  );

  if (!url) {
    const path = isLikePath(context.specifier)
      ? fromFileUrl(join(packageURL, context.specifier))
      : context.specifier;

    return { path, namespace: "(disabled)" };
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

export interface NpmResult {
  url: URL | null;
  pjson: PackageJson | null;
  format: Format | null;
  packageURL: URL;
}

export async function npmResolve(
  module: NpmModule,
  source: Source,
  context: Context,
): Promise<NpmResult> {
  const npm = source.npmPackages[module.npmPackage];

  if (!npm) throw new Error("npm not found");

  const { name, version } = npm;

  const npmSpecifier = `npm:/${name}@${version}`;
  const subpath = module.specifier.slice(npmSpecifier.length);
  const packageSubpath = `.${subpath}` as const;

  const packageURL = createPackageURL(denoDir, name, version);

  if (!await existDir(packageURL)) {
    throw new Error();
  }

  const pjson = await readPackageJson(packageURL, { readFile });
  const result = await resolveNodeModules(
    packageURL,
    pjson,
    packageSubpath,
    context,
  );

  if (result === undefined) {
    throw new Error();
  }

  const format = result && await esmFileFormat(result, { existFile, readFile });

  return {
    url: result || null,
    pjson,
    format: format || null,
    packageURL,
  };
}

function resolveNodeModules(
  packageURL: URL,
  pjson: PackageJson | null,
  subpath: `.${string}`,
  context: Context,
): Promise<URL | undefined | false> | URL | undefined | false {
  const isEsModule = pjson?.type === "module";

  return isEsModule
    ? resolveEsmPackage(packageURL, pjson, subpath, context)
    : resolveCjsPackage(packageURL, pjson, subpath, context);
}

async function resolveEsmPackage(
  packageURL: URL,
  pjson: PackageJson | null,
  subpath: `.${string}`,
  context: Context,
) {
  if (pjson && pjson.exports) {
    return packageExportsResolve(
      packageURL,
      subpath,
      pjson.exports,
      context.conditions,
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

async function resolveCjsPackage(
  packageURL: URL,
  pjson: PackageJson | null,
  subpath: `.${string}`,
  context: Context,
): Promise<URL | undefined | false> {
  if (pjson && "exports" in pjson) {
    return packageExportsResolve(
      packageURL,
      subpath,
      pjson.exports,
      context.conditions,
      { existDir, existFile, readFile },
    );
  }

  const url = join(packageURL, subpath);

  const fileResult = await loadAsFile(url);
  if (fileResult) return fileResult;

  return loadAsDirectory(url);
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

async function loadAsDirectory(
  M: URL,
): Promise<URL | undefined | false> {
  // 1. If X/package.json is a file,
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
              return false;
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

        const indexResult = await loadIndex(url);
        if (indexResult) return indexResult;
      }

      // g. THROW "not found"
      throw new Error("not found");
    }
  }

  // 2. LOAD_INDEX(X)
  return loadIndex(M);
}

async function loadIndex(X: URL): Promise<URL | undefined> {
  const indexJs = join(X, "index.js");

  // 1. If X/index.js is a file
  if (await existFile(indexJs)) return indexJs;
  //     a. Find the closest package scope SCOPE to X.
  //     b. If no scope was found, load X/index.js as a CommonJS module. STOP.
  //     c. If the SCOPE/package.json contains "type" field,
  //       1. If the "type" field is "module", load X/index.js as an ECMAScript module. STOP.
  //       2. Else, load X/index.js as an CommonJS module. STOP.

  const indexJson = join(X, "index.json");
  // 2. If X/index.json is a file, parse X/index.json to a JavaScript object. STOP
  if (await existFile(indexJson)) return indexJson;

  const indexNode = join(X, "index.node");
  // 3. If X/index.node is a file, load X/index.node as binary addon. STOP
  if (await existFile(indexNode)) return indexNode;
}

export async function loadAsFile(X: URL): Promise<URL | undefined> {
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

  const withJson = concatPath(X, ".json");
  // 3. If X.json is a file, load X.json to a JavaScript Object. STOP
  if (await existFile(withJson)) return withJson;

  const withNode = concatPath(X, ".node");
  // 4. If X.node is a file, load X.node as binary addon. STOP
  if (await existFile(withNode)) return withNode;

  // 5. If X.mjs is a file, and `--experimental-require-module` is enabled,
  //    load X.mjs as an ECMAScript module. STOP
}

function concatPath(url: URL | string, path: string): URL {
  url = new URL(url);

  url.pathname = url.pathname + path;

  return url;
}

export function resolveSideEffects(
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

export function resolveNpmDependency(
  module: NpmModule,
  source: Source,
  context: Context,
): Promise<OnResolveResult> | undefined {
  const npm = source.npmPackages[module.npmPackage];

  if (!npm) throw new Error("npm not found");

  const { name, subpath } = parseNpmPkg(context.specifier);

  if (npm.name === name) {
    const childModule = {
      kind: "npm",
      specifier: `npm:/${npm.name}@${npm.version}${subpath.slice(1)}`,
      npmPackage: module.npmPackage,
    } satisfies NpmModule;

    return resolveNpmModule(childModule, source, context);
  }

  const mapped = npm.dependencies.map((fullSpecifier) => {
    return [
      fullSpecifier,
      source.npmPackages[fullSpecifier],
    ] as const;
  });

  const depEntry = mapped.find(([_, npm]) => npm.name === name);

  if (depEntry) {
    const [npmPackage, dep] = depEntry;
    const module = {
      kind: "npm",
      specifier: `npm:/${dep.name}@${dep.version}${subpath.slice(1)}`,
      npmPackage,
    } satisfies NpmModule;

    return resolveNpmModule(module, source, context);
  }
}

export async function require(specifier: string, referrer: string, context: {
  source: Source;
  module: NpmModule;
  pjson: PackageJson | null;
  packageURL: URL;
  conditions: string[];
  next: (specifier: string) => Promise<OnResolveResult> | OnResolveResult;
}): Promise<OnResolveResult> {
  // 1. If X is a core module,
  if (isBuiltin(specifier)) return { external: true };

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const base = toFileUrl(referrer);
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
        module: context.module,
        source: context.source,
        npm: { pjson: context.pjson, packageURL: context.packageURL },
      } satisfies PluginData;
      const path = fromFileUrl(fileResult);
      const sideEffects = resolveSideEffects(
        context.pjson?.sideEffects,
        fromFileUrl(context.packageURL),
        path,
      );

      return { path, namespace: Namespace.Deno, pluginData, sideEffects };
    }

    // const dirResult = await loadAsDirectory(url);

    throw new Error("not found");
  }

  const result = resolveNpmDependency(context.module, context.source, {
    specifier,
    referrer,
    npm: { packageURL: context.packageURL, pjson: context.pjson },
    conditions: context.conditions,
  });

  if (result) return result;

  const { subpath } = parseNpmPkg(specifier);
  // The case where dependencies cannot be detected is when optional: true in peerDependency.
  // In this case, version resolution is left to the user
  const pkg = `npm:/${specifier}${subpath.slice(1)}`;

  return context.next(pkg);
}
