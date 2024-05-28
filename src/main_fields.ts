import { type Platform } from "esbuild";
import { normalizePlatform } from "./utils.ts";

/**
 * @see https://esbuild.github.io/api/#platform
 */
export const defaultMainFields = {
  browser: ["browser", "module", "main"],
  node: ["main", "module"],
  neutral: [],
} satisfies { [k in Platform]: string[] };

export function resolveMainFields(
  args: { platform?: Platform; mainFields?: string[] },
): string[] {
  if (args.mainFields) return args.mainFields;

  const platform = normalizePlatform(args.platform);

  return defaultMainFields[platform];
}
