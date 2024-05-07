import { DenoDir, exists } from "../deps.ts";

const cacheForExist = new Map<string, boolean>();

export async function existFile(url: URL): Promise<boolean> {
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

export async function readFile(url: URL): Promise<string | null> {
  try {
    return await Deno.readTextFile(url);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return null;
    }

    if (e instanceof Deno.errors.IsADirectory) {
      return null;
    }

    throw e;
  }
}

export const denoDir = new DenoDir().root;
export const mainFields = ["browser", "module", "main"];
