import type {
  Format,
  MediaType,
  OnResolveArgs,
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
