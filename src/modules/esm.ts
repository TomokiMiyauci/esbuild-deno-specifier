import { type EsModule, format, toFileUrl } from "../../deps.ts";
import { Msg } from "../constants.ts";
import type { Context, ResolveResult } from "./types.ts";

/**
 * @throws {Error} If module.local is not string
 */
export function resolveEsModule(
  module: Pick<EsModule, "local" | "mediaType">,
  context: Pick<Context, "specifier">,
): ResolveResult {
  const path = module.local;

  if (typeof path !== "string") {
    const message = format(Msg.LocalPathNotFound, context);

    throw new Error(message);
  }

  const url = toFileUrl(path);

  return { url, mediaType: module.mediaType };
}
