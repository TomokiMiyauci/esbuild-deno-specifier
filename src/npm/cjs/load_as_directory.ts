import { format, join, PackageJson, readPackageJson } from "../../../deps.ts";
import { loadAsFile } from "./load_file.ts";
import { loadIndex } from "./load_index.ts";
import type { Context } from "./types.ts";
import { Msg } from "../../constants.ts";

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
    const value = resolveFields(pjson, context.mainFields);

    // b. If "main" is a falsy value, GOTO 2.
    if (value) {
      if (context.resolve) {
        return context.resolve(
          value,
          join(packageURL, "package.json"),
          context,
        );
      }

      const url = join(packageURL, value);

      const fileResult = await loadAsFile(url, context);
      if (fileResult) return fileResult;

      const indexResult = await loadIndex(url, context);
      if (indexResult) return indexResult;

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
  for (const filed of fields) {
    if (filed in pjson) {
      const value = pjson[filed];

      if (typeof value === "string") {
        if (value.startsWith(".")) return value;

        return "./" + value;
      }
    }
  }
}
