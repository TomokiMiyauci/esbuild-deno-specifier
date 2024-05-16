import {
  ConsoleHandler,
  info,
  type Plugin,
  setup,
  type Source,
  toFileUrl,
} from "../deps.ts";
import type { DataPluginData, PluginData } from "./types.ts";
import { Namespace } from "./constants.ts";
import { logger, mediaTypeToLoader } from "./utils.ts";
import { createResolve } from "./resolve.ts";
import { readFile } from "./context.ts";

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

      const sourceCache = new Map<string, Source>();

      const cachedInfo = async (specifier: string): Promise<Source> => {
        const source = sourceCache.has(specifier)
          ? sourceCache.get(specifier)!
          : await info(specifier);

        sourceCache.set(specifier, source);

        return source;
      };

      build.onResolve(
        { filter: /^npm:|^jsr:|^https?:|^data:|^node:|^file:/ },
        ({ path: specifier, kind, importer: referrer }) => {
          logger().info(
            `Resolving import "${specifier}" from "${referrer}"`,
          );

          const resolve = createResolve(build.initialOptions, { kind });

          return resolve(specifier, "", { info: cachedInfo });
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

        return resolve(specifier, referrer, { info: cachedInfo }, {
          module,
          source,
        });
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
