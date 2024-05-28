import type { OnLoadResult } from "esbuild";
import * as Path from "@std/path/dirname";
import { dirname } from "@std/url/dirname";
import { toFileUrl } from "@std/path/to-file-url";
import { fromFileUrl } from "@std/path/from-file-url";
import type { PluginData } from "./types.ts";
import { mediaTypeToLoader } from "./utils.ts";

export async function loadDataURL(
  url: URL,
  pluginData: PluginData,
): Promise<OnLoadResult> {
  const result = await fetch(url);
  const contents = await result.text();
  const loader = mediaTypeToLoader(pluginData.mediaType);

  return { contents, loader };
}

export async function loadFileURL(
  url: URL,
  pluginData: PluginData,
  readFile: (url: URL) => Promise<string> | string,
): Promise<OnLoadResult> {
  const contents = await readFile(url);

  const loader = mediaTypeToLoader(pluginData.mediaType);
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

  const loader = mediaTypeToLoader(pluginData.mediaType);
  const resolveDir = Path.dirname(localPath);

  return { contents, loader, pluginData, resolveDir };
}
