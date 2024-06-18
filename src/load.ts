import type { Loader, OnLoadResult } from "esbuild";
import { dirname } from "@std/path/dirname";
import { toFileUrl } from "@std/path/to-file-url";
import { fromFileUrl } from "@std/path/from-file-url";
import type { PluginData } from "./types.ts";
import { mediaTypeToLoader, resolveLongestExt } from "./utils.ts";

export async function loadFileURL(
  fileURL: URL,
  pluginData: PluginData,
  readFile: (url: URL) => Promise<string> | string,
  loaders: Record<string, Loader>,
): Promise<OnLoadResult> {
  const contents = await readFile(fileURL);

  const path = fromFileUrl(fileURL);
  const loader = pluginData.mediaType
    ? mediaTypeToLoader(pluginData.mediaType)
    : resolveLongestExt(path, loaders);
  const resolveDir = dirname(path);

  return { contents, loader, pluginData, resolveDir };
}

export async function loadHttpURL(
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
  const resolveDir = dirname(localPath);

  return { contents, loader, pluginData, resolveDir };
}
