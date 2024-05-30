import { concatPath } from "./utils.ts";
import type { Context } from "./types.ts";

const defaultExtensions = [".js", ".json", ".node"];

export async function loadAsFile(
  url: URL | string,
  context: Pick<Context, "existFile" | "readFile" | "root" | "extensions">,
): Promise<URL | undefined> {
  url = new URL(url);

  // 1. If X is a file, load X as its file extension format. STOP
  if (await context.existFile(url)) return url;

  const extensions = context.extensions ?? defaultExtensions;

  for (const ext of extensions) {
    const withExt = concatPath(url, ext);

    if (await context.existFile(withExt)) return withExt;
  }
}
