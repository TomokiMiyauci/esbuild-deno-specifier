import { join, toFileUrl } from "../deps.ts";
import { getParents } from "./npm/cjs/utils.ts";
import { IO } from "./types.ts";
import { createNpmRegistryURL } from "./utils.ts";

export class GlobalStrategy implements Strategy {
  #root: URL;
  resolveSymbolic = false;
  constructor(denoDir: string) {
    this.#root = createNpmRegistryURL(denoDir);
  }

  *getPackageURL({ name, version }: PackageArgs) {
    const packageURL = createPackageURL(this.root, name, version);

    yield packageURL;
  }

  get root(): URL {
    return this.#root;
  }
}

export class LocalStrategy implements Strategy {
  #root: URL;

  resolveSymbolic = true;
  constructor(nodeModulesDir: string) {
    this.#root = toFileUrl(nodeModulesDir);
  }

  *getPackageURL(args: PackageArgs): Iterable<URL> {
    const parents = args.isDep
      ? getParents(args.referrer, this.root)
      : [this.root];

    for (const parent of parents) {
      if (parent.pathname.endsWith("node_modules")) continue;

      yield join(parent, "node_modules", args.name);
    }
  }

  get root(): URL {
    return this.#root;
  }
}

export interface PackageArgs extends IO {
  name: string;
  version: string;
  referrer: URL;
  isDep: boolean;
}

export interface Strategy {
  resolveSymbolic: boolean;

  get root(): URL;

  getPackageURL(args: PackageArgs): AsyncIterable<URL> | Iterable<URL>;
}

function createPackageURL(
  npmRegistryURL: URL | string,
  name: string,
  version: string,
): URL {
  const packageURL = join(npmRegistryURL, name, version);

  return packageURL;
}
