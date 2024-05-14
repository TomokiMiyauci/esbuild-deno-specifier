export interface LoadResult {
  url: URL;
  format: Format | undefined;
}

export type Format = "builtin" | "commonjs" | "json" | "module" | "wasm";

export type Subpath = `.${string}`;

export interface Context {
  conditions: string[];
}
