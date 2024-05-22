import {
  getLogger,
  join,
  type Loader,
  type Logger,
  type MediaType,
  type OnResolveArgs,
  type Platform,
  type ResolveOptions,
  toFileUrl,
} from "../deps.ts";
import { type Format } from "./npm/cjs/types.ts";
import type { Subpath } from "./types.ts";
export function argsToOptions(args: OnResolveArgs): ResolveOptions {
  return {
    importer: args.importer,
    kind: args.kind,
    resolveDir: args.resolveDir,
    namespace: args.namespace,
    pluginData: args.pluginData,
  };
}

export function formatToMediaType(format: Format): MediaType {
  switch (format) {
    case "commonjs":
      return "Cjs";
    case "module":
      return "Mjs";
    case "json":
      return "Json";
    case "wasm":
      return "Wasm";
  }
}

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

export function normalizePlatform(platform?: Platform): Platform {
  return platform ?? "browser";
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
