import type { NodeModule, OnResolveResult } from "../../deps.ts";

export function resolveNodeModule(module: NodeModule): OnResolveResult {
  return { external: true, path: module.specifier };
}
