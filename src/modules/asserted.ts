import { type AssertedModule, format, toFileUrl } from "../../deps.ts";
import { Context, ResolveResult } from "./types.ts";
import { Msg } from "../constants.ts";

export function resolveAssertedModule(
  module: AssertedModule,
  context: Context,
): ResolveResult {
  const path = module.local;

  if (typeof path !== "string") {
    const message = format(Msg.LocalPathNotFound, context);

    throw new Error(message);
  }

  return {
    url: toFileUrl(path),
    mediaType: module.mediaType,
  };
}
