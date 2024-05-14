import { packageExportsResolve, readPackageJson } from "../../deps.ts";
import { existDir, existFile, readFile } from "../context.ts";
import { resolveEsmMatch } from "./resolver_esm_match.ts";
import type { LoadResult } from "./types.ts";

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
