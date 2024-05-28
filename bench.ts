import { denoSpecifier } from "./mod.ts";
import { build, BuildOptions } from "esbuild";
import { denoSpecifier as denoSpecifierBeta } from "jsr:@miyauci/esbuild-deno-specifier@1.0.0-beta.3";
import Esbuild from "npm:esbuild@^0.21.3";

const plugin = denoSpecifier();
const betaPlugin = denoSpecifierBeta();
const options = {
  entryPoints: ["npm:react@^18"],
  write: false,
  format: "esm",
  bundle: true,
} satisfies BuildOptions;
const GROUP = "build";

Deno.bench("@latest ", { baseline: true, group: GROUP }, async () => {
  await build({
    ...options,
    plugins: [plugin],
  });
});

Deno.bench("prev", { group: GROUP }, async () => {
  await Esbuild.build({
    ...options,
    plugins: [betaPlugin],
  });
});
