import {
  type BuildOptions,
  format,
  fromFileUrl,
  type Module,
  type OnResolveArgs,
  type OnResolveResult,
  type Platform,
  type Source,
} from "../deps.ts";
import { logger, normalizePlatform } from "./utils.ts";
import { type ResolveResult } from "./modules/types.ts";
import type { DataPluginData, PluginData } from "./types.ts";
import { resolveModule, resolveModuleDependency } from "./modules/module.ts";
import { resolveBrowserMap } from "./browser.ts";
import { type Context as CjsContext } from "./cjs/types.ts";
import { assertModule, assertModuleEntry } from "./modules/utils.ts";
import { resolveConditions } from "./conditions.ts";
import { resolveMainFields } from "./main_fields.ts";
import { Msg } from "./constants.ts";
import { Namespace } from "./constants.ts";

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
  const { platform } = options;
  const resolve = platform === "browser" ? resolveBrowserMap : undefined;

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
          readFile: options.readFile,
          existDir: options.existDir,
          existFile: options.existFile,
        },
      );

    return toOnResolveResult(result, { source, module, specifier, platform });
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
    existDir: options.existDir,
    existFile: options.existFile,
    readFile: options.readFile,
  });

  return toOnResolveResult(result, { source, module, specifier, platform });
}

export function toOnResolveResult(
  result: undefined | ResolveResult,
  context: {
    specifier: string;
    source: Source;
    module: Module;
    platform: Platform;
  },
): OnResolveResult {
  const { specifier } = context;

  if (!result) {
    return { namespace: Namespace.Disabled, path: specifier };
  }

  switch (result.url.protocol) {
    case "node:": {
      if (context.platform !== "node") {
        const text = format(Msg.NotFound, { specifier });
        const note = format(Msg.BuildInNodeModule, { specifier });

        return { errors: [{ text, notes: [{ text: note }] }] };
      }

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

      return { path, namespace: Namespace.Deno, pluginData };
    }

    case "data:": {
      const pluginData = {
        mediaType: result.mediaType,
      } satisfies DataPluginData;

      return {
        path: result.url.toString(),
        namespace: Namespace.Data,
        pluginData,
      };
    }

    default: {
      throw new Error("unsupported");
    }
  }
}

export function createResolve(
  buildOptions: BuildOptions,
  args: Pick<OnResolveArgs, "kind">,
): (
  specifier: string,
  referrer: URL | string,
  options: Pick<ResolveOptions, "info" | "readFile" | "existDir" | "existFile">,
  context?: {
    module: Module;
    source: Source;
  },
) => Promise<OnResolveResult> {
  const conditions = resolveConditions({
    kind: args.kind,
    platform: buildOptions.platform,
    conditions: buildOptions.conditions,
  });
  const mainFields = resolveMainFields({
    platform: buildOptions.platform,
    mainFields: buildOptions.mainFields,
  });
  const platform = normalizePlatform(buildOptions.platform);

  return (specifier, referrer, options, context) =>
    resolve(specifier, referrer, {
      conditions,
      mainFields,
      platform,
      info: options.info,
      readFile: options.readFile,
      existDir: options.existDir,
      existFile: options.existFile,
    }, context);
}
