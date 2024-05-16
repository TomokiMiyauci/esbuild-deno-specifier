import { type PackageJson } from "../../deps.ts";
import type { Subpath } from "../types.ts"

export interface LoadResult {
  url: URL;
  format: Format | undefined;
}

export type Format = "builtin" | "commonjs" | "json" | "module" | "wasm";

export interface Context {
  conditions: string[];
  mainFields: string[];
  getPackageURL(pkg: { name: string; subpath: Subpath }): Promise<URL> | URL;
  resolve?(
    path: string,
    args: { packageURL: URL | string; pjson: PackageJson },
  ): Promise<URL | undefined | false> | URL | undefined | false;
}
