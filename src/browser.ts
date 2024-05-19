import { join, type PackageJson } from "../deps.ts";
import { isObject } from "./utils.ts";

export function resolveBrowser<T>(
  specifier: string,
  browser: Record<string, T>,
): T | undefined {
  for (const key of getCandidates(specifier)) {
    if (key in browser) return browser[key];
  }
}

export function* getCandidates(specifier: string): Generator<string> {
  const specifiers = [specifier];

  if (!specifier.startsWith("./")) specifiers.push("./" + specifier);

  for (const specifier of specifiers) yield specifier;

  const withExtensions = extensions.flatMap((ext) =>
    specifiers.map((specifier) => specifier + ext)
  );

  for (const specifier of withExtensions) yield specifier;
}

const extensions = [".js", ".json", ".node"];

export type BrowserValue = string | false;

export function validateBrowserValue(input: unknown): input is BrowserValue {
  if (typeof input === "string" || input === false) return true;

  return false;
}

export function resolveBrowserMap(
  path: string,
  args: { pjson: PackageJson; packageURL: URL },
): false | URL | undefined {
  if (args.pjson) {
    if (isObject(args.pjson.browser)) {
      const browserValue = resolveBrowser(path, args.pjson.browser);

      if (!validateBrowserValue(browserValue)) return;

      if (browserValue === false) return false;

      return join(args.packageURL, browserValue);
    }
  }
}
