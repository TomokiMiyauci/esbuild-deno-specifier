import { info, type InfoOptions, MediaType } from "@deno/info";
import type { LogLevel, Plugin } from "esbuild";
import { DenoDir } from "@deno/cache-dir";
import { fromFileUrl } from "@std/path/from-file-url";
import { join } from "@std/path/join";
import { toFileUrl } from "@std/path/to-file-url";
import { type LevelName } from "@std/log/levels";
import { setup } from "@std/log/setup";
import { ConsoleHandler } from "@std/log/console-handler";
import { isAbsolute } from "@std/path/is-absolute";
import { fromSpecifier } from "@deno/media-type";
import type { PluginData } from "./types.ts";
import { Msg, Namespace } from "./constants.ts";
import { mediaTypeToLoader, memo } from "./utils.ts";
import { createResolve, type Resolve } from "./resolve.ts";
import { loadFileURL, loadHttpURL } from "./load.ts";
import { GlobalStrategy, LocalStrategy } from "./strategy.ts";
import { resolveReferrer } from "./referrer.ts";
import { existDir, existFile, readFile, realURL } from "./io.ts";
import { normalizeLoader, normalizeLogLevel } from "./option.ts";
import { format } from "@miyauci/format";

export interface DenoSpecifierPluginOptions {
  /** Enables or disables the use of a local node_modules folder for npm packages.
   *
   * @default false
   */
  nodeModulesDir?: boolean;

  /**
   * @default DENO_DIR
   */
  denoDir?: string;

  /** Check the specified lock file. */
  lock?: string;
}

export function denoSpecifierPlugin(
  options: DenoSpecifierPluginOptions = {},
): Plugin {
  return {
    name: "deno-specifier",
    async setup(build) {
      const DENO_DIR = options.denoDir ?? new DenoDir().root;
      const cwd = build.initialOptions.absWorkingDir || Deno.cwd();
      const lock = typeof options.lock === "string"
        ? isAbsolute(options.lock) ? options.lock : join(cwd, options.lock)
        : undefined;
      const baseOptions = {
        json: true,
        noConfig: true,
        lock,
        env: { DENO_DIR },
        cwd,
      } satisfies InfoOptions;
      const infoOptions = options.nodeModulesDir
        ? { ...baseOptions, nodeModulesDir: true } satisfies InfoOptions
        : baseOptions;
      const cachedInfo = memo((specifier: string) =>
        info(specifier, infoOptions)
      );
      const cachedExistFile = memo(existFile);
      const cachedExistDir = memo(existDir);
      const cachedReadFile = memo(readFile);
      const cachedRealURL = memo(realURL);
      async function readStrict(url: URL): Promise<string> {
        const contents = await cachedReadFile(url);

        if (typeof contents !== "string") {
          throw new Error("file does not exist");
        }

        return contents;
      }

      const strategy = options.nodeModulesDir
        ? new LocalStrategy(toFileUrl(cwd))
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
      if (level) {
        setup({
          handlers: { console: new ConsoleHandler(level) },
          loggers: {
            "deno": { level, handlers: ["console"] },
          },
        });
      }

      const resolve = createResolve(build.initialOptions, resolveOptions);

      await denoLocalSpecifierPlugin.setup(build);
      await denoRemoteSpecifierPlugin({ read: readStrict, resolve })
        .setup(build);
    },
  };
}

const fileURLResolverPlugin: Plugin = {
  name: "file-url",
  setup(build) {
    build.onResolve({ filter: /^file:/ }, (args) => {
      const { path, kind, importer, resolveDir } = args;
      const specifier = fromFileUrl(path);

      return build.resolve(specifier, {
        kind,
        importer,
        resolveDir,
        namespace: "file",
        with: args.with,
      });
    });
  },
};

const denoLocalSpecifierPlugin: Plugin = {
  name: "deno-local-specifier",
  async setup(build) {
    await fileURLResolverPlugin.setup(build);

    build.onResolve(
      { filter: /^data:/ },
      (args) => {
        const { path } = args;

        const mediaType = fromSpecifier(path);

        switch (mediaType) {
          case "JavaScript":
          case "JSX":
          case "TypeScript":
          case "TSX": {
            return {
              path,
              namespace: Namespace.DenoData,
              pluginData: mediaType,
            };
          }

          case "Json": {
            throw new Error(Msg.InvalidMediaTypeOfJson);
          }

          default: {
            const message = format(Msg.InvalidMediaType, { mediaType });

            throw new Error(message);
          }
        }
      },
    );

    build.onLoad(
      { filter: /.*/, namespace: Namespace.DenoData },
      async (args) => {
        const pluginData = args.pluginData as MediaType;

        const response = await fetch(args.path);
        const contents = await response.text();
        const loader = mediaTypeToLoader(pluginData);

        return { contents, loader };
      },
    );
  },
};

interface DenoRemoteSpecifierPluginArgs {
  read(url: URL): Promise<string> | string;
  resolve: Resolve;
}

function denoRemoteSpecifierPlugin(
  context: DenoRemoteSpecifierPluginArgs,
): Plugin {
  return {
    name: "deno-remote-specifier",
    setup(build) {
      const isExternal = build.initialOptions.packages === "external";
      const loader = normalizeLoader(build.initialOptions.loader);

      build.onResolve(
        { filter: /^npm:|^jsr:|^https?:^node:/ },
        (args) => {
          if (isExternal) return { external: true };

          const referrer = resolveReferrer(args);
          const { path: specifier, kind } = args;

          return context.resolve(specifier, referrer, { kind });
        },
      );

      build.onResolve(
        { filter: /.*/, namespace: Namespace.DenoUrl },
        async (args) => {
          const pluginData = args.pluginData as PluginData;
          const { module, source } = pluginData;
          const { path: specifier, importer: referrer, kind } = args;

          return await context.resolve(specifier, referrer, { kind }, {
            module,
            source,
          });
        },
      );

      build.onLoad(
        { filter: /.*/, namespace: Namespace.DenoUrl },
        (args) => {
          const url = new URL(args.path);
          const pluginData = args.pluginData as PluginData;

          switch (url.protocol) {
            case "http:":
            case "https:":
              return loadHttpURL(null, pluginData, context.read);

            case "file:":
              return loadFileURL(url, pluginData, context.read, loader);

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
