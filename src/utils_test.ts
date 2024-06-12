import {
  getAllExtensions,
  isLikePath,
  type Package,
  parseNpmPkg,
  resolveLongestExt,
  splitExts,
} from "./utils.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";

describe("isLikePath", () => {
  it("should return true", () => {
    const table = [
      "./",
      "../",
      "/",
      "./abc",
      "../def",
      "/Users/user",
    ];

    table.forEach((value) => {
      expect(isLikePath(value)).toBeTruthy();
    });
  });

  it("should return false", () => {
    const table = [
      "",
      "package",
      "@package",
      "@scope/package",
      " ",
      ".",
      " ./",
      " ../",
      " /",
    ];

    table.forEach((value) => {
      expect(isLikePath(value)).toBeFalsy();
    });
  });
});

describe("parseNpmPkg", () => {
  it("should return parsed result", () => {
    const table: [string, Package][] = [
      ["", { name: "", subpath: "." }],
      ["package", { name: "package", subpath: "." }],
      ["package/subpath", { name: "package", subpath: "./subpath" }],
      ["@scope/package", { name: "@scope/package", subpath: "." }],
      ["@scope/package/subpath", {
        name: "@scope/package",
        subpath: "./subpath",
      }],
      ["@scope/package/subpath/nested", {
        name: "@scope/package",
        subpath: "./subpath/nested",
      }],
    ];

    table.forEach(([specifier, pkg]) => {
      expect(parseNpmPkg(specifier)).toEqual(pkg);
    });
  });
});

describe("resolveLongestExt", () => {
  it("should resolve with simple extension", () => {
    const map = {
      ".js": "js",
      ".jsx": "jsx",
      ".ts": "ts",
    };

    const table: [string, string][] = [
      ["file.js", "js"],
      ["file.jsx", "jsx"],
      ["file.ts", "ts"],
    ];

    for (const [path, expected] of table) {
      expect(resolveLongestExt(path, map)).toBe(expected);
    }
  });

  it("should resolve with multiple extension", () => {
    const map = {
      ".ts": "ts",
      ".d.ts": "dts",
      ".x.y.z": "xyz",
    };

    const table: [string, string][] = [
      ["file.ts", "ts"],
      ["file.d.ts", "dts"],
      ["a.b.c.d.ts", "dts"],
      ["d.unknown.ts", "ts"],
      ["d.d.ts", "dts"],
      ["d.ts.d.ts", "dts"],
      ["ts.d.ts", "dts"],
      ["a.x.y.z", "xyz"],
      ["a.b.c.x.y.z", "xyz"],
    ];

    for (const [path, expected] of table) {
      expect(resolveLongestExt(path, map)).toBe(expected);
    }
  });
});

describe("getAllExtensions", () => {
  it("should return array", () => {
    const table: [string, string[]][] = [
      ["", []],
      ["file.a", [".a"]],
      ["file.a.b", [".a.b", ".b"]],
      ["file.a.b.c", [".a.b.c", ".b.c", ".c"]],
      ["file.a.b.c.d.", [".a.b.c.d.", ".b.c.d.", ".c.d.", ".d.", "."]],
      [".a.b.c", [".b.c", ".c"]],
      [" ", []],
      [" .", ["."]],
      [" .a", [".a"]],
      [".", []],
      [". ", []],
      [".a", []],
    ];

    for (const [input, expected] of table) {
      expect(getAllExtensions(input)).toEqual(expected);
    }
  });
});

describe("splitExts", () => {
  it("should return iterable", () => {
    const table: [string, string[]][] = [
      ["", []],
      ["file.a", [".a"]],
      ["file.a.b", [".b", ".a"]],
      ["file.a.b.c", [".c", ".b", ".a"]],
      ["file.a.b.c.d.", [".", ".d", ".c", ".b", ".a"]],
    ];

    for (const [input, expected] of table) {
      expect([...splitExts(input)]).toEqual(expected);
    }
  });
});
