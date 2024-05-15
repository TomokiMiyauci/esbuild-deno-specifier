import { resolveNpmModule } from "./npm.ts";
import { resolveEsModule } from "./esm.ts";
import { resolveNodeModule } from "./node.ts";
import type { Context, ResolveResult } from "./types.ts";
import { Module, Platform, type Source } from "../../deps.ts";
import { require } from "../cjs/require.ts";
import { denoDir } from "../context.ts";
import { createPackageURL, resolveNpmDependency } from "./npm.ts";
import { resolveEsModuleDependencyModule } from "./esm.ts";
import { assertModule, assertModuleEntry } from "./utils.ts";
import { formatToMediaType } from "../utils.ts";
import { resolveBrowserMap } from "../browser.ts";
import { LoadResult } from "../cjs/types.ts";

export function resolveModule(
  module: Module,
  context: Pick<
    Context,
    "conditions" | "mainFields" | "resolve" | "source" | "specifier"
  >,
): ResolveResult | undefined | Promise<ResolveResult | undefined> {
  switch (module.kind) {
    case "esm":
    case "asserted":
      return resolveEsModule(module, context);

    case "node":
      return resolveNodeModule(module);

    case "npm":
      return resolveNpmModule(module, context);
  }
}

export async function resolveModuleDependency(
  module: Module,
  context: Context & {
    platform: Platform;
    info: (specifier: string) => Promise<Source> | Source;
  },
): Promise<
  [
    result: ResolveResult | undefined,
    context: { module: Module; source?: Source },
  ]
> {
  switch (module.kind) {
    case "asserted":
    case "node": {
      throw new Error("unreachable");
    }

    case "esm": {
      module = resolveEsModuleDependencyModule(module, {
        specifier: context.specifier,
        source: context.source,
      });

      const result = await resolveModule(module, {
        conditions: context.conditions,
        source: context.source,
        specifier: context.specifier,
        mainFields: context.mainFields,
        resolve: context.platform === "browser" ? resolveBrowserMap : undefined,
      });

      return [result, { module }];
    }

    case "npm": {
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
        resolve: context.platform === "browser" ? resolveBrowserMap : undefined,
      });

      const resolveResult = result && loadResultToResolveResult(result);

      return [resolveResult, { module: depModule, source }];
    }
  }
}

function loadResultToResolveResult(result: LoadResult): ResolveResult {
  const mediaType = (result.format && formatToMediaType(result.format)) ??
    "Unknown";

  return { url: result.url, mediaType };
}
