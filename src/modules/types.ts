import type { NpmContext } from "../types.ts";
import type { Source } from "../../deps.ts";

export interface Context {
  specifier: string;
  referrer: string;
  conditions: string[];
  source: Source;
  npm?: NpmContext;
}
