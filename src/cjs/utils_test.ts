import { detectFormat, formatFromExt } from "./utils.ts";
import type { Format } from "./types.ts";
import { describe, expect, it } from "../../dev_deps.ts";
import { emptyPjson, esmPjson } from "../../tests/fixtures/node_modules.ts";
import { readFile } from "../../tests/context.ts";

describe("formatFromExt", () => {
  it("should return format without IO", async () => {
    const table: [string, Format | undefined][] = [
      ["file:///main.json", "json"],
      ["file:///main.mjs", "module"],
      ["file:///main.cjs", "commonjs"],
      ["file:///main.wasm", "wasm"],
    ];

    await Promise.all(table.map(async ([url, format]) => {
      await expect(formatFromExt(url, { readFile })).resolves.toBe(format);
    }));
  });

  it("should return format with IO", async () => {
    const table: [URL | string, Format | undefined][] = [
      [emptyPjson.indexJs, "commonjs"],
      [esmPjson.indexJs, "module"],
    ];

    await Promise.all(table.map(async ([url, format]) => {
      await expect(formatFromExt(url, { readFile })).resolves.toBe(format);
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
