import { join, toFileUrl } from "../deps.ts";
import { getParents } from "./cjs/utils.ts";
import { createPackageURL } from "./modules/npm.ts";
import { IO } from "./types.ts";
import { createNpmRegistryURL } from "./utils.ts";

export class GlobalStrategy implements Strategy {
  #root: URL;
  constructor(denoDir: string) {
    this.#root = createNpmRegistryURL(denoDir);
  }

  *resolve({ name, version }: ResolveArgs) {
    const packageURL = createPackageURL(this.root, name, version);

    yield packageURL;
  }

  get root(): URL {
    return this.#root;
  }
}

export class LocalStrategy implements Strategy {
  #root: URL;
  constructor(nodeModulesDir: string) {
    this.#root = toFileUrl(nodeModulesDir);
  }

  *resolve(args: ResolveArgs): Iterable<URL> {
    const parents = getParents(args.referrer, this.root);

    for (const parent of parents) {
      if (parent.pathname.endsWith("node_modules")) continue;

      yield join(parent, "node_modules", args.name);
    }
  }

  get root(): URL {
    return this.#root;
  }
}

interface ResolveArgs extends IO {
  name: string;
  version: string;
  referrer: URL;
}

export interface Strategy {
  get root(): URL;

  resolve(args: ResolveArgs): AsyncIterable<URL> | Iterable<URL>;
}
