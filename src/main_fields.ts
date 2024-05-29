import { type Platform } from "esbuild";

/**
 * @see https://esbuild.github.io/api/#platform
 */
export const defaultMainFields = {
  browser: ["browser", "module", "main"],
  node: ["main", "module"],
  neutral: [],
} satisfies { [k in Platform]: string[] };

export function resolveMainFields(
  mainFields: string[] | undefined,
  context: { platform: Platform },
): string[] {
  if (mainFields) return mainFields;

  return defaultMainFields[context.platform];
}
