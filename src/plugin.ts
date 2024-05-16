import {
  ConsoleHandler,
  DenoDir,
  exists,
  info,
  type Plugin,
  setup,
  toFileUrl,
} from "../deps.ts";
import type { DataPluginData, PluginData } from "./types.ts";
import { Namespace } from "./constants.ts";
import { logger, mediaTypeToLoader } from "./utils.ts";
import { createResolve } from "./resolve.ts";

function existFile(url: URL): Promise<boolean> {
  return exists(url, { isFile: true });
}

function existDir(url: URL): Promise<boolean> {
  return exists(url, { isDirectory: true });
}

async function readFile(url: URL): Promise<string | null> {
  try {
    const value = await Deno.readTextFile(url);

    return value;
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

function memo<Arg, R>(
  fn: (arg: Arg) => Promise<R>,
  cache: Map<string, R> = new Map(),
): (arg: Arg) => Promise<R> {
  return async (arg) => {
    const key = String(arg);

    if (cache.has(key)) return cache.get(key)!;

    const result = await fn(arg);

    cache.set(key, result);

    return result;
  };
}

export function denoPlugin(): Plugin {
  return {
    name: "deno",
    setup(build) {
      setup({
        handlers: {
          console: new ConsoleHandler("INFO"),
        },
        loggers: {
          "deno": {
            level: "INFO",
            handlers: ["console"],
          },
        },
      });

      const cachedInfo = memo(info);
      const cachedExistFile = memo(existFile);
      const cachedExistDir = memo(existDir);
      const cachedReadFile = memo(readFile);
      const denoDir = new DenoDir().root;

      const options = {
        info: cachedInfo,
        existDir: cachedExistDir,
        existFile: cachedExistFile,
        readFile: cachedReadFile,
        denoDir,
      };

      build.onResolve(
        { filter: /^npm:|^jsr:|^https?:|^data:|^node:|^file:/ },
        ({ path: specifier, kind, importer: referrer }) => {
          logger().info(
            `Resolving import "${specifier}" from "${referrer}"`,
          );

          const resolve = createResolve(build.initialOptions, { kind });

          return resolve(specifier, "", options);
        },
      );

      build.onResolve({ filter: /.*/, namespace: Namespace.Deno }, (args) => {
        logger().info(
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

          return { contents, loader, pluginData: args.pluginData };
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
