import { isLikePath, type Package, parseNpmPkg } from "./utils.ts";
import { describe, expect, it } from "../dev_deps.ts";

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
