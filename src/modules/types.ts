import type { MediaType, Source } from "../../deps.ts";
import { Context as CjsContext } from "../cjs/types.ts";

export interface Context extends Omit<CjsContext, "getPackageURL"> {
  specifier: string;
  referrer: URL;
  source: Source;
}

export interface ResolveResult {
  url: URL;
  mediaType: MediaType;
}
