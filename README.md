# esbuild-deno-specifier

Module resolution for Deno specifiers.

This project provides a solution to resolve the module specifier supported by
Deno.

Specifically, it resolves the following scheme as in the Deno runtime.

- `jsr:`
- `npm:`
- `https:` or `http:`
- `node:`
- `data:`
- `file:`

## Table of Contents <!-- omit in toc -->

- [Install](#install)
- [Background](#background)
- [Usage](#usage)
  - [Resolve with `node_modules`](#resolve-with-node_modules)
  - [Specify `DENO_DIR`](#specify-deno_dir)
- [Documents](#documents)
- [API](#api)
- [Contributing](#contributing)
- [License](#license)

## Install

deno:

```bash
deno add @miyauci/esbuild-deno-specifier
```

## Background

Esbuild implements a `node_modules` resolution algorithm that is compatible with
Node.js.

However, since Deno is different from Node.js, it is difficult to use it as is.

Therefore, we have reimplemented the module resolution algorithm for bundler.

## Usage

In Default, module resolution is performed by referring to Deno's Global cache.

```ts
import * as esbuild from "esbuild";
import { denoSpecifierPlugin } from "@miyauci/esbuild-deno-specifier";

await esbuild.build({
  plugins: [denoSpecifierPlugin()],
  entryPoints: ["jsr:@std/bytes"],
  bundle: true,
  format: "esm",
});
```

The specifier would be resolved as follows:

| scheme | path                                                |
| ------ | --------------------------------------------------- |
| `jsr:` | `DENO_DIR`/deps/https/jsr.io/file                   |
| `npm:` | `DENO_DIR`/npm/registry.npmjs.org/name/version/file |

### Resolve with `node_modules`

Change Npm module resolution to be done for local `node_modules`.

```ts
import * as esbuild from "esbuild";
import { denoSpecifierPlugin } from "@miyauci/esbuild-deno-specifier";

await esbuild.build({
  plugins: [denoSpecifierPlugin({ nodeModulesDir: "/path/to/node_modules" })],
  entryPoints: ["npm:react@^18"],
  bundle: true,
  format: "esm",
});
```

The specifier would be resolved as follows:

| scheme | path                              |
| ------ | --------------------------------- |
| `jsr:` | `DENO_DIR`/deps/https/jsr.io/file |
| `npm:` | `nodeModulesDir`/name/file        |

### Specify `DENO_DIR`

In the `denoDir` field, change the `DENO_DIR`.

```ts
import { denoSpecifierPlugin } from "@miyauci/esbuild-deno-specifier";

const plugin = denoSpecifierPlugin({ denoDir: "/path/to/deno_dir" });
```

## Documents

- [Dependence](./docs/dependence.md)
- [FAQ](./docs/faq.md)

## API

See [jsr doc](https://jsr.io/@miyauci/esbuild-deno-specifier) for all APIs.

## Contributing

See [contributing](CONTRIBUTING.md).

## License

[MIT](LICENSE) © 2024 Tomoki Miyauchi
