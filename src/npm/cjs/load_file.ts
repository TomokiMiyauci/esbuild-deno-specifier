import { concatPath } from "./utils.ts";
import type { Context } from "./types.ts";

export async function loadAsFile(
  url: URL | string,
  context: Pick<Context, "existFile" | "readFile" | "root">,
): Promise<URL | undefined> {
  url = new URL(url);

  // 1. If X is a file, load X as its file extension format. STOP
  if (await context.existFile(url)) return url;

  const withJs = concatPath(url, ".js");
  // 2. If X.js is a file,
  if (await context.existFile(withJs)) {
    // a. Find the closest package scope SCOPE to X.
    // b. If no scope was found, load X.js as a CommonJS module. STOP.
    // c. If the SCOPE/package.json contains "type" field,
    // 1. If the "type" field is "module", load X.js as an ECMAScript module. STOP.
    // 2. Else, load X.js as an CommonJS module. STOP.
    return withJs;
  }

  const withJson = concatPath(url, ".json");
  // 3. If X.json is a file, load X.json to a JavaScript Object. STOP
  if (await context.existFile(withJson)) {
    return withJson;
  }

  const withNode = concatPath(url, ".node");
  // 4. If X.node is a file, load X.node as binary addon. STOP
  if (await context.existFile(withNode)) {
    return withNode;
  }

  // Skip. This is only Node.js
  // 5. If X.mjs is a file, and `--experimental-require-module` is enabled,
  //    load X.mjs as an ECMAScript module. STOP
}
