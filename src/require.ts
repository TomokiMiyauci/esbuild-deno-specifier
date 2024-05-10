import { join, readPackageJson } from "../deps.ts";
import { isObject } from "./utils.ts";
import { existFile, mainFields, readFile } from "./context.ts";
import { resolveBrowser } from "./browser.ts";

export async function loadAsDirectory(
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

export async function loadIndex(X: URL): Promise<URL | undefined> {
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
