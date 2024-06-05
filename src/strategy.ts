import { join } from "@std/url/join";
import { toFileUrl } from "@std/path/to-file-url";
import { dirname } from "@std/path/dirname";
import { getParents } from "./npm/cjs/utils.ts";
import { IO } from "./types.ts";
import { createNpmRegistryURL } from "./utils.ts";

export class GlobalStrategy implements Strategy {
  #root: URL;
  resolveSymbolic = false;
  constructor(denoDir: string) {
    this.#root = createNpmRegistryURL(denoDir);
  }

  getPackageURL({ name, version }: PackageArgs) {
    const packageURL = createPackageURL(this.root, name, version);

    return packageURL;
  }

  get root(): URL {
    return this.#root;
  }
}

export class LocalStrategy implements Strategy {
  #root: URL;

  resolveSymbolic = true;
  constructor(nodeModulesDir: string) {
    const rootDir = dirname(nodeModulesDir);
    this.#root = toFileUrl(rootDir);
  }

  async getPackageURL(args: PackageArgs): Promise<URL | null> {
    const parents = args.isDep
      ? getParents(args.referrer, this.root)
      : [this.root];

    for (const parent of parents) {
      if (parent.pathname.endsWith("node_modules")) continue;

      const packageURL = join(parent, "node_modules", args.name);

      if (await args.existDir(packageURL)) return packageURL;
    }

    return null;
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

  getPackageURL(args: PackageArgs): Promise<URL | null> | URL | null;
}

function createPackageURL(
  npmRegistryURL: URL | string,
  name: string,
  version: string,
): URL {
  const packageURL = join(npmRegistryURL, name, version);

  return packageURL;
}
