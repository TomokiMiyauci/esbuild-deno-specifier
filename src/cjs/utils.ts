import {
  dirname,
  extname,
  type PackageJson,
  readPackageJson,
} from "../../deps.ts";
import { loadAsDirectory } from "./load_as_directory.ts";
import { loadAsFile } from "./load_file.ts";
import type { Context, Format, LoadResult } from "./types.ts";

export async function formatFromExt(
  url: URL | string,
  context: Pick<Context, "readFile">,
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
  context: Pick<Context, "readFile">,
): Promise<{ pjson: PackageJson; packageURL: URL } | undefined> {
  for (const packageURL of parents(url)) {
    const pjson = await readPackageJson(packageURL, context);

    if (pjson) {
      return { pjson, packageURL };
    }
  }
}

function* parents(url: URL | string): Iterable<URL> {
  const pathname = new URL(url).pathname;
  const dir = dirname(url);

  if (dir.pathname !== pathname) {
    yield dir;
    yield* parents(dir);
  }
}

/**
 * @throws {Error}
 */
export async function loadAs(
  url: URL | string,
  context: Pick<Context, "mainFields" | "resolve" | "existFile" | "readFile">,
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
