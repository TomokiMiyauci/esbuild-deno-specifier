import { format } from "../../deps.ts";
import { formatFromExt } from "./utils.ts";
import type { Context, LoadResult } from "./types.ts";
import { Msg } from "../constants.ts";

/**
 * @throws {Error}
 */
export async function resolveEsmMatch(
  url: URL | string,
  context: Pick<Context, "existFile" | "readFile" | "root" | "specifier">,
): Promise<LoadResult> {
  url = new URL(url);
  // 1. let RESOLVED_PATH = fileURLToPath(MATCH)
  // 2. If the file at RESOLVED_PATH exists, load RESOLVED_PATH as its extension
  //    format. STOP
  if (await context.existFile(url)) {
    const format = await formatFromExt(url, context);

    return { url, format };
  }

  const message = format(Msg.NotFound, { specifier: context.specifier });
  // 3. THROW "not found"
  throw new Error(message);
}
