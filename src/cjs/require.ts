import { format, isBuiltin } from "../../deps.ts";
import { loadAs } from "./utils.ts";
import { loadNodeModules } from "./load_node_modules.ts";
import type { Context } from "./types.ts";
import { parseNpmPkg } from "../utils.ts";
import { Msg } from "../constants.ts";

export async function require(
  specifier: string,
  referrer: URL | string,
  context: Pick<
    Context,
    | "conditions"
    | "existDir"
    | "existFile"
    | "mainFields"
    | "nodeModulesPaths"
    | "readFile"
    | "resolve"
    | "root"
  >,
): Promise<URL> {
  // 1. If X is a core module,
  if (isBuiltin(specifier)) {
    if (context.resolve) {
      return context.resolve(specifier, referrer, context);
    }

    return new URL(`node:${specifier}`);
  }

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

    return loadAs(url, { ...context, specifier });
  }

  if (specifier.startsWith("#")) {
    throw new Error("not supported");
  }

  const { name, subpath } = parseNpmPkg(specifier);
  const nodeModulesResult = await loadNodeModules(
    name,
    subpath,
    { ...context, specifier },
  );

  if (nodeModulesResult) return nodeModulesResult;

  const message = format(Msg.NotFound, { specifier });

  throw new Error(message);
}
