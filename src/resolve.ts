import {
  dirname,
  fromFileUrl,
  join,
  Module,
  type OnResolveResult,
  PackageJson,
  Platform,
  readPackageJson,
  type Source,
  toFileUrl,
} from "../deps.ts";
import { require } from "./modules/npm.ts";
import { resolveEsModuleDependency } from "./modules/esm.ts";
import { Namespace } from "./constants.ts";
import { isLikePath, isObject, normalizePlatform } from "./utils.ts";
import { resolveBrowser } from "./browser.ts";
import { readFile } from "./context.ts";

interface Context {
  module: Module;
  conditions: string[];
  // npm: boolean;
  source: Source;
}

export async function resolve(
  specifier: string,
  referrer: string,
  context: Context & {
    platform: Platform | undefined;
    next: (specifier: string) => Promise<OnResolveResult> | OnResolveResult;
  },
): Promise<OnResolveResult> {
  switch (context.module.kind) {
    case "asserted":
    case "node": {
      throw new Error("unreachable");
    }

    case "esm": {
      return resolveEsModuleDependency(context.module, {
        conditions: context.conditions,
        referrer,
        source: context.source,
        specifier,
      });
    }

    case "npm": {
      const closest = await findClosest(toFileUrl(referrer));

      if (!closest) throw new Error("Cannot find");

      const { pjson, packageURL } = closest;

      const browser = pjson?.browser;
      const platform = normalizePlatform(context.platform);

      if (platform === "browser" && isObject(browser)) {
        const result = resolveBrowser(specifier, browser);

        if (result) {
          if (result.specifier === null) {
            // TODO
            // const path = isLikePath(specifier)
            //   ? fromFileUrl(join(packageURL, specifier))
            //   : specifier;

            return { path: "xxx", namespace: Namespace.Disabled };
          } else {
            specifier = result.specifier;
          }
        }
      }

      return require(specifier, referrer, {
        conditions: context.conditions,
        module: context.module,
        source: context.source,
        packageURL,
        pjson,
        next: context.next.bind(context),
      });
    }
  }
}

async function findClosest(
  url: URL,
): Promise<{ pjson: PackageJson; packageURL: URL } | undefined> {
  for (const packageURL of parents(url)) {
    const pjson = await readPackageJson(packageURL, { readFile });

    if (pjson) {
      return {
        pjson,
        packageURL,
      };
    }
  }
}

function* parents(url: URL): Iterable<URL> {
  const dir = dirname(url);

  if (dir.pathname !== url.pathname) {
    yield dir;
    yield* parents(dir);
  }
}
