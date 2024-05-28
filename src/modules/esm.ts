import type { EsModule, Module } from "@deno/info";
import type {
  Context,
  DependencyContext,
  DependencyResolveResult,
  ResolveResult,
} from "./types.ts";
import { assertModule, assertModuleEntry } from "./utils.ts";
import { resolveModule } from "./module.ts";
import { findDependency, resolveDependency } from "./dependency.ts";

export function resolveEsModule(
  module: Pick<EsModule, "mediaType" | "specifier">,
): ResolveResult {
  const { specifier, mediaType } = module;
  const url = new URL(specifier);

  return { url, mediaType, sideEffects: undefined };
}

export async function resolveEsModuleDependency(
  module: Pick<EsModule, "dependencies">,
  context: Pick<
    DependencyContext,
    | "conditions"
    | "source"
    | "specifier"
    | "mainFields"
    | "resolve"
    | "existDir"
    | "existFile"
    | "readFile"
    | "root"
    | "getPackageURL"
    | "referrer"
  >,
): Promise<DependencyResolveResult> {
  const depModule = resolveEsModuleDependencyModule(module, context);

  const result = await resolveModule(depModule, context);

  return { ...result, module: depModule, source: undefined };
}

export function resolveEsModuleDependencyModule(
  module: Pick<EsModule, "dependencies">,
  context: Pick<Context, "specifier" | "source">,
): Module {
  const { specifier, source } = context;
  const dep = findDependency(module.dependencies ?? [], specifier);
  const depModule = resolveDependency(dep, { source });

  assertModuleEntry(depModule, specifier);
  assertModule(depModule);

  return depModule;
}
