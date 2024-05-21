import { type Strategy } from "../strategy.ts";
import type { IO, Subpath } from "../types.ts";

export type Format = "commonjs" | "json" | "module" | "wasm";

export interface Context extends IO, Pick<Strategy, "root"> {
  conditions: string[];
  mainFields: string[];
  resolve?(
    specifier: string,
    referrer: URL | string,
    context: Omit<Context, "specifier">,
  ): Promise<URL> | URL;
  nodeModulesPaths(
    args: { name: string; subpath: Subpath },
  ): AsyncIterable<URL> | Iterable<URL>;
  specifier: string;
}
