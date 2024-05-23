import { createPjsonURL, isObject } from "./utils.ts";
import { Context } from "./npm/cjs/types.ts";
import { findClosest } from "./npm/cjs/utils.ts";
import { require } from "./npm/cjs/require.ts";

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

export async function resolveBrowserMap(
  specifier: string,
  referer: URL | string,
  context: Omit<Context, "specifier" | "resolve"> & { onFalse: () => void },
): Promise<URL> {
  const result = await findClosest(referer, context);

  if (!result || !isObject(result.pjson.browser)) {
    return require(specifier, referer, { ...context, resolve: undefined });
  }

  const browserValue = resolveBrowser(specifier, result.pjson.browser);

  if (!validateBrowserValue(browserValue)) {
    return require(specifier, referer, { ...context, resolve: undefined });
  }

  if (browserValue === false) {
    context.onFalse();

    return require(specifier, referer, { ...context, resolve: undefined });
  }

  return require(browserValue, createPjsonURL(result.packageURL), {
    ...context,
    resolve: undefined,
  });
}
