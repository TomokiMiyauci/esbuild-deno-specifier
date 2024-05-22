import { format, join, PackageJson, readPackageJson } from "../../../deps.ts";
import { loadAsFile } from "./load_file.ts";
import { loadIndex } from "./load_index.ts";
import type { Context } from "./types.ts";
import { Msg } from "../../constants.ts";
import { createPjsonURL, isLikePath } from "../../utils.ts";
import { LikePath } from "../../utils.ts";

/**
 * @throws {Error}
 */
export async function loadAsDirectory(
  packageURL: URL | string,
  context: Context,
): Promise<URL | undefined> {
  // 1. If X/package.json is a file,
  const pjson = await readPackageJson(packageURL, context);

  if (pjson) {
    const specifier = resolveFields(pjson, context.mainFields);

    // b. If "main" is a falsy value, GOTO 2.
    if (specifier) {
      // This is customizable resolution hook
      if (context.resolve) {
        const referrer = createPjsonURL(packageURL);

        return context.resolve(specifier, referrer, context);
      }

      // c. let M = X + (json main field)
      const url = join(packageURL, specifier);

      // d. LOAD_AS_FILE(M)
      const fileResult = await loadAsFile(url, context);
      if (fileResult) return fileResult;

      // e. LOAD_INDEX(M)
      const indexResult = await loadIndex(url, context);
      if (indexResult) return indexResult;

      // f. LOAD_INDEX(X) DEPRECATED
      // Skip this process

      const message = format(Msg.NotFound, { specifier: context.specifier });
      // g. THROW "not found"
      throw new Error(message);
    }
  }

  // 2. LOAD_INDEX(X)
  return loadIndex(packageURL, context);
}

export function resolveFields(
  pjson: PackageJson,
  fields: Iterable<string>,
): string | undefined {
  for (const field of fields) {
    const value = resolveField(pjson, field);

    if (typeof value === "string") return value;
  }
}

export function resolveField(
  pjson: PackageJson,
  field: string,
): string | undefined {
  if (field in pjson) {
    const value = pjson[field];

    if (typeof value === "string") return toRelative(value);
  }
}

export function toRelative(path: string): LikePath {
  if (isLikePath(path)) return path;

  return `./${path}`;
}
