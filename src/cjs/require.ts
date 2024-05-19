import { isBuiltin } from "../../deps.ts";
import { findClosest, loadAs } from "./utils.ts";
import { loadNodeModules } from "./load_node_modules.ts";
import type { Context, LoadResult } from "./types.ts";
import { parseNpmPkg } from "../utils.ts";

export async function require(
  specifier: string,
  referrer: URL | string,
  context: Context,
): Promise<LoadResult | undefined> {
  // 1. If X is a core module,
  if (isBuiltin(specifier)) {
    const closest = await findClosest(referrer, context);

    if (closest && context.resolve) {
      const result = await context.resolve(specifier, closest);

      if (result === false) return undefined;
      if (result) return loadAs(result, context);
    }

    return { url: new URL(`node:${specifier}`), format: "builtin" };
  }

  // 3. If X begins with './' or '/' or '../'
  if (
    specifier.startsWith("./") ||
    specifier.startsWith("/") ||
    specifier.startsWith("../")
  ) {
    const closest = await findClosest(referrer, context);

    const url = (closest && await context.resolve?.(specifier, closest)) ??
      new URL(specifier, referrer);

    if (!url) return;

    return loadAs(url, context);
  }

  if (specifier.startsWith("#")) {
    throw new Error("not supported");
  }

  const { name, subpath } = parseNpmPkg(specifier);
  const nodeModulesResult = await loadNodeModules(
    name,
    subpath,
    context,
  );

  if (nodeModulesResult || nodeModulesResult === false) {
    return nodeModulesResult || undefined;
  }

  throw new Error("not found");
}
