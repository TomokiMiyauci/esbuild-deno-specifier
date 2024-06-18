import { denoDataURLSpecifierPlugin, fileURLResolverPlugin } from "./plugin.ts";
import { afterAll, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { build, stop } from "esbuild";

afterAll(() => {
  return stop();
});

describe("fileURLResolverPlugin", () => {
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

describe("denoDataURLSpecifierPlugin", () => {
  it("should resolve data url with media type of javascript", async () => {
    const result = await build({
      stdin: {
        contents: `import "data:text/javascript,console.log();";`,
      },
      plugins: [denoDataURLSpecifierPlugin],
      bundle: true,
      format: "esm",
      write: false,
      minify: true,
    });

    expect(result.outputFiles[0].text).toBe(
      `console.log();
`,
    );
  });

  it("should resolve data url with media type of typescript", async () => {
    const result = await build({
      stdin: {
        contents:
          `import "data:text/typescript,type A = string;console.log();";`,
      },
      plugins: [denoDataURLSpecifierPlugin],
      bundle: true,
      format: "esm",
      write: false,
      minify: true,
    });

    expect(result.outputFiles[0].text).toBe(
      `console.log();
`,
    );
  });

  it("should resolve data url with media type of jsx", async () => {
    const result = await build({
      stdin: {
        contents: `import "data:text/jsx,console.log(<div />);"`,
      },
      plugins: [denoDataURLSpecifierPlugin],
      bundle: true,
      format: "esm",
      write: false,
    });

    expect(result.outputFiles[0].text).toBe(
      `// deno-data:data:text/jsx,console.log(<div />);
console.log(/* @__PURE__ */ React.createElement("div", null));
`,
    );
  });

  it("should resolve data url with media type of tsx", async () => {
    const result = await build({
      stdin: {
        contents:
          `import "data:text/tsx,type A = string;console.log(<div />);"`,
      },
      plugins: [denoDataURLSpecifierPlugin],
      bundle: true,
      format: "esm",
      write: false,
    });

    expect(result.outputFiles[0].text).toBe(
      `// deno-data:data:text/tsx,type A = string;console.log(<div />);
console.log(/* @__PURE__ */ React.createElement("div", null));
`,
    );
  });

  it("should throw error if the media type is json", async () => {
    await expect(build({
      stdin: {
        contents: `import "data:application/json,{}";`,
      },
      plugins: [denoDataURLSpecifierPlugin],
      bundle: true,
      format: "esm",
      write: false,
      minify: true,
      logLevel: "silent",
    })).rejects.toThrow(
      `Expected a JavaScript or TypeScript module, but identified a Json module. Consider importing Json modules with an import attribute with the type of "json".`,
    );
  });

  it("should throw error if the media type is not supported", async () => {
    await expect(build({
      stdin: {
        contents: `import "data:text/unknown,";`,
      },
      plugins: [denoDataURLSpecifierPlugin],
      bundle: true,
      format: "esm",
      write: false,
      minify: true,
      logLevel: "silent",
    })).rejects.toThrow(
      `Expected a JavaScript or TypeScript module, but identified a Unknown module. Importing these types of modules is currently not supported.`,
    );
  });
});
