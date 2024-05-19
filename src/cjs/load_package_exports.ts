import { packageExportsResolve, readPackageJson } from "../../deps.ts";
import { resolveEsmMatch } from "./resolve_esm_match.ts";
import type { Context, LoadResult } from "./types.ts";
import type { Subpath } from "../types.ts";

export async function loadPackageExports(
  packageURL: URL | string,
  subpath: Subpath,
  context: Pick<
    Context,
    "conditions" | "readFile" | "existDir" | "existFile" | "strategy"
  >,
): Promise<LoadResult | undefined> {
  // 3. Parse DIR/NAME/package.json, and look for "exports" field.
  const pjson = await readPackageJson(packageURL, context);

  const exports = pjson?.exports;
  // 4. If "exports" is null or undefined, return.
  if (exports === null || exports === undefined) return;

  // 5. let MATCH = PACKAGE_EXPORTS_RESOLVE(pathToFileURL(DIR/NAME), "." + SUBPATH,
  //    `package.json` "exports", ["node", "require"]) defined in the ESM resolver.
  const match = await packageExportsResolve(
    packageURL,
    subpath,
    exports,
    context.conditions,
    context,
  );

  // 6. RESOLVE_ESM_MATCH(MATCH)
  return resolveEsmMatch(match, context);
}
