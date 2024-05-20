import {
  ConsoleHandler,
  DenoDir,
  dirnamePath,
  exists,
  info,
  type LevelName,
  type LogLevel,
  type Plugin,
  setup,
  toFileUrl,
} from "../deps.ts";
import type { DataPluginData, PluginData } from "./types.ts";
import { Namespace } from "./constants.ts";
import { logger, mediaTypeToLoader, memo } from "./utils.ts";
import { createResolve } from "./resolve.ts";

interface Options {
  npm: NpmOptions;
}

interface NpmOptions {
  scope: NpmScope;
}

type NpmScope =
  | { type: "global"; denoDir: string }
  | { type: "local"; nodeModulesDir: string };

export function denoSpecifier(): Plugin {
  return {
    name: "deno-specifier",
    setup(build) {
      const cachedInfo = memo(info);
      const cachedExistFile = memo(existFile);
      const cachedExistDir = memo(existDir);
      const cachedReadFile = memo(readFile);
      const cachedRealURL = memo(realURL);
      const denoDir = new DenoDir().root;

      const options = {
        info: cachedInfo,
        existDir: cachedExistDir,
        existFile: cachedExistFile,
        readFile: cachedReadFile,
        realURL: cachedRealURL,
        denoDir,
      };

      build.onStart(() => {
        const logLevel = normalizeLogLevel(build.initialOptions.logLevel);
        const level = logLevelToLevelName(logLevel);

        if (!level) return;

        setup({
          handlers: { console: new ConsoleHandler(level) },
          loggers: {
            "deno": { level, handlers: ["console"] },
          },
        });
      });

      build.onResolve(
        { filter: /^npm:|^jsr:|^https?:|^data:|^node:|^file:/ },
        ({ path: specifier, kind, importer, resolveDir }) => {
          const referrerPath = importer ? importer : resolveDir;

          logger().debug(
            `Resolving import "${specifier}" from "${referrerPath}"`,
          );

          const referrer = toFileUrl(referrerPath);
          const resolve = createResolve(build.initialOptions, { kind });

          return resolve(specifier, referrer, options);
        },
      );

      build.onResolve({ filter: /.*/, namespace: Namespace.Deno }, (args) => {
        logger().debug(
          `Resolving import "${args.path}" from "${args.importer}"`,
        );

        const pluginData = args.pluginData as PluginData;
        const { module, source } = pluginData;
        const { path: specifier, importer, kind } = args;
        const referrer = toFileUrl(importer);
        const resolve = createResolve(build.initialOptions, { kind });

        return resolve(specifier, referrer, options, { module, source });
      });

      build.onLoad(
        { filter: /.*/, namespace: Namespace.Deno },
        async (args) => {
          const pluginData = args.pluginData as PluginData;
          const contents = await readFile(toFileUrl(args.path));

          if (typeof contents !== "string") {
            throw new Error("file does not exist");
          }

          const loader = mediaTypeToLoader(pluginData.mediaType);
          const resolveDir = dirnamePath(args.path);

          return { contents, loader, pluginData: args.pluginData, resolveDir };
        },
      );

      build.onLoad({ filter: /.*/, namespace: Namespace.Disabled }, () => {
        return { contents: "" };
      });

      build.onLoad(
        { filter: /.*/, namespace: Namespace.Data },
        async (args) => {
          const pluginData = args.pluginData as DataPluginData;
          const result = await fetch(args.path);
          const contents = await result.text();
          const loader = mediaTypeToLoader(pluginData.mediaType);

          return { contents, loader };
        },
      );
    },
  };
}

function existFile(url: URL): Promise<boolean> {
  return exists(url, { isFile: true });
}

function existDir(url: URL): Promise<boolean> {
  return exists(url, { isDirectory: true });
}

async function readFile(url: URL): Promise<string | null> {
  try {
    return await Deno.readTextFile(url);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return null;
    }

    if (e instanceof Deno.errors.IsADirectory) {
      return null;
    }

    throw e;
  }
}

async function realURL(url: URL): Promise<URL | undefined> {
  try {
    const path = await Deno.realPath(url);

    return toFileUrl(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return;
    }

    throw e;
  }
}

function logLevelToLevelName(logLevel: LogLevel): LevelName | null {
  switch (logLevel) {
    case "debug":
      return "DEBUG";
    case "error":
      return "ERROR";
    case "info":
      return "INFO";
    case "warning":
      return "WARN";
    case "verbose":
      return "NOTSET";
    case "silent":
      return null;
  }
}

function normalizeLogLevel(logLevel: LogLevel | undefined): LogLevel {
  if (!logLevel) return "warning";

  return logLevel;
}
