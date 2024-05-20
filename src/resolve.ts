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
import { type Strategy } from "./strategy.ts";
import { Writer } from "./writer.ts";

interface ResolveOptions extends
  Pick<
    CjsContext,
    "conditions" | "existDir" | "mainFields" | "existFile" | "readFile" | "root"
  >,
  Pick<Strategy, "getPackageURL"> {
  platform: Platform;
  info: (specifier: string) => Promise<Source> | Source;
  realURL(url: URL): Promise<URL | undefined> | URL | undefined;
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
  const writer = new Writer();

  writer.addLine(
    () => `Resolving import "${specifier}" from "${fromFileUrl(referrer)}"`,
  );
  const { platform } = options;
  const resolve = platform === "browser" ? resolveBrowserMap : undefined;
  referrer = new URL(referrer);

  if (context) {
    const [result, { source = context.source, module }] =
      await resolveModuleDependency(
        context.module,
        {
          referrer,
          specifier,
          resolve,
          conditions: options.conditions,
          info: options.info,
          mainFields: options.mainFields,
          source: context.source,
          readFile: options.readFile,
          existDir: options.existDir,
          existFile: options.existFile,
          root: options.root,
          getPackageURL: options.getPackageURL,
        },
      );

    return toOnResolveResult(result, {
      source,
      module,
      specifier,
      platform,
      realURL: options.realURL,
      writer,
    });
  }

  const source = await options.info(specifier);
  const normalized = source.redirects[specifier] ?? specifier;
  const module = source.modules.find((module) =>
    module.specifier === normalized
  );

  assertModuleEntry(module, specifier);
  assertModule(module);

  const result = await resolveModule(module, {
    ...options,
    specifier,
    source,
    resolve,
    referrer,
  });

  return toOnResolveResult(result, {
    source,
    module,
    specifier,
    platform,
    realURL: options.realURL,
    writer,
  });
}

export async function toOnResolveResult(
  result: undefined | ResolveResult,
  context: {
    specifier: string;
    source: Source;
    module: Module;
    platform: Platform;
    realURL(url: URL): Promise<URL | undefined> | URL | undefined;
    writer: Writer;
  },
): Promise<OnResolveResult> {
  const { specifier } = context;

  if (!result) {
    context.writer.addLine(``);
    logger().debug(() => context.writer.done());

    return { namespace: Namespace.Disabled, path: specifier };
  }

  switch (result.url.protocol) {
    case "node:": {
      context.writer.addLine(``);
      logger().debug(() => context.writer.done());

      if (context.platform !== "node") {
        const text = format(Msg.NotFound, { specifier });
        const note = format(Msg.BuildInNodeModule, { specifier });

        return { errors: [{ text, notes: [{ text: note }] }] };
      }

      return {
        external: true,
        path: result.url.toString(),
        sideEffects: result.sideEffects,
      };
    }

    case "file:": {
      const pluginData = {
        mediaType: result.mediaType,
        source: context.source,
        module: context.module,
      } satisfies PluginData;
      const url = (await context.realURL(result.url)) ?? result.url;
      const path = fromFileUrl(url);

      // TODO: side effect

      context.writer.addLine(`Resolved to "${path}"`);
      context.writer.addLine(``);

      logger().debug(() => context.writer.done());

      return {
        path,
        namespace: Namespace.Deno,
        pluginData,
        sideEffects: result.sideEffects,
      };
    }

    case "data:": {
      const pluginData = {
        mediaType: result.mediaType,
      } satisfies DataPluginData;

      context.writer.addLine(``);
      logger().debug(() => context.writer.done());

      return {
        path: result.url.toString(),
        namespace: Namespace.Data,
        pluginData,
        sideEffects: result.sideEffects,
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
  options: Pick<
    ResolveOptions,
    | "info"
    | "readFile"
    | "existDir"
    | "existFile"
    | "realURL"
    | "root"
    | "getPackageURL"
  >,
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
      ...options,
      conditions,
      mainFields,
      platform,
    }, context);
}
