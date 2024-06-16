import type { Loader, OnLoadResult } from "esbuild";
import * as Path from "@std/path/dirname";
import { dirname } from "@std/url/dirname";
import { toFileUrl } from "@std/path/to-file-url";
import { fromFileUrl } from "@std/path/from-file-url";
import type { PluginData } from "./types.ts";
import { mediaTypeToLoader, resolveLongestExt } from "./utils.ts";

export async function loadFileURL(
  url: URL,
  pluginData: PluginData,
  readFile: (url: URL) => Promise<string> | string,
  loaders: Record<string, Loader>,
): Promise<OnLoadResult> {
  const contents = await readFile(url);

  const loader = pluginData.mediaType
    ? mediaTypeToLoader(pluginData.mediaType)
    : resolveLongestExt(fromFileUrl(url), loaders) ?? "default";

  const resolveDir = fromFileUrl(dirname(url));

  return { contents, loader, pluginData, resolveDir };
}

export async function loadHttpURL(
  _: unknown,
  pluginData: PluginData,
  readFile: (url: URL) => Promise<string> | string,
): Promise<OnLoadResult> {
  if (pluginData.module.kind !== "esm") {
    throw new Error("unreachable");
  }

  const localPath = pluginData.module.local;

  if (typeof localPath !== "string") {
    throw new Error("local file does not exist");
  }

  const fileUrl = toFileUrl(localPath);
  const contents = await readFile(fileUrl);

  const loader = pluginData.mediaType &&
    mediaTypeToLoader(pluginData.mediaType);
  const resolveDir = Path.dirname(localPath);

  return { contents, loader, pluginData, resolveDir };
}
