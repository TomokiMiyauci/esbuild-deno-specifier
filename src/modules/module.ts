import {
  format,
  type Module,
  type ModuleEntry,
  type OnResolveResult,
} from "../../deps.ts";
import { resolveNpmModule } from "./npm.ts";
import { resolveEsModule } from "./esm.ts";
import { resolveNodeModule } from "./node.ts";
import { resolveAssertedModule } from "./asserted.ts";
import type { Context } from "./types.ts";
import { Msg } from "../constants.ts";

export function resolveModuleEntryLike(
  moduleEntry: ModuleEntry | undefined,
  context: Context,
): Promise<OnResolveResult> | OnResolveResult {
  if (!moduleEntry) {
    const message = format(Msg.NotFound, { specifier: context.specifier });

    throw new Error(message);
  }

  if ("error" in moduleEntry) throw new Error(moduleEntry.error);

  return resolveModule(moduleEntry, context);
}

export function resolveModule(
  module: Module,
  context: Context,
): OnResolveResult | Promise<OnResolveResult> {
  switch (module.kind) {
    case "esm":
      return resolveEsModule(module, context);

    case "node":
      return resolveNodeModule(module);

    case "asserted":
      return resolveAssertedModule(module, context);

    case "npm":
      return resolveNpmModule(module, context);
  }
}
