import type { PluginData } from "../types.ts";
import { type AssertedModule, type OnResolveResult } from "../../deps.ts";
import { Namespace } from "../constants.ts";
import { Context } from "./types.ts";

export function resolveAssertedModule(
  module: AssertedModule,
  context: Context,
): OnResolveResult {
  const path = module.local;

  if (!path) throw new Error();

  const pluginData = {
    mediaType: module.mediaType,
    module,
    source: context.source,
  } satisfies PluginData;

  return { path, namespace: Namespace.Deno, pluginData };
}
