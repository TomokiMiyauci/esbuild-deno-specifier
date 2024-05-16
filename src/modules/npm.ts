import {
  format,
  join,
  type MediaType,
  type NpmModule,
  NpmPackage,
  toFileUrl,
} from "../../deps.ts";
import { parseNpmPkg } from "../utils.ts";
import { denoDir, existDir } from "../context.ts";
import type {
  Context,
  DependencyContext,
  DependencyResolveResult,
  ResolveResult,
} from "./types.ts";
import { loadNodeModules } from "../cjs/load_node_modules.ts";
import type { Format, LoadResult } from "../cjs/types.ts";
import { Msg } from "../constants.ts";
import { require } from "../cjs/require.ts";
import { assertModule, assertModuleEntry } from "./utils.ts";
import type { Subpath } from "../types.ts";

export async function resolveNpmModule(
  module: NpmModule,
  context: Pick<
    Context,
    "conditions" | "mainFields" | "resolve" | "source" | "specifier"
  >,
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

export async function resolveNpmModuleDependency(
  module: NpmModule,
  context: DependencyContext,
): Promise<DependencyResolveResult> {
  let depModule = module;
  let source = context.source;

  const result = await require(context.specifier, context.referrer, {
    conditions: context.conditions,
    getPackageURL: async ({ name, subpath }) => {
      const dep = resolveNpmDependency(depModule, {
        specifier: context.specifier,
        source,
      });

      if (!dep) {
        // The case where dependencies cannot be detected is when optional: true in peerDependency.
        // In this case, version resolution is left to the user

        const specifier = `npm:/${name}${subpath.slice(1)}`;
        source = await context.info(specifier);

        const normalized = source.redirects[specifier] ?? specifier;
        const mod = source.modules.find((module) =>
          module.specifier === normalized
        );

        assertModuleEntry(mod, specifier);
        assertModule(mod);

        if (mod.kind !== "npm") {
          throw new Error("unreachable");
        }

        depModule = mod;

        const npm = source.npmPackages[depModule.npmPackage];

        return createPackageURL(denoDir, npm.name, npm.version);
      }

      depModule = dep;

      const url = createPackageURL(denoDir, dep.name, dep.version);
      return url;
    },
    mainFields: context.mainFields,
    resolve: context.resolve,
  });

  const resolveResult = result && loadResultToResolveResult(result);

  return [resolveResult, { module: depModule, source }];
}

function loadResultToResolveResult(result: LoadResult): ResolveResult {
  const mediaType = (result.format && formatToMediaType(result.format)) ??
    "Unknown";

  return { url: result.url, mediaType };
}

export function resolveNpmDependency(
  module: NpmModule,
  context: Pick<Context, "source" | "specifier">,
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
