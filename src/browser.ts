import { join, type PackageJson } from "../deps.ts";
import { isObject } from "./utils.ts";

export function resolveBrowser(
  specifier: string,
  browser: PackageJson,
) {
  for (
    const key of [
      specifier,
      ...extensions.map((ext) => specifier + ext),
    ]
  ) {
    if (key in browser) {
      return resolveBrowserValue(browser[key]);
    }
  }
}

const extensions = [".js", ".json", ".node"];

export function resolveBrowserValue(value: unknown): {
  specifier: string | null;
} | undefined {
  if (value === false) return { specifier: null };

  if (typeof value === "string") return { specifier: value };
}

export function resolveBrowserMap(
  path: string,
  args: { pjson: PackageJson; packageURL: URL },
): false | URL | undefined {
  if (args.pjson) {
    if (isObject(args.pjson.browser)) {
      const result = resolveBrowser(path, args.pjson.browser);

      if (result) {
        if (result.specifier === null) {
          return false;
        }

        return join(args.packageURL, result.specifier);
      }
    }
  }
}
