import { type Module, type SourceFileInfo as Source } from "@deno/info";
import {
  type OnResolveArgs,
  type OnResolveResult,
  type Platform,
} from "esbuild";
import { format } from "@miyauci/format";
import { logger } from "./utils.ts";
import { type ResolveResult } from "./modules/types.ts";
import type { PluginData } from "./types.ts";
import { resolveModule, resolveModuleDependency } from "./modules/module.ts";
import { resolveBrowserMap } from "./browser.ts";
import { type Context as CjsContext } from "./npm/cjs/types.ts";
import { assertModule, assertModuleEntry } from "./modules/utils.ts";
import { Msg } from "./constants.ts";
import { type Strategy } from "./strategy.ts";
import { Writer } from "./writer.ts";
import {
  type DependentBuildOptions,
  normalizePlatform,
  normalizeResolveExtensions,
  resolveConditions,
  resolveMainFields,
} from "./option.ts";

interface ResolveOptions extends
  Pick<
    CjsContext,
    | "conditions"
    | "existDir"
    | "mainFields"
    | "existFile"
    | "readFile"
    | "root"
    | "extensions"
  >,
  Pick<Strategy, "getPackageURL"> {
  platform: Platform;
  namespace?: string;
  disabled?: { namespace?: string };
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
    () => `Resolving import "${specifier}" from "${referrer}"`,
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
  options.namespace;
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
      disabled: { value: disabled, namespace: options.disabled?.namespace },
      namespace: options.namespace,
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
    disabled: { value: disabled, namespace: options.disabled?.namespace },
    namespace: options.namespace,
  });
}

interface Disabled {
  namespace?: string;
  value: boolean;
}

export function toOnResolveResult(
  result: ResolveResult,
  context: {
    specifier: string;
    source: Source;
    module: Module;
    platform: Platform;
    writer: Writer;
    disabled: Disabled;
    namespace?: string;
  },
): OnResolveResult {
  const { specifier } = context;
  const path = result.url.toString();

  if (context.disabled.value) {
    context.writer.addLine(`Mark as disabled`);
    context.writer.addLine(``);
    logger().debug(() => context.writer.done());

    return { namespace: context.disabled.namespace, path };
  }

  const sideEffects = result.sideEffects;

  switch (result.url.protocol) {
    case "node:": {
      context.writer.addLine(``);
      logger().debug(() => context.writer.done());

      if (context.platform !== "node") {
        const text = format(Msg.NotFound, { specifier });
        const note = format(Msg.BuildInNodeModule, { specifier });

        return { errors: [{ text, notes: [{ text: note }] }] };
      }

      return { external: true, path, sideEffects };
    }

    default: {
      const pluginData = {
        mediaType: result.mediaType,
        source: context.source,
        module: context.module,
      } satisfies PluginData;

      context.writer.addLine(`Resolved to "${path}"`);
      context.writer.addLine(``);

      logger().debug(() => context.writer.done());

      return { path, namespace: context.namespace, pluginData, sideEffects };
    }
  }
}

export interface Resolve {
  (
    specifier: string,
    referrer: URL | string,
    options: Pick<OnResolveArgs, "kind" | "namespace"> & {
      disabled: { namespace?: string };
    },
    context?: {
      module: Module;
      source: Source;
    },
  ): Promise<OnResolveResult>;
}

export function createResolve(
  buildOptions: DependentBuildOptions,
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
): Resolve {
  const platform = normalizePlatform(buildOptions.platform);
  const mainFields = resolveMainFields(buildOptions.mainFields, { platform });
  const extensions = normalizeResolveExtensions(buildOptions.resolveExtensions);

  return (specifier, referrer, options, context) => {
    const conditions = resolveConditions(buildOptions.conditions, {
      kind: options.kind,
      platform,
    });

    return resolve(specifier, referrer, {
      ...args,
      conditions,
      mainFields,
      platform,
      extensions,
      namespace: options.namespace,
      disabled: options.disabled,
    }, context);
  };
}
