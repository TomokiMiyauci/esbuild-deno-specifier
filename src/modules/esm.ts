import type { PluginData } from "../types.ts";
import {
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
