import { type ImportKind, type Platform } from "../deps.ts";

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

export function resolveConditions(
  args: {
    kind: ImportKind;
    platform?: Platform;
    conditions?: string[];
  },
): string[] {
  const conditions = new Set<string>();
  const kind = resolveKind(args.kind);

  if (typeof kind === "string") conditions.add(kind);

  const platform = resolvePlatform(args.platform ?? "browser");

  if (typeof platform === "string") conditions.add(platform);

  if (args.conditions === undefined) conditions.add("module");

  return [...conditions];
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
