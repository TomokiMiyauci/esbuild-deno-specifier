import { type Strategy } from "../../strategy.ts";
import type { IO, Subpath } from "../../types.ts";

export type Format = "commonjs" | "json" | "module" | "wasm";

export interface Context extends IO, Pick<Strategy, "root"> {
  conditions: string[];
  mainFields: string[];
  resolve?(
    specifier: string,
    referrer: URL | string,
    context: Context,
  ): Promise<URL> | URL;
  getPackageURL(
    name: string,
    subpath: Subpath,
  ): Promise<URL | null> | URL | null;
}

export interface ResolveArgs {
  specifier: string;
  referrer: URL | string;
}
