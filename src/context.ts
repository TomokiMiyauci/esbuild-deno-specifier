import { DenoDir, exists } from "../deps.ts";

const cacheForExist = new Map<string, boolean>();

export async function existFile(url: URL | string): Promise<boolean> {
  url = new URL(url);
  const key = url.toString();

  if (cacheForExist.has(key)) {
    // console.log("Cached exist file", key);
    return cacheForExist.get(key)!;
  }

  const result = await exists(url, { isFile: true });

  cacheForExist.set(key, result);

  return result;
}

const cacheForExistDir = new Map<string, boolean>();

export async function existDir(url: URL) {
  const key = url.toString();

  if (cacheForExistDir.has(key)) {
    // console.log("Cached exist dir", key);
    return cacheForExistDir.get(key)!;
  }

  const result = await exists(url, { isDirectory: true });

  cacheForExistDir.set(key, result);

  return result;
}

const cacheForFile = new Map<string, string | null>();

export async function readFile(url: URL): Promise<string | null> {
  const key = url.toString();
  if (cacheForFile.has(key)) return cacheForFile.get(key)!;

  try {
    const value = await Deno.readTextFile(url);

    cacheForFile.set(key, value);

    return value;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      cacheForFile.set(key, null);
      return null;
    }

    if (e instanceof Deno.errors.IsADirectory) {
      cacheForFile.set(key, null);

      return null;
    }

    throw e;
  }
}

export const denoDir = new DenoDir().root;
