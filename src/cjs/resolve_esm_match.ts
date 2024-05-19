import { formatFromExt } from "./utils.ts";
import type { Context, LoadResult } from "./types.ts";

/**
 * @throws {Error}
 */
export async function resolveEsmMatch(
  url: URL | string,
  context: Pick<Context, "existFile" | "readFile" | "strategy">,
): Promise<LoadResult> {
  url = new URL(url);
  // 1. let RESOLVED_PATH = fileURLToPath(MATCH)
  // 2. If the file at RESOLVED_PATH exists, load RESOLVED_PATH as its extension
  //    format. STOP
  if (await context.existFile(url)) {
    const format = await formatFromExt(url, context);

    return { url, format };
  }

  // 3. THROW "not found"
  throw new Error("not found");
}
