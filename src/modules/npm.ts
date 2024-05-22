import {
  format,
  fromFileUrl,
  join,
  type MediaType,
  type NpmModule,
  NpmPackage,
} from "../../deps.ts";
import { parseNpmPkg } from "../utils.ts";
import type {
  Context,
  DependencyContext,
  DependencyResolveResult,
  ResolveResult,
} from "./types.ts";
import { loadNodeModules } from "../npm/cjs/load_node_modules.ts";
import type { Format } from "../npm/cjs/types.ts";
import { require } from "../npm/cjs/require.ts";
import { assertModule, assertModuleEntry } from "./utils.ts";
import type { Subpath } from "../types.ts";
import { Msg } from "../constants.ts";
import { fileFormat } from "../npm/cjs/file_format.ts";
import { findClosest } from "../npm/cjs/utils.ts";
import { resolveSideEffects } from "../side_effects.ts";

export async function resolveNpmModule(
  module: NpmModule,
  context: Pick<
    Context,
    | "conditions"
    | "mainFields"
    | "resolve"
    | "source"
    | "specifier"
    | "existDir"
    | "readFile"
    | "existFile"
    | "getPackageURL"
    | "referrer"
    | "root"
  >,
): Promise<ResolveResult> {
  const npm = context.source.npmPackages[module.npmPackage];

  if (!npm) throw new Error("npm not found");

  const { name, version } = npm;
  const subpath = parseSubpath(module.specifier, { name, version });
  const url = await loadNodeModules(name, subpath, {
    ...context,
    async *nodeModulesPaths() {
      for await (
        const url of context.getPackageURL({ ...npm, ...context, isDep: false })
      ) yield url;
    },
  });

  if (url) {
    switch (url.protocol) {
      case "file:": {
        const format = await fileFormat(url, context);
        const mediaType = (format && formatToMediaType(format)) ?? "Unknown";
        const result = await findClosest(url, context);
        const sideEffects = result &&
          resolveSideEffects(
            result.pjson?.sideEffects,
            fromFileUrl(result.packageURL),
            fromFileUrl(url),
          );

        return { url, mediaType, sideEffects };
      }

      default: {
        return { url, mediaType: "Unknown", sideEffects: undefined };
      }
    }
  }

  const message = format(Msg.NotFound, { specifier: context.specifier });

  throw new Error(message);
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
  npmRegistryURL: URL | string,
  name: string,
  version: string,
): URL {
  const packageURL = join(npmRegistryURL, name, version);

  return packageURL;
}

export async function resolveNpmModuleDependency(
  module: NpmModule,
  context: DependencyContext,
): Promise<DependencyResolveResult> {
  let depModule = module;
  let source = context.source;

  const url = await require(context.specifier, context.referrer, {
    ...context,
    async *nodeModulesPaths({ name, subpath }) {
      const dep = resolveNpmDependency(module, {
        specifier: context.specifier,
        source: source,
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

        const npm = source.npmPackages[mod.npmPackage];

        return yield* context.getPackageURL({
          ...npm,
          ...context,
          isDep: true,
        });
      }

      depModule = dep;

      yield* context.getPackageURL({ ...dep, ...context, isDep: true });
    },
  });

  switch (url.protocol) {
    case "file:": {
      const format = await fileFormat(url, context);
      const mediaType = (format && formatToMediaType(format)) ?? "Unknown";

      const result = await findClosest(url, context);
      const sideEffects = result &&
        resolveSideEffects(
          result.pjson?.sideEffects,
          fromFileUrl(result.packageURL),
          fromFileUrl(url),
        );

      return { url, mediaType, sideEffects, module: depModule, source };
    }

    default: {
      return {
        url,
        mediaType: "Unknown",
        sideEffects: undefined,
        module: depModule,
        source,
      };
    }
  }
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
