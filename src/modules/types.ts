import type { MediaType, Module, Source } from "../../deps.ts";
import { Context as CjsContext } from "../npm/cjs/types.ts";
import { Strategy } from "../strategy.ts";

export interface Context
  extends Omit<CjsContext, "getPackageURL">, Pick<Strategy, "getPackageURL"> {
  specifier: string;
  referrer: URL;
  source: Source;
  realURL?(url: URL): Promise<URL | null | undefined> | URL | null | undefined;
}

export interface DependencyContext extends Context {
  info(specifier: string): Promise<Source> | Source;
}

export interface ResolveResult {
  url: URL;
  mediaType: MediaType;
  sideEffects: boolean | undefined;
}

export interface DependencyResolveResult
  extends ResolveResult, ResolveContext {}

export interface ResolveContext {
  module: Module;
  source: Source | undefined;
}
