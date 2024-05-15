import { isBuiltin } from "../../deps.ts";
import { parseNpmPkg } from "../utils.ts";
import { loadAsFile } from "./load_file.ts";
import { findClosest } from "./utils.ts";
import { loadAsDirectory } from "./load_as_directory.ts";
import { loadNodeModules } from "./load_node_modules.ts";
import type { Context, LoadResult } from "./types.ts";

export async function require(
  specifier: string,
  referrer: URL | string,
  context: Context,
): Promise<LoadResult | undefined> {
  // 1. If X is a core module,
  if (isBuiltin(specifier)) {
    const closest = await findClosest(referrer);

    if (closest && context.resolve) {
      const result = context.resolve(specifier, closest);

      if (result === false) return undefined;

      if (result) {
        throw new Error("unknown");
      }
    }

    return {
      url: new URL(`node:${specifier}`),
      format: "builtin",
    };
  }

  // 3. If X begins with './' or '/' or '../'
  if (
    specifier.startsWith("./") ||
    specifier.startsWith("/") ||
    specifier.startsWith("../")
  ) {
    const closest = await findClosest(referrer);

    const url = (closest && await context.resolve?.(specifier, closest)) ??
      new URL(specifier, referrer);

    if (!url) return;

    //  a. LOAD_AS_FILE(Y + X)
    const fileResult = await loadAsFile(url);
    if (fileResult) return fileResult;

    //  b. LOAD_AS_DIRECTORY(Y + X)
    const dirResult = await loadAsDirectory(url, context);

    if (dirResult || dirResult === false) {
      return dirResult || undefined;
    }

    //  c. THROW "not found"
    throw new Error("not found");
  }

  if (specifier.startsWith("#")) {
    throw new Error("not supported");
  }

  const { subpath, name } = parseNpmPkg(specifier);
  const packageURL = await context.getPackageURL(name);
  const nodeModulesResult = await loadNodeModules(packageURL, subpath, context);

  if (nodeModulesResult || nodeModulesResult === false) {
    return nodeModulesResult || undefined;
  }

  throw new Error("not found");
}
