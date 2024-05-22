import { describe, expect, it } from "../../../dev_deps.ts";
import { fileFormat } from "./file_format.ts";
import type { Format } from "./types.ts";
import { emptyPjson, esmPjson } from "../../../tests/fixtures/node_modules.ts";
import { readFile, root } from "../../../tests/context.ts";

describe("fileFormat", () => {
  it("should return format without IO", async () => {
    const table: [string, Format | undefined][] = [
      ["file:///main.json", "json"],
      ["file:///main.mjs", "module"],
      ["file:///main.cjs", "commonjs"],
      ["file:///main.wasm", "wasm"],
    ];

    await Promise.all(table.map(async ([url, format]) => {
      await expect(fileFormat(url, { readFile, root }))
        .resolves.toBe(
          format,
        );
    }));
  });

  it("should return format with IO", async () => {
    const table: [URL | string, Format | undefined][] = [
      [emptyPjson.indexJs, "commonjs"],
      [esmPjson.indexJs, "module"],
    ];

    await Promise.all(table.map(async ([url, format]) => {
      await expect(fileFormat(url, { readFile, root })).resolves
        .toBe(
          format,
        );
    }));
  });
});
