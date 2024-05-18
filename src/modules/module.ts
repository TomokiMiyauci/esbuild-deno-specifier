import { resolveNpmModule } from "./npm.ts";
import { resolveEsModule } from "./esm.ts";
import { resolveNodeModule } from "./node.ts";
import type {
  Context,
  DependencyContext,
  DependencyResolveResult,
  ResolveResult,
} from "./types.ts";
import { type Module } from "../../deps.ts";
import { resolveNpmModuleDependency } from "./npm.ts";
import { resolveEsModuleDependency } from "./esm.ts";

export function resolveModule(
  module: Module,
  context: Pick<
    Context,
    | "conditions"
    | "mainFields"
    | "resolve"
    | "source"
    | "specifier"
    | "existDir"
    | "existFile"
    | "readFile"
    | "root"
  >,
): ResolveResult | undefined | Promise<ResolveResult | undefined> {
  switch (module.kind) {
    case "esm":
    case "asserted":
      return resolveEsModule(module);

    case "node":
      return resolveNodeModule(module);

    case "npm":
      return resolveNpmModule(module, context);
  }
}

/**
 * @throws {Error}
 */
export function resolveModuleDependency(
  module: Module,
  context: DependencyContext,
): Promise<DependencyResolveResult> {
  switch (module.kind) {
    case "esm": {
      return resolveEsModuleDependency(module, context);
    }

    case "npm": {
      return resolveNpmModuleDependency(module, context);
    }

    case "asserted":
    case "node": {
      throw new Error("unreachable");
    }
  }
}
