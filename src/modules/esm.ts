import {
  type Dependency,
  type EsModule,
  format,
  ModuleEntry,
  NpmModule,
  toFileUrl,
} from "../../deps.ts";
import { Msg } from "../constants.ts";
import type { Context, ResolveResult } from "./types.ts";

export function resolveEsModule(
  module: EsModule,
  context: Context,
): ResolveResult {
  const path = module.local;

  if (typeof path !== "string") {
    const message = format(Msg.LocalPathNotFound, context);

    throw new Error(message);
  }

  return {
    url: toFileUrl(path),
    mediaType: module.mediaType,
  };
}

function resolveDependency(
  specifier: string,
  module: EsModule,
): Dependency {
  const dep = module.dependencies?.find((dep) => dep.specifier === specifier);

  if (!dep) {
    const message = format(Msg.DependencyNotFound, { specifier });

    throw new Error(message);
  }

  if ("error" in dep.code) throw new Error(dep.code.error);

  return dep;
}

export function resolveEsModuleDependency(
  module: EsModule,
  context: Context,
): ModuleEntry | undefined {
  const dep = resolveDependency(context.specifier, module);

  const mod = dep.npmPackage
    ? {
      kind: "npm",
      npmPackage: dep.npmPackage,
      specifier: context.source.redirects[dep.code.specifier] ??
        dep.code.specifier,
    } satisfies NpmModule
    : context.source.modules.find((module) =>
      module.specifier === dep.code.specifier
    );

  return mod;
}
