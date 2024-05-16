import type { MediaType, Module, Source } from "../../deps.ts";
import { Context as CjsContext } from "../cjs/types.ts";

export interface Context extends Omit<CjsContext, "getPackageURL"> {
  specifier: string;
  referrer: URL;
  source: Source;
  denoDir: string;
}

export interface DependencyContext extends Context {
  info(specifier: string): Promise<Source> | Source;
}

export interface ResolveResult {
  url: URL;
  mediaType: MediaType;
}

export type DependencyResolveResult = [
  result: ResolveResult | undefined,
  context: ResolveContext,
];

export interface ResolveContext {
  module: Module;
  source: Source | undefined;
}
