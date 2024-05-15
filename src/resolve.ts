import {
  fromFileUrl,
  join,
  Module,
  type OnResolveResult,
  PackageJson,
  Platform,
  type Source,
  toFileUrl,
} from "../deps.ts";
import { formatToMediaType, isObject, logger } from "./utils.ts";
import { resolveBrowser } from "./browser.ts";
import { type ResolveResult } from "./modules/types.ts";
import { require } from "./cjs/require.ts";
import { denoDir } from "./context.ts";
import type { PluginData } from "./types.ts";
import { createPackageURL, resolveNpmDependency } from "./modules/npm.ts";
import { resolveModule } from "./modules/module.ts";
import { assertModule, assertModuleEntry } from "./modules/utils.ts";
import { findDependency, resolveDependency } from "./modules/dependency.ts";
import { Context as CjsContext, LoadResult } from "./cjs/types.ts";

interface Context extends Omit<CjsContext, "getPackageURL" | "resolve"> {
  module: Module;
  source: Source;
}

export async function resolve(
  specifier: string,
  referrer: string,
  context: Context & {
    platform: Platform;
    info: (specifier: string) => Promise<Source> | Source;
  },
): Promise<OnResolveResult> {
  switch (context.module.kind) {
    case "asserted":
    case "node": {
      throw new Error("unreachable");
    }

    case "esm": {
      const dep = findDependency(context.module.dependencies ?? [], specifier);
      const module = resolveDependency(dep, { source: context.source });

      assertModuleEntry(module, specifier);
      assertModule(module);

      const result = await resolveModule(module, {
        conditions: context.conditions,
        referrer,
        source: context.source,
        specifier,
        mainFields: context.mainFields,
        resolve: context.platform === "browser" ? resolveBrowserMap : undefined,
      });

      return toOnResolveResult(result, { ...context, module, specifier });
    }

    case "npm": {
      let module = context.module;
      let source = context.source;

      const result = await require(specifier, toFileUrl(referrer), {
        conditions: context.conditions,
        getPackageURL: async ({ name, subpath }) => {
          const dep = resolveNpmDependency(module, { specifier, source });

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

            module = mod;

            const npm = source.npmPackages[module.npmPackage];

            return createPackageURL(denoDir, npm.name, npm.version);
          }

          module = dep;

          const url = createPackageURL(denoDir, dep.name, dep.version);
          return url;
        },
        mainFields: context.mainFields,
        resolve: context.platform === "browser" ? resolveBrowserMap : undefined,
      });

      const resolveResult = result && loadResultToResolveResult(result);

      return toOnResolveResult(resolveResult, {
        source,
        module,
        specifier,
        conditions: context.conditions,
        mainFields: context.mainFields,
      });
    }
  }
}

function loadResultToResolveResult(result: LoadResult): ResolveResult {
  const mediaType = (result.format && formatToMediaType(result.format)) ??
    "Unknown";

  return { url: result.url, mediaType };
}

export function toOnResolveResult(
  result: undefined | ResolveResult,
  context: Context & { specifier: string },
): OnResolveResult {
  if (!result) {
    return { namespace: "(disabled)", path: context.specifier };
  }

  switch (result.url.protocol) {
    case "node:": {
      return { external: true, path: result.url.toString() };
    }

    case "file:": {
      const pluginData = {
        mediaType: result.mediaType,
        source: context.source,
        module: context.module,
      } satisfies PluginData;

      // TODO: side effect

      const path = fromFileUrl(result.url);
      logger().info(`-> ${path}`);

      return {
        path,
        namespace: "deno",
        pluginData,
      };
    }

    default: {
      throw new Error("un");
    }
  }
}

export function resolveBrowserMap(
  path: string,
  args: { pjson: PackageJson; packageURL: URL },
): false | URL | undefined {
  if (args.pjson) {
    if (isObject(args.pjson.browser)) {
      const result = resolveBrowser(path, args.pjson.browser);

      if (result) {
        if (result.specifier === null) {
          return false;
        }

        return join(args.packageURL, result.specifier);
      }
    }
  }
}
