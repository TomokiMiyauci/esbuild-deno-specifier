import { join } from "@std/url/join";

import type { Context } from "./types.ts";

export async function loadIndex(
  url: URL | string,
  context: Pick<Context, "existFile" | "readFile" | "root">,
): Promise<URL | undefined> {
  const indexJs = join(url, "index.js");

  // 1. If X/index.js is a file
  if (await context.existFile(indexJs)) {
    // a. Find the closest package scope SCOPE to X.
    // b. If no scope was found, load X/index.js as a CommonJS module. STOP.
    // c. If the SCOPE/package.json contains "type" field,
    // 1. If the "type" field is "module", load X/index.js as an ECMAScript module. STOP.
    // 2. Else, load X/index.js as an CommonJS module. STOP.
    return indexJs;
  }

  const indexJson = join(url, "index.json");
  // 2. If X/index.json is a file, parse X/index.json to a JavaScript object. STOP
  if (await context.existFile(indexJson)) {
    return indexJson;
  }

  const indexNode = join(url, "index.node");
  // 3. If X/index.node is a file, load X/index.node as binary addon. STOP
  if (await context.existFile(indexNode)) {
    return indexNode;
  }
}
