import { existFile } from "../context.ts";
import { concatPath, findClosest, formatFromExt } from "./utils.ts";
import type { LoadResult } from "./types.ts";

export async function loadAsFile(
  url: URL | string,
): Promise<LoadResult | undefined> {
  // 1. If X is a file, load X as its file extension format. STOP
  if (await existFile(url)) {
    const format = await formatFromExt(url);

    return { url: new URL(url), format };
  }

  const withJs = concatPath(url, ".js");
  // 2. If X.js is a file,
  if (await existFile(withJs)) {
    // a. Find the closest package scope SCOPE to X.
    const result = await findClosest(url);

    // b. If no scope was found, load X.js as a CommonJS module. STOP.
    if (!result) {
      return { url: withJs, format: "commonjs" };
    }

    // c. If the SCOPE/package.json contains "type" field,
    if ("type" in result.pjson) {
      // 1. If the "type" field is "module", load X.js as an ECMAScript module. STOP.
      if (result.pjson.type === "module") {
        return { url: withJs, format: "module" };
      }
    }

    // 2. Else, load X.js as an CommonJS module. STOP.
    return { url: withJs, format: "commonjs" };
  }

  const withJson = concatPath(url, ".json");
  // 3. If X.json is a file, load X.json to a JavaScript Object. STOP
  if (await existFile(withJson)) return { url: withJson, format: "json" };

  const withNode = concatPath(url, ".node");
  // 4. If X.node is a file, load X.node as binary addon. STOP
  if (await existFile(withNode)) {
    return { url: withNode, format: undefined };
  }

  // Skip. This is only Node.js
  // 5. If X.mjs is a file, and `--experimental-require-module` is enabled,
  //    load X.mjs as an ECMAScript module. STOP
}