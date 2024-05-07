import type { PluginData } from "../types.ts";
import {
  type AssertedModule,
  type OnResolveResult,
  type Source,
} from "../../deps.ts";

export function resolveAssertedModule(
  module: AssertedModule,
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
