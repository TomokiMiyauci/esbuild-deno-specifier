import { type BuildOptions, type ImportKind, type Platform } from "esbuild";

/**
 * @see https://esbuild.github.io/api/#resolve-extensions
 */
const defaultResolveExtensions = [
  ".tsx",
  ".ts",
  ".jsx",
  ".js",
  ".css",
  ".json",
] satisfies string[];

/**
 * @see https://esbuild.github.io/api/#platform
 */
const defaultMainFields = {
  browser: ["browser", "module", "main"],
  node: ["main", "module"],
  neutral: [],
} satisfies { [k in Platform]: string[] };

/**
 * @see https://esbuild.github.io/api/#platform
 */
const defaultPlatform = "browser" satisfies Platform;

export function normalizeResolveExtensions(
  resolveExtensions?: string[],
): string[] {
  return resolveExtensions ?? defaultResolveExtensions;
}

export function resolveMainFields(
  mainFields: string[] | undefined,
  context: { platform: Platform },
): string[] {
  return mainFields ?? defaultMainFields[context.platform];
}

export function normalizePlatform(platform?: Platform): Platform {
  return platform ?? defaultPlatform;
}

export function resolveKind(kind: ImportKind): string | null {
  switch (kind) {
    case "import-statement":
    case "dynamic-import":
    case "entry-point":
      return "import";

    case "require-call":
      return "require";

    default:
      return null;
  }
}

export interface ResolveConditionsContext {
  kind: ImportKind;
  platform: Platform;
}

export function resolveConditions(
  conditions: string[] | undefined,
  context: ResolveConditionsContext,
): string[] {
  const allConditions = new Set<string>(conditions);
  const kind = resolveKind(context.kind);

  if (typeof kind === "string") allConditions.add(kind);

  const platform = resolvePlatform(context.platform);

  if (typeof platform === "string") allConditions.add(platform);

  if (conditions === undefined) allConditions.add("module");

  return [...allConditions];
}

export function resolvePlatform(platForm: Platform): string | null {
  switch (platForm) {
    case "browser":
      return "browser";
    case "node":
      return "node";
    case "neutral":
      return null;
  }
}

export type DependentBuildOptions = Pick<
  BuildOptions,
  | "absWorkingDir"
  | "platform"
  | "mainFields"
  | "resolveExtensions"
  | "conditions"
  | "logLevel"
  | "packages"
>;