import { type EsModule, format, type Module, toFileUrl } from "../../deps.ts";
import { Msg } from "../constants.ts";
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
  module: Pick<EsModule, "local" | "mediaType">,
  context: Pick<Context, "specifier">,
): ResolveResult {
  const path = module.local;

  if (typeof path !== "string") {
    const message = format(Msg.LocalPathNotFound, context);

    throw new Error(message);
  }

  const url = toFileUrl(path);

  return { url, mediaType: module.mediaType };
}

export async function resolveEsModuleDependency(
  module: Pick<EsModule, "dependencies">,
  context: Pick<
    DependencyContext,
    "conditions" | "source" | "specifier" | "mainFields" | "resolve"
  >,
): Promise<DependencyResolveResult> {
  const { specifier, source, conditions, mainFields, resolve } = context;
  const depModule = resolveEsModuleDependencyModule(module, {
    specifier,
    source,
  });

  const result = await resolveModule(depModule, {
    conditions,
    source,
    specifier,
    mainFields,
    resolve,
  });

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
