import {
  type Dependency,
  info,
  type Loader,
  type MediaType,
  type ModuleEntry,
  type OnResolveArgs,
  type Plugin,
  type ResolveOptions,
} from "../deps.ts";

const NAMESPACE = "jsr";

interface PluginData {
  mediaType: MediaType;
  modules: Map<string, ModuleEntry>;
  deps: Map<string, string>;
  resolveDir: string;
}

export function jsrResolver(): Plugin {
  return {
    name: "jsr",
    setup(build) {
      build.onResolve({ filter: /^jsr:/ }, async (args) => {
        const { path: specifier } = args;

        const start = performance.now();
        const sourceFile = await info(args.path);
        const end = performance.now();

        console.log(end - start);

        const redirects = new Map<string, string>(
          Object.entries(sourceFile.redirects),
        );
        const normalized = redirects.has(specifier)
          ? redirects.get(specifier)!
          : specifier;

        const modules = new Map(sourceFile.modules.map(moduleEntryToEntry));
        const module = modules.get(normalized);

        if (!module) return build.resolve(args.path, argsToOptions(args));
        if ("error" in module) throw new Error(module.error);

        if (module.kind !== "esm") throw new Error("supports only ES Module");

        const { local: path, mediaType, dependencies } = module;

        if (path === null) throw new Error("local path does not defined");

        const deps = new Map(dependencies?.map(dependencyToEntry));
        const pluginData = {
          mediaType,
          modules,
          deps,
          resolveDir: args.resolveDir,
        } satisfies PluginData;

        return { path, namespace: NAMESPACE, watchFiles: [path], pluginData };
      });

      build.onResolve({ filter: /.*/, namespace: NAMESPACE }, (args) => {
        const pluginData = args.pluginData as PluginData;
        const specifier = pluginData.deps.get(args.path);

        if (!specifier) return build.resolve(args.path, argsToOptions(args));

        const module = pluginData.modules.get(specifier);
        if (!module) return build.resolve(args.path, argsToOptions(args));

        if ("error" in module) throw new Error(module.error);

        if (module.kind !== "esm") throw new Error("supports only ES Module");

        const { local: path, mediaType, dependencies } = module;

        if (path === null) throw new Error();

        const deps = new Map(dependencies?.map(dependencyToEntry));
        const plugin = {
          mediaType,
          modules: pluginData.modules,
          deps,
          resolveDir: args.resolveDir,
        } satisfies PluginData;

        return { path, pluginData: plugin, namespace: NAMESPACE };
      });

      build.onLoad({ filter: /.*/, namespace: NAMESPACE }, async (args) => {
        const pluginData = args.pluginData as PluginData;
        const contents = await Deno.readTextFile(args.path);
        const loader = toLoader(pluginData.mediaType);

        return {
          contents,
          loader,
          pluginData,
          resolveDir: pluginData.resolveDir,
        };
      });
    },
  };
}

function toLoader(mediaType: MediaType): Loader {
  switch (mediaType) {
    case "JavaScript":
    case "Mjs":
    case "Cjs": {
      return "js";
    }

    case "JSX": {
      return "jsx";
    }

    case "TypeScript":
    case "Mts":
    case "Cts":
    case "Dmts":
    case "Dcts":
    case "Dts": {
      return "ts";
    }

    case "TSX": {
      return "tsx";
    }
    case "Json": {
      return "json";
    }

    case "Wasm":
    case "TsBuildInfo":
    case "SourceMap":
    case "Unknown": {
      return "default";
    }
  }
}

function argsToOptions(args: OnResolveArgs): ResolveOptions {
  return {
    importer: args.importer,
    kind: args.kind,
    resolveDir: args.resolveDir,
    namespace: args.namespace,
    pluginData: args.pluginData,
  };
}

function dependencyToEntry(dep: Dependency): [string, string] {
  return [dep.specifier, dep.code.specifier];
}

function moduleEntryToEntry(module: ModuleEntry): [string, ModuleEntry] {
  return [module.specifier, module];
}
