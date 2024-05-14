import { existFile } from "../context.ts";
import { formatFromExt } from "./utils.ts";
import type { LoadResult } from "./types.ts";

export async function resolveEsmMatch(url: URL): Promise<LoadResult> {
  // 1. let RESOLVED_PATH = fileURLToPath(MATCH)
  // 2. If the file at RESOLVED_PATH exists, load RESOLVED_PATH as its extension
  //    format. STOP
  if (await existFile(url)) {
    const format = await formatFromExt(url);

    return { url: url, format };
  }

  // 3. THROW "not found"
  throw new Error("not found");
}
