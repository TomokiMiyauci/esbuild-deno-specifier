import {
  concatPath,
  detectFormat,
  findClosest,
  formatFromExt,
} from "./utils.ts";
import type { Context, LoadResult } from "./types.ts";

export async function loadAsFile(
  url: URL | string,
  context: Pick<Context, "existFile" | "readFile">,
): Promise<LoadResult | undefined> {
  url = new URL(url);
  // 1. If X is a file, load X as its file extension format. STOP
  if (await context.existFile(url)) {
    const format = await formatFromExt(url, context);

    return { url: new URL(url), format };
  }

  const withJs = concatPath(url, ".js");
  // 2. If X.js is a file,
  if (await context.existFile(withJs)) {
    // a. Find the closest package scope SCOPE to X.
    // b. If no scope was found, load X.js as a CommonJS module. STOP.
    // c. If the SCOPE/package.json contains "type" field,
    // 1. If the "type" field is "module", load X.js as an ECMAScript module. STOP.
    // 2. Else, load X.js as an CommonJS module. STOP.
    const result = await findClosest(url, context);
    const format = detectFormat(result?.pjson);

    return { url: withJs, format };
  }

  const withJson = concatPath(url, ".json");
  // 3. If X.json is a file, load X.json to a JavaScript Object. STOP
  if (await context.existFile(withJson)) {
    return { url: withJson, format: "json" };
  }

  const withNode = concatPath(url, ".node");
  // 4. If X.node is a file, load X.node as binary addon. STOP
  if (await context.existFile(withNode)) {
    return { url: withNode, format: undefined };
  }

  // Skip. This is only Node.js
  // 5. If X.mjs is a file, and `--experimental-require-module` is enabled,
  //    load X.mjs as an ECMAScript module. STOP
}
