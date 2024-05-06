import { globToRegExp, joinGlobs } from "jsr:@std/path@0.225.0";

export type SideEffects = boolean | string[];
export type Path = string;

export function normalizeSideEffects(
  sideEffects: SideEffects,
  packagePath: Path,
): SideEffects {
  if (typeof sideEffects === "boolean") return sideEffects;

  return sideEffects.map((sideEffect) => {
    return joinGlobs([packagePath, sideEffect]);
  });
}

/** Validate the {@link input} is valid as `sideEffects` value or not. */
export function validateSideEffects(input: unknown): input is SideEffects {
  if (typeof input === "boolean") return true;

  if (Array.isArray(input) && input.every((v) => typeof v === "string")) {
    return true;
  }

  return false;
}

export function matchSideEffects(
  sideEffects: SideEffects,
  path: Path,
): boolean {
  if (typeof sideEffects === "boolean") return sideEffects;

  for (const sideEffect of sideEffects.map((v) => globToRegExp(v))) {
    if (sideEffect.test(path)) return true;
  }

  return false;
}
