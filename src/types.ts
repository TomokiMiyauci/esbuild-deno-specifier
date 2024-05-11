import type { MediaType, Module, PackageJson, Source } from "../deps.ts";

export interface PluginData {
  module: Module;
  source: Source;
  mediaType: MediaType;
}

export interface NpmContext {
  pjson: PackageJson | null;
  packageURL: URL;
}
