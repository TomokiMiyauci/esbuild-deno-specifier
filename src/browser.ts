import { type PackageJson } from "../deps.ts";

export function resolveBrowser(
  specifier: string,
  browser: PackageJson,
) {
  for (
    const key of [
      specifier,
      ...[".js", ".json", ".node"].map((ext) => specifier + ext),
    ]
  ) {
    if (key in browser) {
      return resolveBrowserValue(browser[key]);
    }
  }
}

export function resolveBrowserValue(value: unknown): {
  specifier: string | null;
} | undefined {
  if (value === false) return { specifier: null };

  if (typeof value === "string") return { specifier: value };
}
