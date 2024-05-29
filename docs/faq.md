# FAQ

## Why did you reimplement the npm module resolution algorithm?

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

## Is import-maps supported?

No.

This project is only intended for Deno specifier resolution.

We plan to provide a separate all-in-one package for resolving all modules
supported by Deno (import-maps, `bare-node-builtins`, etc.).
