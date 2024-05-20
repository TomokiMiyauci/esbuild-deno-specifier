import { type PackageJson } from "../../deps.ts";
import { Strategy } from "../strategy.ts";
import type { IO, Subpath } from "../types.ts";

export interface LoadResult {
  url: URL;
  format: Format | undefined;
}

export type Format = "builtin" | "commonjs" | "json" | "module" | "wasm";

export interface Context extends IO {
  conditions: string[];
  mainFields: string[];
  resolve?(
    path: string,
    args: { packageURL: URL | string; pjson: PackageJson },
  ): Promise<URL | undefined | false> | URL | undefined | false;
  nodeModulesPaths(
    args: { name: string; subpath: Subpath },
  ): AsyncIterable<URL> | Iterable<URL>;
  strategy: Strategy;
  specifier: string;
}
