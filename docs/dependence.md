# Dependence

This section lists the elements on which the project depends.

## Runtime

Currently, running this plugin requires the Deno runtime. This is because it
runs `deno info` internally. This may change in the future.

### Permission

The following flags are required to run this plugin:

- --allow-env(If the `denoDir` field is not specified)
- --allow-read
- --allow-run

## Esbuild options

The following fields may be referenced in the build options:

- [`platform`](https://esbuild.github.io/api/#platform)
- [`conditions`](https://esbuild.github.io/api/#conditions)
- [`mainFields`](https://esbuild.github.io/api/#main-fields)
- [`packages`](https://esbuild.github.io/api/#packages)
- [`resolveExtensions`](https://esbuild.github.io/api/#resolve-extensions)
- [`logLevel`](https://esbuild.github.io/api/#main-fields)

### Packages

If the `packages` field is `external`, the plugin will mark the deno specifiers
other than `file:` as `external`. This is appropriate for generating server-side
bundling.

```ts
import { build } from "esbuild";
import { denoSpecifierPlugin } from "@miyauci/esbuild-deno-specifier";

await build({
  stdin: {
    contents: `import "./main.css";
import * as module from "npm:react";`,
    resolveDir: import.meta.dirname,
  },
  packages: "external",
  bundle: true,
  format: "esm",
  plugins: [denoSpecifierPlugin()],
});
```

### Log level

If `logLevel` field is `verbose`, simple logs are output.

```ts
import { build } from "esbuild";
import { denoSpecifierPlugin } from "@miyauci/esbuild-deno-specifier";

await build({ logLevel: "verbose", plugins: [denoSpecifierPlugin()] });
```

### Others

`conditions`, `mainFields` or `resolveExtensions` fields are specified, npm
module resolution is performed using them in the same way as esbuild builtin.
