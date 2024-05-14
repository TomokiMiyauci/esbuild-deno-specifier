import {
  detectFormat,
  type Format,
  formatFromExt,
  loadAsFile,
} from "./require.ts";
import { describe, expect, it } from "../dev_deps.ts";

const noPjson = {
  indexJs: new URL(import.meta.resolve(
    "../tests/fixtures/node_modules/no-pjson/index.js",
  )),
  mainNode: new URL(import.meta.resolve(
    "../tests/fixtures/node_modules/no-pjson/main.node",
  )),
};

const emptyPjson = {
  indexJs: new URL(import.meta.resolve(
    "../tests/fixtures/node_modules/empty-pjson/index.js",
  )),
  pjson: new URL(
    import.meta.resolve(
      "../tests/fixtures/node_modules/empty-pjson/package.json",
    ),
  ),
};

const esmPjson = {
  indexJs: new URL(import.meta.resolve(
    "../tests/fixtures/node_modules/esm-pjson/index.js",
  )),
};

describe("loadAsFile", () => {
  it("should return result if the url exists", async () => {
    await expect(loadAsFile(noPjson.indexJs)).resolves.toEqual({
      url: new URL(noPjson.indexJs),
      format: "commonjs",
    });
  });

  it("should return result if the url with .js exists and the package does not have package.json", async () => {
    const url = import.meta.resolve(
      "../tests/fixtures/node_modules/no-pjson/index",
    );

    await expect(loadAsFile(url)).resolves.toEqual({
      url: noPjson.indexJs,
      format: "commonjs",
    });
  });

  it("should return result if the url with .js exists and the package.json of `type` field is empty", async () => {
    const url = import.meta.resolve(
      "../tests/fixtures/node_modules/empty-pjson/index",
    );

    await expect(loadAsFile(url)).resolves.toEqual({
      url: emptyPjson.indexJs,
      format: "commonjs",
    });
  });

  it("should return result if the url with .js exists and the package.json of `type` field is `module`", async () => {
    const url = import.meta.resolve(
      "../tests/fixtures/node_modules/esm-pjson/index",
    );

    await expect(loadAsFile(url)).resolves.toEqual({
      url: esmPjson.indexJs,
      format: "module",
    });
  });

  it("should return result if the url with .json exists", async () => {
    const url = import.meta.resolve(
      "../tests/fixtures/node_modules/empty-pjson/package",
    );

    await expect(loadAsFile(url)).resolves.toEqual({
      url: emptyPjson.pjson,
      format: "json",
    });
  });

  it("should return result if the url with .node exists", async () => {
    const url = import.meta.resolve(
      "../tests/fixtures/node_modules/no-pjson/main",
    );

    await expect(loadAsFile(url)).resolves.toEqual({
      url: noPjson.mainNode,
      format: undefined,
    });
  });

  it("should return result if the url does not exist", async () => {
    const url = import.meta.resolve(
      "../tests/fixtures/node_modules/not-found",
    );

    await expect(loadAsFile(url)).resolves.toBe(undefined);
  });
});

describe("formatFromExt", () => {
  it("should return format without IO", async () => {
    const table: [string, Format | undefined][] = [
      ["file:///main.json", "json"],
      ["file:///main.mjs", "module"],
      ["file:///main.cjs", "commonjs"],
      ["file:///main.wasm", "wasm"],
    ];

    await Promise.all(table.map(async ([url, format]) => {
      await expect(formatFromExt(url)).resolves.toBe(format);
    }));
  });

  it("should return format with IO", async () => {
    const table: [URL | string, Format | undefined][] = [
      [emptyPjson.indexJs, "commonjs"],
      [esmPjson.indexJs, "module"],
    ];

    await Promise.all(table.map(async ([url, format]) => {
      await expect(formatFromExt(url)).resolves.toBe(format);
    }));
  });
});

describe("detectFormat", () => {
  it("should return commonjs", () => {
    const table = [
      undefined,
      null,
      {},
      { type: "commonjs" },
      { type: "unknown" },
      { type: [] },
    ];

    table.forEach((input) => {
      expect(detectFormat(input)).toBe("commonjs");
    });
  });

  it("should return module", () => {
    expect(detectFormat({ type: "module" })).toBe("module");
  });
});
