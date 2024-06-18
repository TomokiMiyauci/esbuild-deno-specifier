import { fileURLResolverPlugin } from "./plugin.ts";
import { afterAll, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { build, stop } from "esbuild";

describe("fileURLResolverPlugin", () => {
  afterAll(() => {
    return stop();
  });

  it("should resolve file url to local path", async () => {
    const result = await build({
      stdin: {
        contents: `import "file:///";`,
        resolveDir: import.meta.dirname,
      },
      plugins: [fileURLResolverPlugin, {
        name: "test",
        setup(build) {
          build.onResolve({ filter: /.*/, namespace: "file" }, (args) => {
            expect(args).toEqual({
              path: "/",
              importer: "<stdin>",
              namespace: "file",
              resolveDir: import.meta.dirname,
              kind: "import-statement",
              pluginData: undefined,
              with: {},
            });

            return { path: "testing", namespace: "testing" };
          });

          build.onLoad({ filter: /.*/, namespace: "testing" }, () => {
            return { contents: "" };
          });
        },
      }],
      write: false,
      bundle: true,
      format: "esm",
    });

    expect(result.outputFiles[0].text).toBe("");
  });
});
