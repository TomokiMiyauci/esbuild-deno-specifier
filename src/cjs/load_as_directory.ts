import { join, readPackageJson } from "../../deps.ts";
import { isObject, isString } from "../utils.ts";
import { readFile } from "../context.ts";
import { resolveBrowser } from "../browser.ts";
import { loadAsFile } from "./load_file.ts";
import { loadIndex } from "./load_index.ts";
import type { Context, LoadResult } from "./types.ts";

/**
 * @throws {Error}
 */
export async function loadAsDirectory(
  packageURL: URL | string,
  context: Pick<Context, "mainFields">,
): Promise<LoadResult | undefined | false> {
  // 1. If X/package.json is a file,
  const pjson = await readPackageJson(packageURL, { readFile });

  if (pjson) {
    const values = context.mainFields.map((field) => pjson[field]).filter(
      isString,
    );
    // const browser = pjson.browser;
    // const isBrowser = isObject(browser);

    // b. If "main" is a falsy value, GOTO 2.
    if (values.length) {
      for (const value of values) {
        const url = join(packageURL, value);

        // if (isBrowser) {
        //   const result = resolveBrowser(value, browser);

        //   if (result) {
        //     if (result.specifier === null) {
        //       return false;
        //     }

        //     url = join(M, result.specifier);
        //   } else {
        //     url = join(M, value);
        //   }
        // } else {
        //   url = join(M, value);
        // }

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
  return loadIndex(packageURL);
}
