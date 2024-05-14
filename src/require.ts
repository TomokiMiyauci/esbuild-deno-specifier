import {
  dirname,
  extname,
  isBuiltin,
  join,
  type PackageJson,
  readPackageJson,
} from "../deps.ts";
import { isObject, parseNpmPkg } from "./utils.ts";
import { existDir, existFile, mainFields, readFile } from "./context.ts";
import { resolveBrowser } from "./browser.ts";
import { packageExportsResolve } from "../deps.ts";

export async function loadAsDirectory(
  M: URL,
): Promise<LoadResult | undefined | false> {
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

interface LoadResult {
  url: URL;
  format: Format | undefined;
}

export type Format = "builtin" | "commonjs" | "json" | "module" | "wasm";

function formatFromExt(ext: string): Format | undefined {
  switch (ext) {
    case ".json":
      return "json";
    case ".wasm":
      return "wasm";
    case ".cjs":
    case ".js":
      return "commonjs";
    case ".mjs":
      return "module";
  }
}

export async function loadAsFile(
  url: URL | string,
): Promise<LoadResult | undefined> {
  // 1. If X is a file, load X as its file extension format. STOP
  if (await existFile(url)) {
    const ext = extname(url);
    const format = formatFromExt(ext);

    return { url: new URL(url), format };
  }

  const withJs = concatPath(url, ".js");
  // 2. If X.js is a file,
  if (await existFile(withJs)) {
    // a. Find the closest package scope SCOPE to X.
    const result = await findClosest(url);

    // b. If no scope was found, load X.js as a CommonJS module. STOP.
    if (!result) {
      return { url: withJs, format: "commonjs" };
    }

    // c. If the SCOPE/package.json contains "type" field,
    if ("type" in result.pjson) {
      // 1. If the "type" field is "module", load X.js as an ECMAScript module. STOP.
      if (result.pjson.type === "module") {
        return { url: withJs, format: "module" };
      }
    }

    // 2. Else, load X.js as an CommonJS module. STOP.
    return { url: withJs, format: "commonjs" };
  }

  const withJson = concatPath(url, ".json");
  // 3. If X.json is a file, load X.json to a JavaScript Object. STOP
  if (await existFile(withJson)) return { url: withJson, format: "json" };

  const withNode = concatPath(url, ".node");
  // 4. If X.node is a file, load X.node as binary addon. STOP
  if (await existFile(withNode)) {
    return { url: withNode, format: undefined };
  }

  // Skip. This is only Node.js
  // 5. If X.mjs is a file, and `--experimental-require-module` is enabled,
  //    load X.mjs as an ECMAScript module. STOP
}

function concatPath(url: URL | string, path: string): URL {
  url = new URL(url);

  url.pathname = url.pathname + path;

  return url;
}

export async function loadIndex(X: URL): Promise<LoadResult | undefined> {
  const indexJs = join(X, "index.js");

  // 1. If X/index.js is a file
  if (await existFile(indexJs)) {
    // a. Find the closest package scope SCOPE to X.
    const result = await findClosest(X);
    // b. If no scope was found, load X/index.js as a CommonJS module. STOP.
    if (!result) return { url: indexJs, format: "commonjs" };

    // c. If the SCOPE/package.json contains "type" field,
    if ("type" in result.pjson) {
      // 1. If the "type" field is "module", load X/index.js as an ECMAScript module. STOP.
      if (result.pjson.type === "module") {
        return { url: indexJs, format: "module" };
      }
    }

    // 2. Else, load X/index.js as an CommonJS module. STOP.
    return { url: indexJs, format: "commonjs" };
  }

  const indexJson = join(X, "index.json");
  // 2. If X/index.json is a file, parse X/index.json to a JavaScript object. STOP
  if (await existFile(indexJson)) {
    return { url: indexJson, format: "json" };
  }

  const indexNode = join(X, "index.node");
  // 3. If X/index.node is a file, load X/index.node as binary addon. STOP
  if (await existFile(indexNode)) {
    return { url: indexNode, format: undefined };
  }
}

export async function loadNodeModules(
  packageURL: URL,
  subpath: `.${string}`,
  context: {
    conditions: string[];
  },
): Promise<LoadResult | false | undefined> {
  const exportsResult = await loadPackageExports(packageURL, subpath, context);
  if (exportsResult) return exportsResult;

  const url = join(packageURL, subpath);
  const loadResult = await loadAsFile(url);
  if (loadResult) return loadResult;

  const dirResult = await loadAsDirectory(url);
  if (dirResult || dirResult === false) return dirResult;
}

async function findClosest(
  url: URL | string,
): Promise<{ pjson: PackageJson; packageURL: URL } | undefined> {
  for (const packageURL of parents(url)) {
    const pjson = await readPackageJson(packageURL, { readFile });

    if (pjson) {
      return { pjson, packageURL };
    }
  }
}

function* parents(url: URL | string): Iterable<URL> {
  const pathname = new URL(url).pathname;
  const dir = dirname(url);

  if (dir.pathname !== pathname) {
    yield dir;
    yield* parents(dir);
  }
}

export async function require(
  specifier: string,
  referrer: URL | string,
  context: {
    conditions: string[];
    getPackageURL(pkg: string): Promise<URL> | URL;
  },
): Promise<LoadResult | undefined> {
  // 1. If X is a core module,
  if (isBuiltin(specifier)) {
    return {
      url: new URL(`node:${specifier}`),
      format: "builtin",
    };
  }

  // 3. If X begins with './' or '/' or '../'
  if (
    specifier.startsWith("./") ||
    specifier.startsWith("/") ||
    specifier.startsWith("../")
  ) {
    const X = new URL(specifier, referrer);
    //  a. LOAD_AS_FILE(Y + X)
    const fileResult = await loadAsFile(X);
    if (fileResult) return fileResult;

    //  b. LOAD_AS_DIRECTORY(Y + X)
    const dirResult = await loadAsDirectory(X);

    if (dirResult || dirResult === false) {
      return dirResult || undefined;
    }

    //  c. THROW "not found"
    throw new Error("not found");
  }

  if (specifier.startsWith("#")) {
    throw new Error("not supported");
  }

  const { subpath, name } = parseNpmPkg(specifier);
  const packageURL = await context.getPackageURL(name);
  const nodeModulesResult = await loadNodeModules(packageURL, subpath, context);

  if (nodeModulesResult || nodeModulesResult === false) {
    return nodeModulesResult || undefined;
  }

  throw new Error("not found");
}

export async function loadPackageExports(
  packageURL: URL,
  subpath: `.${string}`,
  context: {
    conditions: string[];
  },
): Promise<LoadResult | undefined> {
  // 3. Parse DIR/NAME/package.json, and look for "exports" field.
  const pjson = await readPackageJson(packageURL, { readFile });

  if (!pjson) return;

  const exports = pjson.exports;
  // 4. If "exports" is null or undefined, return.
  if (exports === null || exports === undefined) return;

  // 5. let MATCH = PACKAGE_EXPORTS_RESOLVE(pathToFileURL(DIR/NAME), "." + SUBPATH,
  //    `package.json` "exports", ["node", "require"]) defined in the ESM resolver.
  const match = await packageExportsResolve(
    packageURL,
    subpath,
    exports,
    context.conditions,
    { existDir, existFile, readFile },
  );

  // 6. RESOLVE_ESM_MATCH(MATCH)
  return resolveEsmMatch(match);
}

export async function resolveEsmMatch(url: URL): Promise<LoadResult> {
  // 1. let RESOLVED_PATH = fileURLToPath(MATCH)
  // 2. If the file at RESOLVED_PATH exists, load RESOLVED_PATH as its extension
  //    format. STOP
  if (await existFile(url)) {
    const ext = extname(url);
    const format = formatFromExt(ext);

    return { url: url, format };
  }

  // 3. THROW "not found"
  throw new Error("not found");
}
