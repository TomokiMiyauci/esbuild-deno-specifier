import { type Module } from "../../deps.ts";
import { resolveNpmModule } from "./npm.ts";
import { resolveEsModule } from "./esm.ts";
import { resolveNodeModule } from "./node.ts";
import type { Context, ResolveResult } from "./types.ts";

export function resolveModule(
  module: Module,
  context: Pick<
    Context,
    "conditions" | "mainFields" | "resolve" | "source" | "specifier"
  >,
): ResolveResult | undefined | Promise<ResolveResult | undefined> {
  switch (module.kind) {
    case "esm":
    case "asserted":
      return resolveEsModule(module, context);

    case "node":
      return resolveNodeModule(module);

    case "npm":
      return resolveNpmModule(module, context);
  }
}
