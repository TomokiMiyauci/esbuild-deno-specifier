import {
  format,
  join,
  type MediaType,
  type NpmModule,
  NpmPackage,
  type PackageJson,
  toFileUrl,
} from "../../deps.ts";
import { parseNpmPkg } from "../utils.ts";
import { denoDir, existDir } from "../context.ts";
import type { Context, ResolveResult } from "./types.ts";
import { loadNodeModules } from "../cjs/load_node_modules.ts";
import type { Format } from "../cjs/types.ts";
import { Msg } from "../constants.ts";

export async function resolveNpmModule(
  module: NpmModule,
  context: Context,
): Promise<ResolveResult | undefined> {
  const npm = context.source.npmPackages[module.npmPackage];

  if (!npm) throw new Error("npm not found");

  const { name, version } = npm;

  const subpath = parseSubpath(module.specifier, { name, version });
  const packageURL = createPackageURL(denoDir, name, version);

  if (!await existDir(packageURL)) {
    const message = format(Msg.NotFound, { specifier: context.specifier });

    throw new Error(message);
  }

  const result = await loadNodeModules(packageURL, subpath, context);

  if (result) {
    const { format } = result;
    const mediaType = (format && formatToMediaType(format)) ?? "Unknown";

    return { url: result.url, mediaType };
  }

  if (result === false) return;

  throw new Error();
}

export function formatToMediaType(format: Format): MediaType {
  switch (format) {
    case "commonjs":
      return "Mjs";
    case "module":
      return "Mjs";
    case "json":
      return "Json";
    case "wasm":
      return "Wasm";

    default:
      return "Unknown";
  }
}

export type Subpath = `.${string}`;

export interface Hint {
  name: string;
  version: string;
}

export function parseSubpath(specifier: string, hint: Hint): Subpath {
  const { name, version } = hint;
  const npmSpecifier = `npm:/${name}@${version}`;
  const subpath = specifier.slice(npmSpecifier.length);

  return `.${subpath}`;
}

export interface NpmResult {
  url: URL | null;
  pjson: PackageJson | null;
  format: Format | null;
  packageURL: URL;
}

// async function resolveEsmPackage(
//   packageURL: URL,
//   pjson: PackageJson | null,
//   subpath: Subpath,
//   context: Context,
// ) {
//   if (pjson && pjson.exports) {
//     return packageExportsResolve(
//       packageURL,
//       subpath,
//       pjson.exports,
//       context.conditions,
//       {
//         existDir,
//         existFile,
//         readFile,
//       },
//     );
//   }

//   if (pjson && "browser" in pjson) {
//     if (typeof pjson.browser === "string") {
//       const url = join(packageURL, pjson.browser);

//       if (await existFile(url)) return url;
//     }
//   }

//   throw new Error("ESM");
// }

export function createPackageURL(
  denoDir: string,
  name: string,
  version: string,
): URL {
  const denoDirURL = toFileUrl(denoDir);
  const baseURL = join(denoDirURL, "npm", "registry.npmjs.org");

  const packageURL = join(baseURL, name, version);

  return packageURL;
}

export function resolveNpmDependency(
  module: NpmModule,
  context: Context,
): (NpmModule & NpmPackage) | undefined {
  const npm = context.source.npmPackages[module.npmPackage];

  if (!npm) throw new Error("npm not found");

  const { name, subpath } = parseNpmPkg(context.specifier);

  if (npm.name === name) {
    const childModule = {
      kind: "npm",
      specifier: `npm:/${npm.name}@${npm.version}${subpath.slice(1)}`,
      npmPackage: module.npmPackage,
    } satisfies NpmModule;

    return { ...childModule, ...npm };
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

    return { ...module, ...dep };
  }
}
