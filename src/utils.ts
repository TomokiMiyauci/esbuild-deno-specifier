import { type MediaType } from "@deno/info";
import { toFileUrl } from "@std/path/to-file-url";
import { join } from "@std/url/join";
import { getLogger } from "@std/log/get-logger";
import { runningReduce } from "@std/collections/running-reduce";
import { extname } from "@std/path/extname";
import { type Logger } from "@std/log/logger";

import type { Loader } from "esbuild";
import type { Subpath } from "./types.ts";

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" &&
    value.constructor === Object;
}

export type LikePath = AbsolutePath | RelativePath;

type RelativePath = `../${string}` | `./${string}`;

type AbsolutePath = `/${string}`;

export function isLikePath(input: string): input is LikePath {
  return /^\.\.\/|^\.\/|^\//.test(input);
}

export interface Package {
  name: string;
  subpath: Subpath;
}

export function parseNpmPkg(specifier: string): Package {
  const index = specifier.startsWith("@")
    ? secondIndexOf(specifier, "/")
    : specifier.indexOf("/");

  const name = index === -1 ? specifier : specifier.slice(0, index);

  return {
    name,
    subpath: `.${specifier.slice(name.length)}`,
  };
}

function secondIndexOf(input: string, searchString: string): number {
  const firstIndex = input.indexOf(searchString);

  if (firstIndex === -1) return -1;

  return input.indexOf(searchString, firstIndex + 1);
}

export function mediaTypeToLoader(mediaType: MediaType): Loader {
  switch (mediaType) {
    case "Cjs":
    case "Mjs":
    case "JavaScript":
      return "js";
    case "Mts":
    case "Cts":
    case "Dcts":
    case "Dmts":
    case "Dts":
    case "TypeScript":
      return "ts";
    case "JSX":
      return "jsx";
    case "TSX":
      return "tsx";
    case "Json":
      return "json";
    default:
      return "default";
  }
}

export function logger(): Logger {
  return getLogger("deno");
}

export function memo<Arg, R>(
  fn: (arg: Arg) => Promise<R>,
  cache: Map<string, R> = new Map(),
): (arg: Arg) => Promise<R> {
  return async (arg) => {
    const key = String(arg);

    if (cache.has(key)) return cache.get(key)!;

    const result = await fn(arg);

    cache.set(key, result);

    return result;
  };
}

export function createNpmRegistryURL(denoDir: string): URL {
  const denoDirURL = toFileUrl(denoDir);

  return join(denoDirURL, "npm", "registry.npmjs.org");
}

export function createPjsonURL(packageURL: URL | string): URL {
  return join(packageURL, "package.json");
}

/**
 * @param path
 * @returns
 */
export function* splitExts(path: string): Generator<string> {
  const ext = extname(path);

  if (!ext) return;

  yield ext;

  path = path.slice(0, path.length - ext.length);

  yield* splitExts(path);
}

/** Resolve path extension with longest match. */
export function resolveLongestExt<T>(
  path: string,
  record: Record<string, T>,
): T | undefined {
  const allExts = getAllExtensions(path);

  for (const ext of allExts) if (ext in record) return record[ext];
}

export function getAllExtensions(path: string): string[] {
  const partOfExts = [...splitExts(path)];
  const allExts = runningReduce(
    partOfExts,
    (acc, current) => current + acc,
    "",
  ).reverse();

  return allExts;
}
