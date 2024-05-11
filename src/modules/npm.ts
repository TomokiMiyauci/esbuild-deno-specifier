import {
  esmFileFormat,
  type Format,
  format,
  fromFileUrl,
  join,
  type MediaType,
  type NpmModule,
  type OnResolveResult,
  packageExportsResolve,
  type PackageJson,
  readPackageJson,
  type Source,
  toFileUrl,
} from "../../deps.ts";
import { formatToMediaType, isLikePath, parseNpmPkg } from "../utils.ts";
import type { PluginData } from "../types.ts";
import { denoDir, existDir, existFile, readFile } from "../context.ts";
import {
  matchSideEffects,
  normalizeSideEffects,
  validateSideEffects,
} from "../side_effects.ts";
import type { Context } from "./types.ts";
import { isBuiltin } from "node:module";
import { Msg, Namespace } from "../constants.ts";
import { loadAsDirectory, loadAsFile } from "../require.ts";

export async function resolveNpmModule(
  module: NpmModule,
  context: Context,
): Promise<OnResolveResult> {
  const { url, pjson, format, packageURL } = await npmResolve(
    module,
    context,
  );

  if (!url) {
    const path = isLikePath(context.specifier)
      ? fromFileUrl(join(packageURL, context.specifier))
      : context.specifier;

    return { path, namespace: Namespace.Disabled };
  }

  const mediaType: MediaType = format ? formatToMediaType(format) : "Unknown";
  const pluginData = {
    module,
    source: context.source,
    mediaType,
  } satisfies PluginData;
  const path = fromFileUrl(url);
  const sideEffects = resolveSideEffects(
    pjson?.sideEffects,
    fromFileUrl(packageURL),
    path,
  );

  return { path, namespace: Namespace.Deno, sideEffects, pluginData };
}

export interface NpmResult {
  url: URL | null;
  pjson: PackageJson | null;
  format: Format | null;
  packageURL: URL;
}

export async function npmResolve(
  module: NpmModule,
  context: Context,
): Promise<NpmResult> {
  const npm = context.source.npmPackages[module.npmPackage];

  if (!npm) throw new Error("npm not found");

  const { name, version } = npm;

  const npmSpecifier = `npm:/${name}@${version}`;
  const subpath = module.specifier.slice(npmSpecifier.length);
  const packageSubpath = `.${subpath}` as const;

  const packageURL = createPackageURL(denoDir, name, version);

  if (!await existDir(packageURL)) {
    throw new Error();
  }

  const pjson = await readPackageJson(packageURL, { readFile });
  const result = await resolveNodeModules(
    packageURL,
    pjson,
    packageSubpath,
    context,
  );

  if (result === undefined) {
    throw new Error();
  }

  const format = result && await esmFileFormat(result, { existFile, readFile });

  return {
    url: result || null,
    pjson,
    format: format || null,
    packageURL,
  };
}

function resolveNodeModules(
  packageURL: URL,
  pjson: PackageJson | null,
  subpath: `.${string}`,
  context: Context,
): Promise<URL | undefined | false> | URL | undefined | false {
  const isEsModule = pjson?.type === "module";

  return isEsModule
    ? resolveEsmPackage(packageURL, pjson, subpath, context)
    : resolveCjsPackage(packageURL, pjson, subpath, context);
}

async function resolveEsmPackage(
  packageURL: URL,
  pjson: PackageJson | null,
  subpath: `.${string}`,
  context: Context,
) {
  if (pjson && pjson.exports) {
    return packageExportsResolve(
      packageURL,
      subpath,
      pjson.exports,
      context.conditions,
      {
        existDir,
        existFile,
        readFile,
      },
    );
  }

  if (pjson && "browser" in pjson) {
    if (typeof pjson.browser === "string") {
      const url = join(packageURL, pjson.browser);

      if (await existFile(url)) return url;
    }
  }

  throw new Error("ESM");
}

async function resolveCjsPackage(
  packageURL: URL,
  pjson: PackageJson | null,
  subpath: `.${string}`,
  context: Context,
): Promise<URL | undefined | false> {
  if (pjson && "exports" in pjson) {
    return packageExportsResolve(
      packageURL,
      subpath,
      pjson.exports,
      context.conditions,
      { existDir, existFile, readFile },
    );
  }

  const url = join(packageURL, subpath);

  const fileResult = await loadAsFile(url);
  if (fileResult) return fileResult;

  return loadAsDirectory(url);
}

function createPackageURL(
  denoDir: string,
  name: string,
  version: string,
): URL {
  const denoDirURL = toFileUrl(denoDir);
  const baseURL = join(denoDirURL, "npm", "registry.npmjs.org");

  const packageURL = join(baseURL, name, version);

  return packageURL;
}

export function resolveSideEffects(
  sideEffects: unknown,
  packagePath: string,
  path: string,
): undefined | boolean {
  if (!validateSideEffects(sideEffects)) return undefined;

  const normalizedSideEffects = normalizeSideEffects(
    sideEffects,
    packagePath,
  );

  return matchSideEffects(normalizedSideEffects, path);
}

export function resolveNpmDependency(
  module: NpmModule,
  context: Context,
): Promise<OnResolveResult> | undefined {
  const npm = context.source.npmPackages[module.npmPackage];

  if (!npm) throw new Error("npm not found");

  const { name, subpath } = parseNpmPkg(context.specifier);

  if (npm.name === name) {
    const childModule = {
      kind: "npm",
      specifier: `npm:/${npm.name}@${npm.version}${subpath.slice(1)}`,
      npmPackage: module.npmPackage,
    } satisfies NpmModule;

    return resolveNpmModule(childModule, context);
  }

  const mapped = npm.dependencies.map((fullSpecifier) => {
    return [
      fullSpecifier,
      context.source.npmPackages[fullSpecifier],
    ] as const;
  });

  const depEntry = mapped.find(([_, npm]) => npm.name === name);

  if (depEntry) {
    const [npmPackage, dep] = depEntry;
    const module = {
      kind: "npm",
      specifier: `npm:/${dep.name}@${dep.version}${subpath.slice(1)}`,
      npmPackage,
    } satisfies NpmModule;

    return resolveNpmModule(module, context);
  }
}

export async function require(specifier: string, referrer: string, context: {
  source: Source;
  module: NpmModule;
  pjson: PackageJson | null;
  packageURL: URL;
  conditions: string[];
  next: (specifier: string) => Promise<OnResolveResult> | OnResolveResult;
}): Promise<OnResolveResult> {
  // 1. If X is a core module,
  if (isBuiltin(specifier)) return { external: true };

  // 3. If X begins with './' or '/' or '../'
  if (
    specifier.startsWith("./") ||
    specifier.startsWith("/") ||
    specifier.startsWith("../")
  ) {
    const base = toFileUrl(referrer);
    const url = new URL(specifier, base);

    // a. LOAD_AS_FILE(Y + X)
    const fileResult = await loadAsFile(url);

    if (fileResult) {
      const format = await esmFileFormat(fileResult, {
        readFile,
        existFile,
      });
      const mediaType: MediaType = format
        ? formatToMediaType(format)
        : "Unknown";
      const pluginData = {
        mediaType,
        source: context.source,
        module: context.module,
      } satisfies PluginData;
      const path = fromFileUrl(fileResult);
      const sideEffects = resolveSideEffects(
        context.pjson?.sideEffects,
        fromFileUrl(context.packageURL),
        path,
      );

      return { path, namespace: Namespace.Deno, pluginData, sideEffects };
    }

    // b. LOAD_AS_DIRECTORY(Y + X)
    const dirResult = await loadAsDirectory(url);

    if (dirResult === false) {
      const path = isLikePath(specifier)
        ? fromFileUrl(join(context.packageURL, specifier))
        : specifier;

      return { path, namespace: Namespace.Disabled };
    }

    if (dirResult) {
      const format = await esmFileFormat(dirResult, {
        readFile,
        existFile,
      });
      const mediaType: MediaType = format
        ? formatToMediaType(format)
        : "Unknown";
      const pluginData = {
        mediaType,
        source: context.source,
        module: context.module,
      } satisfies PluginData;
      const path = fromFileUrl(dirResult);
      const sideEffects = resolveSideEffects(
        context.pjson?.sideEffects,
        fromFileUrl(context.packageURL),
        path,
      );

      return { path, namespace: Namespace.Deno, pluginData, sideEffects };
    }

    const message = format(Msg.NotFound, { specifier });

    throw new Error(message);
  }

  // 6. LOAD_NODE_MODULES(X, dirname(Y))
  const result = resolveNpmDependency(context.module, {
    specifier,
    referrer,
    source: context.source,
    conditions: context.conditions,
  });

  if (result) return result;

  const { subpath } = parseNpmPkg(specifier);
  // The case where dependencies cannot be detected is when optional: true in peerDependency.
  // In this case, version resolution is left to the user
  const pkg = `npm:/${specifier}${subpath.slice(1)}`;

  return context.next(pkg);
}
