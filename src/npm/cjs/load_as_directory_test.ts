import {
  loadAsDirectory,
  resolveField,
  resolveFields,
} from "./load_as_directory.ts";
import { describe, expect, it, type PackageJson } from "../../../dev_deps.ts";
import {
  emptyPjson,
  noPjson,
  pjsonMain,
  pjsonMain2,
  pjsonMainModule,
  pjsonNoMain,
} from "../../../tests/fixtures/node_modules.ts";
import { existDir, existFile, readFile, root } from "../../../tests/context.ts";

describe("loadAsDirectory", () => {
  it("should resolve as index if the package.json does not exist and index.js exist", async () => {
    await expect(
      loadAsDirectory(noPjson.packageURL, {
        mainFields: [],
        readFile,
        existFile,
        root,
        specifier: "",
        conditions: [],
        existDir,
        *getPackageURL() {},
      }),
    )
      .resolves.toEqual(new URL(noPjson.indexJs));
  });

  it("should resolve as index if the package.json does not includes any `mainFields`", async () => {
    await expect(
      loadAsDirectory(emptyPjson.packageURL, {
        mainFields: [],
        readFile,
        existFile,
        root,
        specifier: "",
        conditions: [],
        existDir,
        *getPackageURL() {},
      }),
    )
      .resolves.toEqual(new URL(emptyPjson.indexJs));
  });

  it("should resolve as index if the package.json does not have `mainFields`", async () => {
    await expect(
      loadAsDirectory(emptyPjson.packageURL, {
        mainFields: ["unknown"],
        readFile,
        existFile,
        root,
        specifier: "",
        conditions: [],
        existDir,
        *getPackageURL() {},
      }),
    )
      .resolves.toEqual(new URL(emptyPjson.indexJs));
  });

  it("should resolve as file if the package.json includes `mainFields`", async () => {
    await expect(
      loadAsDirectory(pjsonMain.packageURL, {
        mainFields: ["main"],
        readFile,
        existFile,
        root,
        specifier: "",
        conditions: [],
        existDir,
        *getPackageURL() {},
      }),
    )
      .resolves.toEqual(new URL(pjsonMain.mainJs));
  });

  it("should resolve as directory if the package.json includes `mainFields`", async () => {
    await expect(
      loadAsDirectory(pjsonMain2.packageURL, {
        mainFields: ["main"],
        readFile,
        existFile,
        root,
        specifier: "",
        conditions: [],
        existDir,
        *getPackageURL() {},
      }),
    )
      .resolves.toEqual(new URL(pjsonMain2.indexJs));
  });

  it("should resolve order by mainFields - main", async () => {
    await expect(
      loadAsDirectory(pjsonMainModule.packageURL, {
        mainFields: ["main", "module"],
        readFile,
        existFile,
        root,
        specifier: "",
        conditions: [],
        existDir,
        *getPackageURL() {},
      }),
    )
      .resolves.toEqual(new URL(pjsonMainModule.indexCjs));
  });

  it("should resolve order by mainFields - module", async () => {
    await expect(
      loadAsDirectory(pjsonMainModule.packageURL, {
        mainFields: ["module", "main"],
        readFile,
        existFile,
        root,
        specifier: "",
        conditions: [],
        existDir,
        *getPackageURL() {},
      }),
    )
      .resolves.toEqual(new URL(pjsonMainModule.indexMjs));
  });

  it("should throw error if `mainFields` cannot resolve", async () => {
    await expect(
      loadAsDirectory(pjsonNoMain.packageURL, {
        mainFields: ["main"],
        readFile,
        existFile,
        root,
        specifier: "",
        conditions: [],
        existDir,
        *getPackageURL() {},
      }),
    )
      .rejects.toThrow();
  });
});

describe("resolveField", () => {
  it("should return undefined", () => {
    const table: PackageJson[] = [
      {},
      { module: "" },
      { main: null },
      { main: undefined },
      { main: 0 },
      { main: {} },
      { main: [] },
      { main: false },
      { main: true },
    ];

    table.forEach((pjson) => {
      expect(resolveField(pjson, "main")).toBe(undefined);
    });
  });

  it("should resolve to `main` field", () => {
    const table: [pjson: PackageJson, expected: string][] = [
      [{ main: "" }, "./"],
      [{ main: "index.js" }, "./index.js"],
      [{ main: "./" }, "./"],
      [{ main: "./abc" }, "./abc"],
      [{ main: "../" }, "../"],
      [{ main: "../abc" }, "../abc"],
      [{ main: "/" }, "/"],
      [{ main: "/abc" }, "/abc"],
    ];

    table.forEach(([pjson, expected]) => {
      expect(resolveField(pjson, "main")).toBe(expected);
    });
  });

  it("should resolve specifier field", () => {
    expect(resolveField({ module: "" }, "module")).toBe("./");
  });
});

describe("resolveFields", () => {
  it("should return undefined if all fields does not exist in pjson or the value is invalid", () => {
    const table: [pjson: PackageJson, fields: string[]][] = [
      [{}, []],
      [{}, ["main"]],
      [{ main: null }, ["main"]],
      [{ main: null }, ["main", "module"]],
      [{ main: null, module: undefined }, ["main", "module"]],
      [{ main: "", module: undefined }, ["module"]],
    ];

    table.forEach(([pjson, fields]) => {
      expect(resolveFields(pjson, fields)).toBe(undefined);
    });
  });

  it("should return string", () => {
    const table: [pjson: PackageJson, fields: string[], expected: string][] = [
      [{ main: "" }, ["main"], "./"],
      [{ main: "", module: "a" }, ["main"], "./"],
      [{ main: "", module: "a" }, ["module"], "./a"],
      [{ main: "", module: "a" }, ["main", "module"], "./"],
      [{ main: "", module: "a" }, ["module", "main"], "./a"],
      [{ main: "", module: "a", invalid: undefined }, [
        "invalid",
        "module",
        "main",
      ], "./a"],
    ];

    table.forEach(([pjson, fields, expected]) => {
      expect(resolveFields(pjson, fields)).toBe(expected);
    });
  });
});
