import { join } from "../../deps.ts";
import { existFile } from "../context.ts";
import { detectFormat, findClosest } from "./utils.ts";
import type { LoadResult } from "./types.ts";

export async function loadIndex(
  X: URL | string,
): Promise<LoadResult | undefined> {
  const indexJs = join(X, "index.js");

  // 1. If X/index.js is a file
  if (await existFile(indexJs)) {
    // a. Find the closest package scope SCOPE to X.
    // b. If no scope was found, load X/index.js as a CommonJS module. STOP.
    // c. If the SCOPE/package.json contains "type" field,
    // 1. If the "type" field is "module", load X/index.js as an ECMAScript module. STOP.
    // 2. Else, load X/index.js as an CommonJS module. STOP.
    const result = await findClosest(X);
    const format = detectFormat(result?.pjson);

    return { url: indexJs, format };
  }

  const indexJson = join(X, "index.json");
  // 2. If X/index.json is a file, parse X/index.json to a JavaScript object. STOP
  if (await existFile(indexJson)) {
    return { url: indexJson, format: "json" };
  }

  const indexNode = join(X, "index.node");
  // 3. If X/index.node is a file, load X/index.node as binary addon. STOP
  if (await existFile(indexNode)) {
    return { url: indexNode, format: undefined };
  }
}
