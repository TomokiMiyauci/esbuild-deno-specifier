import {
  dirname,
  extname,
  type PackageJson,
  readPackageJson,
} from "../../deps.ts";
import { readFile } from "../context.ts";
import type { Format } from "./types.ts";

export async function formatFromExt(
  url: URL | string,
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
      const result = await findClosest(url);

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
): Promise<{ pjson: PackageJson; packageURL: URL } | undefined> {
  for (const packageURL of parents(url)) {
    const pjson = await readPackageJson(packageURL, { readFile });

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
