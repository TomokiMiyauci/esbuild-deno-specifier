import {
  matchSideEffects,
  normalizeSideEffects,
  type SideEffects,
  validateSideEffects,
} from "./side_effects.ts";
import { describe, expect, it } from "../dev_deps.ts";

describe("validateSideEffects", () => {
  it("should return true", () => {
    const table = [
      true,
      false,
      [],
      ["a"],
      ["a", "b", "c"],
    ];

    table.forEach((value) => {
      expect(validateSideEffects(value)).toBeTruthy();
    });
  });

  it("should return false", () => {
    const table = [
      "",
      "a",
      0,
      1,
      1n,
      null,
      undefined,
      {},
      { a: 0 },
      [null],
      [0],
      ["a", "b", 0],
    ];

    table.forEach((value) => {
      expect(validateSideEffects(value)).toBeFalsy();
    });
  });
});

describe("normalizeSideEffects", () => {
  it("should return normalized sideEffects", () => {
    const table: [SideEffects, string, SideEffects][] = [
      [false, "", false],
      [true, "", true],
      [[], "/", []],
      [["./src/main.js"], "/", ["/src/main.js"]],
      [["./src/main.js"], "/Users/user", ["/Users/user/src/main.js"]],
      [["*.css"], "/Users/user", ["/Users/user/*.css"]],
      [["./*.css"], "/Users/user", ["/Users/user/*.css"]],
      [["**/*.css"], "/Users/user", ["/Users/user/**/*.css"]],
      [["./src/some-side-effectful-file.js", "*.css"], "/Users/user", [
        "/Users/user/src/some-side-effectful-file.js",
        "/Users/user/*.css",
      ]],
      [["./{a,b}/main.js", "[abc]d.js"], "/Users/user", [
        "/Users/user/{a,b}/main.js",
        "/Users/user/[abc]d.js",
      ]],
    ];

    table.forEach(([sideEffects, packagePath, expected]) => {
      expect(normalizeSideEffects(sideEffects, packagePath)).toEqual(expected);
    });
  });
});

describe("matchSideEffects", () => {
  it("should return true", () => {
    const table: [SideEffects, string][] = [
      [true, ""],
      [["/Users/user/*.css"], "/Users/user/main.css"],
      [["/Users/user/**/*.css"], "/Users/user/date/main.css"],
      [["/Users/user/[abc]/main.js"], "/Users/user/b/main.js"],
      [
        ["/package.*", "/Users/package.*", "/Users/user/package.*"],
        "/Users/user/package.json",
      ],
      [["/Users/user/{a,b}/main.js"], "/Users/user/b/main.js"],
    ];

    table.forEach(([sideEffects, packagePath]) => {
      expect(matchSideEffects(sideEffects, packagePath)).toBeTruthy();
    });
  });

  it("should return false", () => {
    const table: [SideEffects, string][] = [
      [false, ""],
      [["/Users/user/*.css"], "/Users/user/main.js"],
      [["*.css", "*.js"], "/Users/user/main.js"],
      [["./*.css", "./*.js"], "/Users/user/main.js"],
      [["/[abc]/main.js"], "/d/main.js"],
    ];

    table.forEach(([sideEffects, packagePath]) => {
      expect(matchSideEffects(sideEffects, packagePath)).toBeFalsy();
    });
  });
});
