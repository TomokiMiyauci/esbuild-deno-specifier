import { exists } from "../dev_deps.ts";

export function existFile(url: URL): Promise<boolean> {
  return exists(url, { isFile: true });
}

export function existDir(url: URL): Promise<boolean> {
  return exists(url, { isDirectory: true });
}

export async function readFile(url: URL): Promise<string | null> {
  try {
    const value = await Deno.readTextFile(url);

    return value;
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
