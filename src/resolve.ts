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
import { resolveModuleDependency } from "./modules/module.ts";
import { Context as CjsContext } from "./cjs/types.ts";

interface Context extends Omit<CjsContext, "getPackageURL" | "resolve"> {
  module: Module;
  source: Source;
}

export async function resolve(
  specifier: string,
  referrer: URL | string,
  context: Context & {
    platform: Platform;
    info: (specifier: string) => Promise<Source> | Source;
  },
): Promise<OnResolveResult> {
  const [result, { source = context.source, module }] =
    await resolveModuleDependency(
      context.module,
      { ...context, referrer: new URL(referrer), specifier },
    );

  return toOnResolveResult(result, { ...context, source, module, specifier });
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
