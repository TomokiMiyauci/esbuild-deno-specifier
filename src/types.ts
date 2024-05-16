import type { MediaType, Module, Source } from "../deps.ts";

export interface PluginData {
  module: Module;
  source: Source;
  mediaType: MediaType;
}

export type Subpath = `.${string}`;

export interface DataPluginData {
  mediaType: MediaType;
}

export interface IO {
  existFile(url: URL): Promise<boolean> | boolean;
  existDir(url: URL): Promise<boolean> | boolean;
  readFile(ur: URL): Promise<string | null> | string | null;
}
