import { toFileUrl } from "@std/path/to-file-url";
import { join } from "@std/url/join";
import type { OnResolveArgs } from "esbuild";
import { isAbsolute } from "@std/path/is-absolute";
import { basename } from "@std/path/basename";

export type ResolveReferrerArgs = Pick<
  OnResolveArgs,
  "importer" | "namespace" | "path" | "resolveDir"
>;

/**
 * @throws {Error}
 */
export function resolveReferrer(
  args: ResolveReferrerArgs,
): URL {
  const { namespace, importer, resolveDir } = args;

  if (namespace === "file") return toFileUrl(importer);

  const urlLike = URL.parse(importer);

  if (urlLike) return urlLike;

  if (isAbsolute(resolveDir)) {
    const baseUrl = toFileUrl(resolveDir);
    const basename = resolveBaseName(args);

    return join(baseUrl, basename);
  }

  if (isStdinInput(args)) {
    throw new Error("Specify an absolute path for `stdin.resolveDir`");
  }

  throw new Error("`importer`, `resolveDir` or `namespace` is invalid");
}

const STDIN = "<stdin>";

function isStdinInput(args: ResolveReferrerArgs): boolean {
  const { importer, namespace } = args;

  return importer === STDIN && !namespace;
}

function resolveBaseName(args: ResolveReferrerArgs): string {
  if (args.importer === STDIN) return "stdin";

  return basename(args.path);
}
