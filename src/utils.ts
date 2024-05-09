import type {
  Format,
  MediaType,
  OnResolveArgs,
  Platform,
  ResolveOptions,
} from "../deps.ts";
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
  subpath: `.${string}`;
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
