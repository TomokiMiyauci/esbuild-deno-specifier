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
import { Context as CjsContext } from "./cjs/types.ts";

interface Context extends Omit<CjsContext, "getPackageURL" | "resolve"> {
  module: Module;
  source: Source;
}

export async function resolve(
  specifier: string,
  referrer: string,
  context: Context & {
    platform: Platform;
    next: (specifier: string) => Promise<OnResolveResult> | OnResolveResult;
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

      const result = await require(specifier, toFileUrl(referrer), {
        conditions: context.conditions,
        getPackageURL: () => {
          const dep = resolveNpmDependency(module, {
            specifier,
            source: context.source,
          });

          if (!dep) throw new Error();

          module = dep;

          const url = createPackageURL(denoDir, dep.name, dep.version);
          return url;
        },
        mainFields: context.mainFields,
        resolve: context.platform === "browser" ? resolveBrowserMap : undefined,
      });

      if (!result) {
        return { path: specifier, namespace: "(disabled)" };
      }

      if (result.format === "builtin") {
        return { path: result.url.toString(), external: true };
      }

      const mediaType = (result.format && formatToMediaType(result.format)) ??
        "Unknown";
      const pluginData = {
        mediaType,
        source: context.source,
        module,
      } satisfies PluginData;
      const path = fromFileUrl(result.url);

      logger().info(`-> ${path}`);

      return { path, namespace: "deno", pluginData };
    }
  }
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

// export async function require(specifier: string, referrer: string, context: {
//   source: Source;
//   module: NpmModule;
//   pjson: PackageJson | null;
//   packageURL: URL;
//   conditions: string[];
//   next: (specifier: string) => Promise<OnResolveResult> | OnResolveResult;
// }): Promise<OnResolveResult> {
//   // 1. If X is a core module,
//   if (isBuiltin(specifier)) return { external: true };

//   // 3. If X begins with './' or '/' or '../'
//   if (
//     specifier.startsWith("./") ||
//     specifier.startsWith("/") ||
//     specifier.startsWith("../")
//   ) {
//     const base = toFileUrl(referrer);
//     const url = new URL(specifier, base);

//     // a. LOAD_AS_FILE(Y + X)
//     const fileResult = await loadAsFile(url);

//     if (fileResult) {
//       const format = await esmFileFormat(fileResult, {
//         readFile,
//         existFile,
//       });
//       const mediaType: MediaType = format
//         ? formatToMediaType(format)
//         : "Unknown";
//       const pluginData = {
//         mediaType,
//         source: context.source,
//         module: context.module,
//       } satisfies PluginData;
//       const path = fromFileUrl(fileResult);
//       const sideEffects = resolveSideEffects(
//         context.pjson?.sideEffects,
//         fromFileUrl(context.packageURL),
//         path,
//       );

//       return { path, namespace: Namespace.Deno, pluginData, sideEffects };
//     }

//     // b. LOAD_AS_DIRECTORY(Y + X)
//     const dirResult = await loadAsDirectory(url);

//     if (dirResult === false) {
//       const path = isLikePath(specifier)
//         ? fromFileUrl(join(context.packageURL, specifier))
//         : specifier;

//       return { path, namespace: Namespace.Disabled };
//     }

//     if (dirResult) {
//       const format = await esmFileFormat(dirResult, {
//         readFile,
//         existFile,
//       });
//       const mediaType: MediaType = format
//         ? formatToMediaType(format)
//         : "Unknown";
//       const pluginData = {
//         mediaType,
//         source: context.source,
//         module: context.module,
//       } satisfies PluginData;
//       const path = fromFileUrl(dirResult);
//       const sideEffects = resolveSideEffects(
//         context.pjson?.sideEffects,
//         fromFileUrl(context.packageURL),
//         path,
//       );

//       return { path, namespace: Namespace.Deno, pluginData, sideEffects };
//     }

//     const message = format(Msg.NotFound, { specifier });

//     throw new Error(message);
//   }

//   // 6. LOAD_NODE_MODULES(X, dirname(Y))
//   const module = resolveNpmDependency(context.module, {
//     specifier,
//     referrer,
//     source: context.source,
//     conditions: context.conditions,
//   });

//   if (module) {
//     const result = await resolveNpmModule(module, {
//       conditions: context.conditions,
//       source: context.source,
//       referrer,
//       specifier,
//     });

//     return toOnResolveResult(result, { ...context, module, specifier });
//   }

//   const { subpath } = parseNpmPkg(specifier);
//   // The case where dependencies cannot be detected is when optional: true in peerDependency.
//   // In this case, version resolution is left to the user
//   const pkg = `npm:/${specifier}${subpath.slice(1)}`;

//   return context.next(pkg);
// }
