import { toFileUrl } from "@std/path/to-file-url";
import { exists } from "@std/fs/exists";

export function existFile(url: URL): Promise<boolean> {
  return exists(url, { isFile: true });
}

export function existDir(url: URL): Promise<boolean> {
  return exists(url, { isDirectory: true });
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

export async function realURL(url: URL): Promise<URL | undefined> {
  try {
    const path = await Deno.realPath(url);

    return toFileUrl(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return;
    }

    throw e;
  }
}
