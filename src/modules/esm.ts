import type { PluginData } from "../types.ts";
import {
  type Dependency,
  type EsmModule,
  type OnResolveResult,
  type Source,
} from "../../deps.ts";

export function resolveEsmModule(
  module: EsmModule,
  source: Source,
): OnResolveResult {
  const path = module.local;

  if (!path) throw new Error();

  const pluginData = {
    mediaType: module.mediaType,
    module,
    source,
  } satisfies PluginData;

  return { path, namespace: "deno", pluginData };
}

export function resolveDependency(
  specifier: string,
  module: EsmModule,
): Dependency {
  const dep = module.dependencies?.find((dep) => dep.specifier === specifier);

  if (!dep) throw new Error();
  if ("error" in dep.code) throw new Error(dep.code.error);

  return dep;
}
