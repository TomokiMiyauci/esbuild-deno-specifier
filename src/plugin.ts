import { info } from "@deno/info";
import type { LogLevel, Plugin } from "esbuild";
import * as Path from "@std/path/dirname";
import { dirname } from "@std/url/dirname";
import { DenoDir } from "@deno/cache-dir";
import { toFileUrl } from "@std/path/to-file-url";
import { fromFileUrl } from "@std/path/from-file-url";
import { exists } from "@std/fs/exists";
import { type LevelName } from "@std/log/levels";
import { setup } from "@std/log/setup";
import { ConsoleHandler } from "@std/log/console-handler";
import type { PluginData } from "./types.ts";
import { Namespace } from "./constants.ts";
import { mediaTypeToLoader, memo } from "./utils.ts";
import { createResolve } from "./resolve.ts";
import { GlobalStrategy, LocalStrategy } from "./strategy.ts";
import { isAbsolute } from "jsr:@std/path@^0.218.2/is_absolute";

export interface Options {
  /**
   * @default false
   */
  nodeModulesDir?: boolean;

  /**
   * @default new DenoDir().root
   */
  denoDir?: string;
}

export function denoSpecifier(options: Options = {}): Plugin {
  return {
    name: "deno-specifier",
    setup(build) {
      const DENO_DIR = options.denoDir ?? new DenoDir().root;
      const infoOptions = options.nodeModulesDir
        ? {
          json: true,
          noConfig: true,
          nodeModulesDir: true,
          env: { DENO_DIR },
        } as const
        : {
          json: true,
          noConfig: true,
          env: { DENO_DIR },
        } as const;
      const cachedInfo = memo((specifier: string) =>
        info(specifier, infoOptions)
      );
      const cachedExistFile = memo(existFile);
      const cachedExistDir = memo(existDir);
      const cachedReadFile = memo(readFile);
      const cachedRealURL = memo(realURL);

      const strategy = options.nodeModulesDir
        ? (() => {
          const root = build.initialOptions.absWorkingDir;

          if (!root) {
            throw new Error(
              `'absWorkingDir' is required when npm.scope.type is 'local'`,
            );
          }

          return new LocalStrategy(root);
        })()
        : new GlobalStrategy(DENO_DIR);

      const resolveOptions = {
        info: cachedInfo,
        existDir: cachedExistDir,
        existFile: cachedExistFile,
        readFile: cachedReadFile,
        realURL: strategy.resolveSymbolic ? cachedRealURL : undefined,
        root: strategy.root,
        getPackageURL: strategy.getPackageURL.bind(strategy),
      };

      const logLevel = normalizeLogLevel(build.initialOptions.logLevel);
      const level = logLevelToLevelName(logLevel);

      const resolve = createResolve(build.initialOptions, resolveOptions);

      if (level) {
        setup({
          handlers: { console: new ConsoleHandler(level) },
          loggers: {
            "deno": { level, handlers: ["console"] },
          },
        });
      }

      build.onResolve(
        { filter: /^npm:|^jsr:|^https?:|^data:|^node:|^file:/ },
        ({ path: specifier, kind, importer, namespace }) => {
          const referrer = resolveImporter(importer, namespace);

          return resolve(specifier, referrer, { kind });
        },
      );

      build.onResolve(
        { filter: /.*/, namespace: Namespace.DenoUrl },
        async (args) => {
          const pluginData = args.pluginData as PluginData;
          const { module, source } = pluginData;
          const { path: specifier, importer: referrer, kind } = args;

          return await resolve(specifier, referrer, { kind }, {
            module,
            source,
          });
        },
      );

      build.onLoad(
        { filter: /.*/, namespace: Namespace.DenoUrl },
        async (args) => {
          const { path } = args;
          const url = new URL(path);
          const pluginData = args.pluginData as PluginData;

          switch (url.protocol) {
            case "http:":
            case "https:": {
              if (pluginData.module.kind !== "esm") {
                throw new Error("unreachable");
              }
              const localPath = pluginData.module.local;

              if (typeof localPath !== "string") {
                throw new Error("local file does not exist");
              }

              const url = toFileUrl(localPath);
              const contents = await cachedReadFile(url);

              if (typeof contents !== "string") {
                throw new Error("file does not exist");
              }

              const loader = mediaTypeToLoader(pluginData.mediaType);
              const resolveDir = Path.dirname(localPath);

              return {
                contents,
                loader,
                pluginData: args.pluginData,
                resolveDir,
              };
            }

            case "file:": {
              const contents = await cachedReadFile(url);

              if (typeof contents !== "string") {
                throw new Error("file does not exist");
              }

              const loader = mediaTypeToLoader(pluginData.mediaType);
              const resolveDir = fromFileUrl(dirname(path));

              return {
                contents,
                loader,
                pluginData: args.pluginData,
                resolveDir,
              };
            }

            case "data:": {
              const result = await fetch(url);
              const contents = await result.text();
              const loader = mediaTypeToLoader(pluginData.mediaType);

              return { contents, loader };
            }

            default: {
              throw new Error("unsupported");
            }
          }
        },
      );

      build.onLoad({ filter: /.*/, namespace: Namespace.Disabled }, () => {
        return { contents: "" };
      });
    },
  };
}

function resolveImporter(importer: string, namespace: string): URL {
  if (namespace === "file") return toFileUrl(importer);

  const urlLike = URL.parse(importer);

  if (urlLike) return urlLike;

  if (isAbsolute(importer)) return toFileUrl(importer);

  throw new Error();
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
