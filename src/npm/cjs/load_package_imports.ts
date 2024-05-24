import { packageImportsResolve, readPackageJson } from "../../../deps.ts";
import { resolveEsmMatch } from "./resolve_esm_match.ts";
import { lookupPackageScope } from "./lookup_package_scope.ts";
import { Context } from "./types.ts";

export async function loadPackageImports(
  specifier: `#${string}`,
  referrer: URL | string,
  context: Context,
): Promise<URL | undefined> {
  // 1. Find the closest package scope SCOPE to DIR.
  const packageURL = await lookupPackageScope(referrer, context);

  // 2. If no scope was found, return.
  if (!packageURL) return;

  const pjson = await readPackageJson(packageURL, context);
  const imports = pjson?.imports;

  // 3. If the SCOPE/package.json "imports" is null or undefined, return.
  if (imports === undefined || imports === null) return;

  // 4. let MATCH = PACKAGE_IMPORTS_RESOLVE(X, pathToFileURL(SCOPE),
  //  ["node", "require"]) defined in the ESM resolver.
  const match = await packageImportsResolve(
    specifier,
    packageURL,
    context.conditions,
    context,
  );

  // 5. RESOLVE_ESM_MATCH(MATCH).
  return resolveEsmMatch(match, { ...context, specifier });
}
