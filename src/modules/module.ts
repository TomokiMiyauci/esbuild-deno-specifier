import {
  type Module,
  type ModuleEntry,
  type OnResolveResult,
  type Source,
} from "../../deps.ts";
import { type Context, resolveNpmModule } from "./npm.ts";
import { resolveEsmModule } from "./esm.ts";
import { resolveNodeModule } from "./node.ts";
import { resolveAssertedModule } from "./asserted.ts";

export function resolveModuleEntryLike(
  moduleEntry: ModuleEntry | undefined,
  source: Source,
  context: Context,
): Promise<OnResolveResult> | OnResolveResult {
  if (!moduleEntry) throw new Error();
  if ("error" in moduleEntry) throw new Error(moduleEntry.error);

  return resolveModule(moduleEntry, source, context);
}

export function resolveModule(
  module: Module,
  source: Source,
  context: Context,
): OnResolveResult | Promise<OnResolveResult> {
  switch (module.kind) {
    case "esm":
      return resolveEsmModule(module, source);

    case "node":
      return resolveNodeModule(module);

    case "asserted":
      return resolveAssertedModule(module, source);

    case "npm":
      return resolveNpmModule(module, source, context);
  }
}
