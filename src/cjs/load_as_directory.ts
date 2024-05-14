import { join, readPackageJson } from "../../deps.ts";
import { isObject } from "../utils.ts";
import { mainFields, readFile } from "../context.ts";
import { resolveBrowser } from "../browser.ts";
import { loadAsFile } from "./load_file.ts";
import { loadIndex } from "./load_index.ts";
import type { LoadResult } from "./types.ts";

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
