import { detectFormat, formatFromExt, getParents } from "./utils.ts";
import type { Format } from "./types.ts";
import { describe, expect, it } from "../../dev_deps.ts";
import { emptyPjson, esmPjson } from "../../tests/fixtures/node_modules.ts";
import { readFile, root } from "../../tests/context.ts";

describe("formatFromExt", () => {
  it("should return format without IO", async () => {
    const table: [string, Format | undefined][] = [
      ["file:///main.json", "json"],
      ["file:///main.mjs", "module"],
      ["file:///main.cjs", "commonjs"],
      ["file:///main.wasm", "wasm"],
    ];

    await Promise.all(table.map(async ([url, format]) => {
      await expect(formatFromExt(url, { readFile, root }))
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
      await expect(formatFromExt(url, { readFile, root })).resolves
        .toBe(
          format,
        );
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

describe("getParents", () => {
  it("should yield", () => {
    const table: [url: string, root: string, expected: string[]][] = [
      ["file:///Users", "file:///", ["file:///"]],
      ["file:///Users/", "file:///", ["file:///"]],
      ["file:///Users///", "file:///", ["file:///"]],
      ["file:///Users/main.ts", "file:///", ["file:///Users", "file:///"]],
      ["file:///Users/main.ts", "file:///Users", ["file:///Users"]],
      ["file:///Users/main.ts", "file:///Users/", ["file:///Users"]],
      ["file:///Users/main.ts", "file:///Users//", ["file:///Users"]],
      ["file:///Users/user/tests/testing.ts", "file:///", [
        "file:///Users/user/tests",
        "file:///Users/user",
        "file:///Users",
        "file:///",
      ]],
      ["file:///Users/user/tests/testing.ts", "file:///Users", [
        "file:///Users/user/tests",
        "file:///Users/user",
        "file:///Users",
      ]],
    ];

    table.forEach(([url, root, expected]) => {
      expect([...getParents(url, root)]).toEqual(
        expected.map((v) => new URL(v)),
      );
    });
  });

  it("should not yield anything", () => {
    const table: [url: string, root: string][] = [
      ["file:///", "file:///"],
      ["file:///Users", "file:///Users"],
      ["file:///Users/", "file:///Users"],
      ["file:///Users", "file:///Users/"],
      ["file:///Users//", "file:///Users"],
      ["file:///Users//", "file:///Users//"],
      ["file:///Users//", "file:///Users/"],
      ["file:///Users/", "file:///Users//"],
      ["file:///Users", "file:///Var"],
      ["file:///Users/user", "file:///user"],
      ["file:///", "unknown:///"],
    ];

    table.forEach(([url, root]) => {
      expect([...getParents(url, root)]).toEqual([]);
    });
  });
});
