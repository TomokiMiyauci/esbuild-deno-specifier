import { format, join, readPackageJson } from "../../deps.ts";
import { isString } from "../utils.ts";
import { loadAsFile } from "./load_file.ts";
import { loadIndex } from "./load_index.ts";
import type { Context, LoadResult } from "./types.ts";
import { Msg } from "../constants.ts";

/**
 * @throws {Error}
 */
export async function loadAsDirectory(
  packageURL: URL | string,
  context: Pick<
    Context,
    | "mainFields"
    | "resolve"
    | "readFile"
    | "existFile"
    | "strategy"
    | "specifier"
  >,
): Promise<LoadResult | undefined | false> {
  // 1. If X/package.json is a file,
  const pjson = await readPackageJson(packageURL, context);

  if (pjson) {
    const values = context.mainFields.map((field) => pjson[field]).filter(
      isString,
    );

    // b. If "main" is a falsy value, GOTO 2.
    if (values.length) {
      for (const value of values) {
        const url = (await context.resolve?.(value, { packageURL, pjson })) ??
          join(packageURL, value);

        if (!url) return false;

        const fileResult = await loadAsFile(url, context);
        if (fileResult) return fileResult;

        const indexResult = await loadIndex(url, context);
        if (indexResult) return indexResult;
      }

      const message = format(Msg.NotFound, { specifier: context.specifier });
      // g. THROW "not found"
      throw new Error(message);
    }
  }

  // 2. LOAD_INDEX(X)
  return loadIndex(packageURL, context);
}
