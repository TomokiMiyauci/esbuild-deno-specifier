import type { MediaType, Source } from "../../deps.ts";

export interface Context {
  specifier: string;
  referrer: string;
  conditions: string[];
  source: Source;
}

export interface ResolveResult {
  url: URL;
  mediaType: MediaType;
}
