import {
  fromFileUrl,
  Module,
  type OnResolveResult,
  Platform,
  type Source,
} from "../deps.ts";
import { logger } from "./utils.ts";
import { type ResolveResult } from "./modules/types.ts";
import type { PluginData } from "./types.ts";
import { resolveModule, resolveModuleDependency } from "./modules/module.ts";
import { resolveBrowserMap } from "./browser.ts";
import { Context as CjsContext } from "./cjs/types.ts";
import { assertModule, assertModuleEntry } from "./modules/utils.ts";

interface ResolveOptions extends Omit<CjsContext, "getPackageURL" | "resolve"> {
  platform: Platform;
  info: (specifier: string) => Promise<Source> | Source;
}

export async function resolve(
  specifier: string,
  referrer: URL | string,
  options: ResolveOptions,
  context?: {
    module: Module;
    source: Source;
  },
): Promise<OnResolveResult> {
  const resolve = options.platform === "browser"
    ? resolveBrowserMap
    : undefined;

  if (context) {
    const [result, { source = context.source, module }] =
      await resolveModuleDependency(
        context.module,
        {
          referrer: new URL(referrer),
          specifier,
          resolve,
          conditions: options.conditions,
          info: options.info,
          mainFields: options.mainFields,
          source: context.source,
        },
      );

    return toOnResolveResult(result, { source, module, specifier });
  }

  const source = await options.info(specifier);
  const normalized = source.redirects[specifier] ?? specifier;
  const module = source.modules.find((module) =>
    module.specifier === normalized
  );

  assertModuleEntry(module, specifier);
  assertModule(module);

  const result = await resolveModule(module, {
    specifier,
    conditions: options.conditions,
    source,
    mainFields: options.conditions,
    resolve,
  });

  return toOnResolveResult(result, { source, module, specifier });
}

export function toOnResolveResult(
  result: undefined | ResolveResult,
  context: { specifier: string; source: Source; module: Module },
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
