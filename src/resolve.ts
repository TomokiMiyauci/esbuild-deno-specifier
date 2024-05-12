import {
  dirname,
  esmFileFormat,
  format,
  fromFileUrl,
  isBuiltin,
  join,
  type MediaType,
  Module,
  type NpmModule,
  type OnResolveResult,
  PackageJson,
  Platform,
  readPackageJson,
  type Source,
  toFileUrl,
} from "../deps.ts";
import { resolveEsModuleDependency } from "./modules/esm.ts";
import {
  formatToMediaType,
  isLikePath,
  isObject,
  normalizePlatform,
  parseNpmPkg,
} from "./utils.ts";
import { resolveBrowser } from "./browser.ts";
import { type ResolveResult } from "./modules/types.ts";
import { loadAsDirectory, loadAsFile } from "./require.ts";
import { Msg, Namespace } from "./constants.ts";
import { existFile, readFile } from "./context.ts";
import type { PluginData } from "./types.ts";
import { resolveSideEffects } from "./side_effects.ts";
import { resolveNpmDependency, resolveNpmModule } from "./modules/npm.ts";
import { resolveModule } from "./modules/module.ts";
import { assertModule, assertModuleEntry } from "./modules/utils.ts";

interface Context {
  module: Module;
  conditions: string[];
  // npm: boolean;
  source: Source;
}

export async function resolve(
  specifier: string,
  referrer: string,
  context: Context & {
    platform: Platform | undefined;
    next: (specifier: string) => Promise<OnResolveResult> | OnResolveResult;
  },
): Promise<OnResolveResult> {
  switch (context.module.kind) {
    case "asserted":
    case "node": {
      throw new Error("unreachable");
    }

    case "esm": {
      const module = resolveEsModuleDependency(context.module, {
        conditions: context.conditions,
        referrer,
        source: context.source,
        specifier,
      });

      assertModuleEntry(module, specifier);
      assertModule(module);

      const result = await resolveModule(module, {
        conditions: context.conditions,
        referrer,
        source: context.source,
        specifier,
      });

      return toOnResolveResult(result, { ...context, module, specifier });
    }

    case "npm": {
      const closest = await findClosest(toFileUrl(referrer));

      if (!closest) throw new Error("Cannot find");

      const { pjson, packageURL } = closest;

      const browser = pjson?.browser;
      const platform = normalizePlatform(context.platform);

      if (platform === "browser" && isObject(browser)) {
        const result = resolveBrowser(specifier, browser);

        if (result) {
          if (result.specifier === null) {
            // TODO
            // const path = isLikePath(specifier)
            //   ? fromFileUrl(join(packageURL, specifier))
            //   : specifier;

            return { path: "xxx", namespace: Namespace.Disabled };
          } else {
            specifier = result.specifier;
          }
        }
      }

      return require(specifier, referrer, {
        conditions: context.conditions,
        module: context.module,
        source: context.source,
        packageURL,
        pjson,
        next: context.next.bind(context),
      });
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

      return {
        path: fromFileUrl(result.url),
        namespace: "deno",
        pluginData,
      };
    }

    default: {
      throw new Error("");
    }
  }
}

async function findClosest(
  url: URL,
): Promise<{ pjson: PackageJson; packageURL: URL } | undefined> {
  for (const packageURL of parents(url)) {
    const pjson = await readPackageJson(packageURL, { readFile });

    if (pjson) {
      return {
        pjson,
        packageURL,
      };
    }
  }
}

function* parents(url: URL): Iterable<URL> {
  const dir = dirname(url);

  if (dir.pathname !== url.pathname) {
    yield dir;
    yield* parents(dir);
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
  const module = resolveNpmDependency(context.module, {
    specifier,
    referrer,
    source: context.source,
    conditions: context.conditions,
  });

  if (module) {
    const result = await resolveNpmModule(module, {
      conditions: context.conditions,
      source: context.source,
      referrer,
      specifier,
    });

    return toOnResolveResult(result, { ...context, module, specifier });
  }

  const { subpath } = parseNpmPkg(specifier);
  // The case where dependencies cannot be detected is when optional: true in peerDependency.
  // In this case, version resolution is left to the user
  const pkg = `npm:/${specifier}${subpath.slice(1)}`;

  return context.next(pkg);
}
