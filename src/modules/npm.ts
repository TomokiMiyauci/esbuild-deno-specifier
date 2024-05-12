import {
  esmFileFormat,
  type Format,
  join,
  type MediaType,
  type NpmModule,
  packageExportsResolve,
  type PackageJson,
  readPackageJson,
  toFileUrl,
} from "../../deps.ts";
import { formatToMediaType, parseNpmPkg } from "../utils.ts";
import { denoDir, existDir, existFile, readFile } from "../context.ts";
import {
  matchSideEffects,
  normalizeSideEffects,
  validateSideEffects,
} from "../side_effects.ts";
import type { Context, ResolveResult } from "./types.ts";
import { loadAsDirectory, loadAsFile } from "../require.ts";

export async function resolveNpmModule(
  module: NpmModule,
  context: Context,
): Promise<ResolveResult | undefined> {
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
  const url = await resolveNodeModules(
    packageURL,
    pjson,
    packageSubpath,
    context,
  );

  if (url === undefined) {
    throw new Error();
  }

  if (!url) {
    return;
    // const path = isLikePath(context.specifier)
    //   ? fromFileUrl(join(packageURL, context.specifier))
    //   : context.specifier;

    // return { path, namespace: Namespace.Disabled };
  }

  const format = await esmFileFormat(url, { existFile, readFile });
  const mediaType: MediaType = format ? formatToMediaType(format) : "Unknown";
  // const sideEffects = resolveSideEffects(
  //   pjson?.sideEffects,
  //   fromFileUrl(packageURL),
  //   path,
  // );

  return {
    url,
    mediaType,
  };
}

export interface NpmResult {
  url: URL | null;
  pjson: PackageJson | null;
  format: Format | null;
  packageURL: URL;
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
): NpmModule | undefined {
  const npm = context.source.npmPackages[module.npmPackage];

  if (!npm) throw new Error("npm not found");

  const { name, subpath } = parseNpmPkg(context.specifier);

  if (npm.name === name) {
    const childModule = {
      kind: "npm",
      specifier: `npm:/${npm.name}@${npm.version}${subpath.slice(1)}`,
      npmPackage: module.npmPackage,
    } satisfies NpmModule;

    return childModule;
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

    return module;
  }
}
