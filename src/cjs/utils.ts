import {
  dirname,
  extname,
  normalize,
  type PackageJson,
  pathEqual,
  readPackageJson,
} from "../../deps.ts";
import { loadAsDirectory } from "./load_as_directory.ts";
import { loadAsFile } from "./load_file.ts";
import type { Context, Format, LoadResult } from "./types.ts";

export async function formatFromExt(
  url: URL | string,
  context: Pick<Context, "readFile" | "strategy">,
): Promise<Format | undefined> {
  const ext = extname(url);

  switch (ext) {
    case ".json":
      return "json";
    case ".wasm":
      return "wasm";
    case ".cjs":
      return "commonjs";
    case ".mjs":
      return "module";

    case ".js": {
      const result = await findClosest(url, context);

      return detectFormat(result?.pjson);
    }
  }
}

export function detectFormat(pjson: PackageJson | undefined | null): Format {
  if (!pjson || pjson.type !== "module") return "commonjs";

  return "module";
}

export function concatPath(url: URL | string, path: string): URL {
  url = new URL(url);

  url.pathname = url.pathname + path;

  return url;
}

export async function findClosest(
  url: URL | string,
  context: Pick<Context, "readFile" | "strategy">,
): Promise<{ pjson: PackageJson; packageURL: URL } | undefined> {
  for (const packageURL of getParents(url, context.strategy.root)) {
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

/**
 * @throws {Error}
 */
export async function loadAs(
  url: URL | string,
  context: Pick<
    Context,
    "mainFields" | "resolve" | "existFile" | "readFile" | "strategy"
  >,
): Promise<LoadResult | undefined> {
  //  a. LOAD_AS_FILE(Y + X)
  const fileResult = await loadAsFile(url, context);
  if (fileResult) return fileResult;

  //  b. LOAD_AS_DIRECTORY(Y + X)
  const dirResult = await loadAsDirectory(url, context);

  if (dirResult || dirResult === false) {
    return dirResult || undefined;
  }

  //  c. THROW "not found"
  throw new Error("not found");
}
