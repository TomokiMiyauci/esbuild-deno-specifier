import { info, ModuleEntry, type Plugin, resolveGlobal } from "../deps.ts";
import { fromFileUrl, toFileUrl } from "jsr:@std/path@^0.221.0";
import { argsToOptions } from "./utils.ts";
import { DenoDir } from "jsr:@deno/cache-dir@0.8.0";
import { exists } from "jsr:@std/fs@^0.221.0";

interface PluginData {
  deps: Map<string, { name: string; version: string }>;
}

export function npmResolver(): Plugin {
  return {
    name: "npm",
    setup(build) {
      build.onResolve({ filter: /^npm:/ }, async (args) => {
        const denoDir = new DenoDir().root;

        const { path: specifier } = args;

        const start = performance.now();
        const sourceFile = await info(specifier);
        const end = performance.now();
        console.log(end - start);

        const redirects = new Map<string, string>(
          Object.entries(sourceFile.redirects),
        );
        const normalized = redirects.has(specifier)
          ? redirects.get(specifier)!
          : specifier;

        const modules = new Map<string, ModuleEntry>(
          sourceFile.modules.map((entry) => [entry.specifier, entry]),
        );
        const module = modules.get(normalized);

        if (!module) throw new Error("Module not found");
        if ("error" in module) throw module.error;

        if (module.kind !== "npm") throw new Error();

        const npmPackage = module.npmPackage;
        const npm = sourceFile.npmPackages[npmPackage];
        const { name, version, dependencies } = npm;
        const subpath = `.${
          normalized.substring(`npm:/${name}@${version}`.length)
        }` as const;

        const url = await resolveGlobal({ name, version, subpath, denoDir }, {
          readFile: async (url) => {
            try {
              return await Deno.readTextFile(url);
            } catch (e) {
              if (e instanceof Deno.errors.NotFound) {
                return null;
              }

              if (e instanceof Deno.errors.InvalidData) {
                return null;
              }

              throw e;
            }
          },
          existFile: (url) => {
            return exists(url, { isFile: true });
          },
          existDir: (url) => {
            return exists(url, { isDirectory: true });
          },
        });

        if (url.protocol === "file:") {
          const path = fromFileUrl(url);
          const entries = dependencies.map((dep) => {
            const npm = sourceFile.npmPackages[dep]!;

            return [npm.name, npm] as const;
          });
          const deps = new Map<string, { name: string; version: string }>(
            entries,
          );
          const pluginData = { deps } satisfies PluginData;

          return { path, watchFiles: [path], namespace: "npm", pluginData };
        }

        return build.resolve(url.toString(), argsToOptions(args));
      });

      build.onResolve({ filter: /.*/, namespace: "npm" }, (args) => {
        if (
          args.path.startsWith("./") ||
          args.path.startsWith("../") ||
          args.path.startsWith("/")
        ) {
          const path = fromFileUrl(
            new URL(args.path, toFileUrl(args.importer)),
          );

          return { path, namespace: "npm", pluginData: args.pluginData };
        }

        if (URL.canParse(args.path)) {
          return build.resolve(args.path, {
            kind: args.kind,
            importer: args.importer,
            resolveDir: args.resolveDir,
          });
        }

        // TODO: treat package.json imports field

        const pkg = parsePackage(args.path);
        const pluginData = args.pluginData as PluginData;

        const { name, version } = pluginData.deps.get(pkg.name)!;

        const specifier = `npm:/${name}@${version}${
          pkg.subpath === "." ? "" : pkg.subpath.slice(1)
        }`;

        return build.resolve(specifier, {
          kind: args.kind,
          importer: args.importer,
          resolveDir: args.resolveDir,
          namespace: "npm",
        });
      });

      build.onLoad({ filter: /.*/, namespace: "npm" }, async (args) => {
        const contents = await Deno.readTextFile(args.path);

        return {
          contents,
          pluginData: args.pluginData,
        };
      });
    },
  };
}

function parsePackage(specifier: string) {
  let packageName: string;

  if (!specifier.startsWith("@")) {
    const index = specifier.indexOf("/");

    // 1. Set packageName to the substring of packageSpecifier until the first "/" separator or the end of the string.
    packageName = index !== -1 ? specifier.substring(0, index) : specifier;
  } else {
    if (!specifier.includes("/")) {
      throw new Error();
    }

    const index = secondIndexOf(specifier, "/");
    // 2. Set packageName to the substring of packageSpecifier until the second "/" separator or the end of the string.
    packageName = index !== -1 ? specifier.substring(0, index) : specifier;
  }

  if (
    packageName.startsWith(".") ||
    packageName.includes("\\") ||
    packageName.includes("%")
  ) {
    // 1. Throw an Invalid Module Specifier error.
    throw new Error();
  }

  const subpath = `.${specifier.substring(packageName.length)}` as const;

  return {
    name: packageName,
    subpath,
  };
}

export function secondIndexOf(input: string, searchString: string): number {
  const firstIndex = input.indexOf(searchString);

  if (firstIndex === -1) return -1;

  return input.indexOf(searchString, firstIndex + 1);
}
