import { type ImportKind, type Platform } from "esbuild";

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
