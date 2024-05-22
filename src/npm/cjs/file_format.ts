import { extname } from "../../../deps.ts";
import type { Context, Format } from "./types.ts";
import { findClosest } from "./utils.ts";

export async function fileFormat(
  url: URL | string,
  context: Pick<Context, "readFile" | "root">,
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

    default: {
      const result = await findClosest(url, context);

      if (result?.pjson.type === "module") return "module";

      return "commonjs";
    }
  }
}
