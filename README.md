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
- [Requirements](#requirements)
  - [Permissions](#permissions)
- [API](#api)
- [FAQ](#faq)
  - [Why did you reimplement the npm module resolution algorithm?](#why-did-you-reimplement-the-npm-module-resolution-algorithm)
  - [Is import-maps supported?](#is-import-maps-supported)
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
import { denoSpecifier } from "@miyauci/esbuild-deno-specifier";

await esbuild.build({
  plugins: [denoSpecifier()],
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
import { denoSpecifier } from "@miyauci/esbuild-deno-specifier";

await esbuild.build({
  plugins: [denoSpecifier({ nodeModulesDir: true })],
  entryPoints: ["npm:react@^18"],
  bundle: true,
  format: "esm",
  absWorkingDir: import.meta.dirname,
});
```

This requires the `absWorkingDir` field to be specified in esbuild options. If
not specified, an error will be thrown.

The specifier would be resolved as follows:

| scheme | path                                   |
| ------ | -------------------------------------- |
| `jsr:` | `DENO_DIR`/deps/https/jsr.io/file      |
| `npm:` | `absWorkingDir`/node_modules/name/file |

### Specify `DENO_DIR`

In the `denoDir` field, change the `DENO_DIR`.

```ts
import { denoSpecifier } from "@miyauci/esbuild-deno-specifier";

const plugin = denoSpecifier({ denoDir: "/path/to/deno_dir" });
```

## Requirements

Currently, running this plugin requires the Deno runtime. This is because it
runs `deno info` internally. This may change in the future.

### Permissions

The following flags are required to run this plugin:

- --allow-env(If the `denoDir` field is not specified)
- --allow-read
- --allow-run

## API

See [jsr doc](https://jsr.io/@miyauci/esbuild-deno-specifier) for all APIs.

## FAQ

### Why did you reimplement the npm module resolution algorithm?

esbuild contains the `node_modules` resolution algorithm. It is possible to do
so through the `build.resolve` API.

Unfortunately, this API cannot perform **only node_modules resolution**.

This API may also execute the resolve hooks provided by other plugins.

This can lead to a mutual recursion, especially when import-maps is used.

Also, it is possible for Deno to cache Global's npm module is different from the
structure of `node_modules`.

Also, the npm modules that Deno caches globally are different from the structure
of `node_modules`.

Given the above, it was necessary to re-implement the npm module resolution
algorithm for Deno.

### Is import-maps supported?

No.

This project is only intended for Deno specifier resolution.

We plan to provide a separate all-in-one package for resolving all modules
supported by Deno (import-maps, `bare-node-builtins`, etc.).

## Contributing

See [contributing](CONTRIBUTING.md).

## License

[MIT](LICENSE) © 2024 Tomoki Miyauchi
