import {
  dirname,
  normalize,
  type PackageJson,
  pathEqual,
  readPackageJson,
} from "../../../deps.ts";
import type { Context } from "./types.ts";

export function concatPath(url: URL | string, path: string): URL {
  url = new URL(url);

  url.pathname = url.pathname + path;

  return url;
}

export async function findClosest(
  url: URL | string,
  context: Pick<Context, "readFile" | "root">,
): Promise<{ pjson: PackageJson; packageURL: URL } | undefined> {
  for (const packageURL of getParents(url, context.root)) {
    const pjson = await readPackageJson(packageURL, context);

    if (pjson) {
      return { pjson, packageURL };
    }
  }
}

export function* getParents(
  url: URL | string,
  root: URL | string,
): Generator<URL> {
  url = new URL(url);
  root = new URL(root);

  const rootPath = root.pathname;

  if (
    root.protocol !== url.protocol ||
    !isSubpath(rootPath, url.pathname)
  ) return;

  while (!pathEqual(url.pathname, rootPath)) {
    const parentURL = dirname(url);

    if (parentURL.pathname === url.pathname) {
      return;
    }

    yield parentURL;

    url = parentURL;
  }
}

export function isSubpath(parent: string, child: string): boolean {
  parent = normalize(parent);
  child = normalize(child);

  return parent === child || child.startsWith(parent);
}
