import type { NodeModule } from "../../deps.ts";
import type { ResolveResult } from "./types.ts";

export function resolveNodeModule(module: NodeModule): ResolveResult {
  return {
    url: new URL(`node:${module.moduleName}`),
    mediaType: "Unknown",
  };
}
