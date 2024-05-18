import { type EsModule, type Module, toFileUrl } from "../../deps.ts";
import type {
  Context,
  DependencyContext,
  DependencyResolveResult,
  ResolveResult,
} from "./types.ts";
import { assertModule, assertModuleEntry } from "./utils.ts";
import { resolveModule } from "./module.ts";
import { findDependency, resolveDependency } from "./dependency.ts";

/**
 * @throws {Error} If module.local is not string
 */
export function resolveEsModule(
  module: Pick<EsModule, "local" | "mediaType" | "specifier">,
): ResolveResult {
  const path = module.local;
  const url = typeof path === "string"
    ? toFileUrl(path)
    : new URL(module.specifier);

  return { url, mediaType: module.mediaType };
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
  >,
): Promise<DependencyResolveResult> {
  const depModule = resolveEsModuleDependencyModule(module, context);

  const result = await resolveModule(depModule, context);

  return [result, { module: depModule, source: undefined }];
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
