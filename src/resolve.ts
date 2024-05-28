import { type Module, type SourceFileInfo as Source } from "@deno/info";
import type {
  BuildOptions,
  OnResolveArgs,
  OnResolveResult,
  Platform,
} from "esbuild";
import { fromFileUrl } from "@std/path/from-file-url";
import { format } from "@miyauci/format";
import { logger, normalizePlatform } from "./utils.ts";
import { type ResolveResult } from "./modules/types.ts";
import type { DataPluginData, PluginData } from "./types.ts";
import { resolveModule, resolveModuleDependency } from "./modules/module.ts";
import { resolveBrowserMap } from "./browser.ts";
import { type Context as CjsContext } from "./npm/cjs/types.ts";
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
  realURL?(url: URL): Promise<URL | undefined | null> | URL | undefined | null;
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
  let disabled = false;
  const onFalse = () => {
    disabled = true;
  };

  writer.addLine(
    () => `Resolving import "${specifier}" from "${fromFileUrl(referrer)}"`,
  );
  const { platform } = options;
  const resolve = platform === "browser"
    ? (specifier: string, referrer: URL | string, context: CjsContext) =>
      resolveBrowserMap(specifier, referrer, {
        onFalse,
        ...context,
      })
    : undefined;
  referrer = new URL(referrer);

  if (context) {
    const result = await resolveModuleDependency(
      context.module,
      {
        ...options,
        referrer,
        specifier,
        resolve,
        source: context.source,
      },
    );

    return toOnResolveResult(result, {
      source: result.source ?? context.source,
      module: result.module,
      specifier,
      platform,
      writer,
      disabled,
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
    writer,
    disabled,
  });
}

export function toOnResolveResult(
  result: ResolveResult,
  context: {
    specifier: string;
    source: Source;
    module: Module;
    platform: Platform;
    writer: Writer;
    disabled: boolean;
  },
): OnResolveResult {
  const { specifier } = context;

  if (context.disabled) {
    context.writer.addLine(`Mark as disabled`);
    context.writer.addLine(``);
    logger().debug(() => context.writer.done());

    return { namespace: Namespace.Disabled, path: result.url.toString() };
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
      const url = result.url;
      const path = fromFileUrl(url);

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
  args: Pick<
    ResolveOptions,
    | "info"
    | "readFile"
    | "existDir"
    | "existFile"
    | "realURL"
    | "root"
    | "getPackageURL"
  >,
): (
  specifier: string,
  referrer: URL | string,
  options: Pick<OnResolveArgs, "kind">,
  context?: {
    module: Module;
    source: Source;
  },
) => Promise<OnResolveResult> {
  const mainFields = resolveMainFields({
    platform: buildOptions.platform,
    mainFields: buildOptions.mainFields,
  });
  const platform = normalizePlatform(buildOptions.platform);

  return (specifier, referrer, options, context) => {
    const conditions = resolveConditions({
      kind: options.kind,
      platform,
      conditions: buildOptions.conditions,
    });

    return resolve(specifier, referrer, {
      ...args,
      conditions,
      mainFields,
      platform,
    }, context);
  };
}
