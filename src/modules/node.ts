import type { NodeModule } from "../../deps.ts";
import type { ResolveResult } from "./types.ts";

export function resolveNodeModule(
  module: Pick<NodeModule, "moduleName">,
): ResolveResult {
  return {
    url: new URL(`node:${module.moduleName}`),
    mediaType: "Unknown",
  };
}
