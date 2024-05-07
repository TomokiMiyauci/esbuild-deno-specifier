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
import { formatToMediaType, isLikePath, isObject } from "../utils.ts";
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

export interface Context {
  specifier: string;
}

export async function resolveNpmModule(
  module: NpmModule,
  source: Source,
  context: Context,
): Promise<OnResolveResult> {
  const { url, pjson, format, packageURL } = await npmResolve(
    module,
    source,
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
  );
  const format = result && await esmFileFormat(result, { existFile, readFile });

  return {
    url: result,
    pjson,
    format: format ?? null,
    packageURL,
  };
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

  // 3. If X.json is a file, load X.json to a JavaScript Object. STOP
  // 4. If X.node is a file, load X.node as binary addon. STOP
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
