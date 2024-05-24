import { format, isBuiltin } from "../../../deps.ts";
import { loadAsDirectory } from "./load_as_directory.ts";
import { loadAsFile } from "./load_file.ts";
import { loadNodeModules } from "./load_node_modules.ts";
import { loadPackageImports } from "./load_package_imports.ts";
import type { Context } from "./types.ts";
import { Msg } from "../../constants.ts";

/**
 * @see https://nodejs.org/api/modules.html
 */
export async function require(
  specifier: string,
  referrer: URL | string,
  context: Context,
): Promise<URL> {
  // 1. If X is a core module,
  if (isBuiltin(specifier)) {
    if (context.resolve) {
      return context.resolve(specifier, referrer, context);
    }

    // a. return the core module
    return new URL(`node:${specifier}`);
  }

  // 2. If X begins with '/'
  // Skip

  // 3. If X begins with './' or '/' or '../'
  if (
    specifier.startsWith("./") ||
    specifier.startsWith("/") ||
    specifier.startsWith("../")
  ) {
    if (context.resolve) {
      return context.resolve(specifier, referrer, context);
    }

    const url = new URL(specifier, referrer);

    //  a. LOAD_AS_FILE(Y + X)
    const fileResult = await loadAsFile(url, context);
    if (fileResult) return fileResult;

    //  b. LOAD_AS_DIRECTORY(Y + X)
    const dirResult = await loadAsDirectory(url, { ...context, specifier });
    if (dirResult) return dirResult;

    const message = format(Msg.NotFound, { specifier });
    //  c. THROW "not found"
    throw new Error(message);
  }

  // 4. If X begins with '#'
  if (specifier.startsWith("#")) {
    // a. LOAD_PACKAGE_IMPORTS(X, dirname(Y))
    const result = await loadPackageImports(
      specifier as `#${string}`,
      referrer,
      context,
    );

    if (result) return result;
  }

  // 5. LOAD_PACKAGE_SELF(X, dirname(Y))

  // 6. LOAD_NODE_MODULES(X, dirname(Y))
  const nodeModulesResult = await loadNodeModules(specifier, context);
  if (nodeModulesResult) return nodeModulesResult;

  const message = format(Msg.NotFound, { specifier });
  // 7. THROW "not found"
  throw new Error(message);
}
