import type { Context } from "./types.ts";
import { createPjsonURL } from "../../utils.ts";
import { dirname } from "@std/url/dirname";
export async function lookupPackageScope(
  url: URL | string,
  context: Pick<Context, "existFile" | "root">,
): Promise<URL | null> {
  // Let scopeURL be url.
  let scopeURL = new URL(url);

  // While scopeURL is not the file system root,
  while (scopeURL.pathname !== context.root.pathname) {
    const before = scopeURL.pathname;
    // Set scopeURL to the parent URL of scopeURL.
    scopeURL = dirname(scopeURL);
    const after = scopeURL.pathname;

    // Loop safe
    if (before === after) return null;

    // If scopeURL ends in a "node_modules" path segment, return null.
    if (scopeURL.pathname.endsWith("node_modules")) return null;

    // Let pjsonURL be the resolution of "package.json" within scopeURL.
    const pjsonURL = createPjsonURL(scopeURL);

    // if the file at pjsonURL exists, then
    if (await context.existFile(pjsonURL)) {
      // Return scopeURL.
      return scopeURL;
    }
  }

  return null;
}
