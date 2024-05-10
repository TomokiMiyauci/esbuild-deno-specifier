import {
  format,
  fromFileUrl,
  join,
  type Module,
  type ModuleEntry,
  type OnResolveResult,
  Platform,
} from "../../deps.ts";
import { require, resolveNpmModule } from "./npm.ts";
import { resolveEsModule, resolveEsModuleDependency } from "./esm.ts";
import { resolveNodeModule } from "./node.ts";
import { resolveAssertedModule } from "./asserted.ts";
import type { Context } from "./types.ts";
import { Msg, Namespace } from "../constants.ts";
import { isLikePath, isObject, normalizePlatform } from "../utils.ts";
import { resolveBrowser } from "../browser.ts";

export function resolveModuleEntryLike(
  moduleEntry: ModuleEntry | undefined,
  context: Context,
): Promise<OnResolveResult> | OnResolveResult {
  if (!moduleEntry) {
    const message = format(Msg.NotFound, { specifier: context.specifier });

    throw new Error(message);
  }

  if ("error" in moduleEntry) throw new Error(moduleEntry.error);

  return resolveModule(moduleEntry, context);
}

export function resolveModule(
  module: Module,
  context: Context,
): OnResolveResult | Promise<OnResolveResult> {
  switch (module.kind) {
    case "esm":
      return resolveEsModule(module, context);

    case "node":
      return resolveNodeModule(module);

    case "asserted":
      return resolveAssertedModule(module, context);

    case "npm":
      return resolveNpmModule(module, context);
  }
}

export function resolveModuleDependency(
  module: Module,
  context: Context & {
    platform: Platform | undefined;
    next: (specifier: string) => Promise<OnResolveResult> | OnResolveResult;
  },
): Promise<OnResolveResult> | OnResolveResult {
  let { specifier, npm } = context;

  switch (module.kind) {
    case "npm": {
      if (!npm) throw new Error();

      const pjson = npm.pjson;
      const packageURL = npm.packageURL;
      const browser = pjson?.browser;
      const platform = normalizePlatform(context.platform);

      if (platform === "browser" && isObject(browser)) {
        const result = resolveBrowser(specifier, browser);

        if (result) {
          if (result.specifier === null) {
            const path = isLikePath(specifier)
              ? fromFileUrl(join(packageURL, specifier))
              : specifier;

            return { path, namespace: Namespace.Disabled };
          } else {
            specifier = result.specifier;
          }
        }
      }

      return require(specifier, context.referrer, {
        conditions: context.conditions,
        module,
        source: context.source,
        packageURL,
        pjson,
        next: context.next.bind(context),
      });
    }

    case "esm": {
      return resolveEsModuleDependency(module, context);
    }

    default: {
      throw new Error("unreachable");
    }
  }
}
