import {
  esmFileFormat,
  format,
  fromFileUrl,
  join,
  type MediaType,
  type Module,
  type ModuleEntry,
  OnResolveArgs,
  type OnResolveResult,
  PluginBuild,
  type Source,
  toFileUrl,
} from "../../deps.ts";
import {
  loadAsFile,
  resolveNpmDependency,
  resolveNpmModule,
  resolveSideEffects,
} from "./npm.ts";
import { resolveEsModule, resolveEsModuleDependency } from "./esm.ts";
import { resolveNodeModule } from "./node.ts";
import { resolveAssertedModule } from "./asserted.ts";
import type { Context } from "./types.ts";
import type { PluginData } from "../types.ts";
import { Msg } from "../constants.ts";
import {
  formatToMediaType,
  isLikePath,
  isObject,
  normalizePlatform,
  parseNpmPkg,
} from "../utils.ts";
import { isBuiltin } from "node:module";
import { existFile, readFile } from "../context.ts";
import { resolveBrowser } from "../browser.ts";

export function resolveModuleEntryLike(
  moduleEntry: ModuleEntry | undefined,
  source: Source,
  context: Context,
): Promise<OnResolveResult> | OnResolveResult {
  if (!moduleEntry) {
    const message = format(Msg.NotFound, { specifier: context.specifier });

    throw new Error(message);
  }

  if ("error" in moduleEntry) throw new Error(moduleEntry.error);

  return resolveModule(moduleEntry, source, context);
}

export function resolveModule(
  module: Module,
  source: Source,
  context: Context,
): OnResolveResult | Promise<OnResolveResult> {
  switch (module.kind) {
    case "esm":
      return resolveEsModule(module, source, context);

    case "node":
      return resolveNodeModule(module);

    case "asserted":
      return resolveAssertedModule(module, source);

    case "npm":
      return resolveNpmModule(module, source, context);
  }
}

export async function resolveModuleDependency(
  module: Module,
  source: Source,
  context: Context & OnResolveArgs & { build: PluginBuild },
): Promise<OnResolveResult> {
  let { specifier, conditions, npm, importer, build, kind, resolveDir } =
    context;

  switch (module.kind) {
    case "npm": {
      if (!npm) throw new Error();

      const pjson = npm.pjson;
      const packageURL = npm.packageURL;
      const browser = pjson?.browser;
      const platform = normalizePlatform(build.initialOptions.platform);

      if (platform === "browser" && isObject(browser)) {
        const result = resolveBrowser(specifier, browser);

        if (result) {
          if (result.specifier === null) {
            const path = isLikePath(specifier)
              ? fromFileUrl(join(packageURL, specifier))
              : specifier;

            return { path, namespace: "(disabled)" };
          } else {
            specifier = result.specifier;
          }
        }
      }

      if (specifier.startsWith("./") || specifier.startsWith("../")) {
        const base = toFileUrl(importer);
        const url = new URL(specifier, base);
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
            module,
            source,
            npm: { pjson, packageURL },
          } satisfies PluginData;
          const path = fromFileUrl(fileResult);
          const sideEffects = resolveSideEffects(
            pjson?.sideEffects,
            fromFileUrl(packageURL),
            path,
          );

          return {
            path,
            namespace: "deno",
            pluginData,
            sideEffects,
          };
        }

        // const dirResult = await loadAsDirectory(url);

        throw new Error("not found");
      }

      if (isBuiltin(specifier)) return { external: true };

      const result = resolveNpmDependency(module, source, {
        specifier,
        conditions,
      });

      if (result) return result;

      const { subpath } = parseNpmPkg(specifier);
      // The case where dependencies cannot be detected is when optional: true in peerDependency.
      // In this case, version resolution is left to the user
      const pkg = `npm:/${specifier}${subpath.slice(1)}`;

      return build.resolve(pkg, {
        importer,
        kind,
        resolveDir,
        pluginName: "deno",
      });
    }

    case "esm": {
      return resolveEsModuleDependency(module, source, {
        specifier,
        conditions,
      });
    }

    default: {
      throw new Error("unreachable");
    }
  }
}
