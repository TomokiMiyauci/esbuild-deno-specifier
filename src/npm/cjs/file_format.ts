import { readPackageJson } from "@miyauci/node-esm-resolver";
import { extname } from "@std/url/extname";
import { lookupPackageScope } from "./lookup_package_scope.ts";
import type { Context, Format } from "./types.ts";

export async function fileFormat(
  url: URL | string,
  context: Pick<Context, "existFile" | "readFile" | "root">,
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
      const packageURL = await lookupPackageScope(url, context);

      if (!packageURL) return "commonjs";

      const pjson = await readPackageJson(packageURL, context);

      if (pjson?.type === "module") return "module";

      return "commonjs";
    }
  }
}
