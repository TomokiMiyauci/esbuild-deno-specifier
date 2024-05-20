import { loadAsDirectory } from "./load_as_directory.ts";
import { describe, expect, it } from "../../dev_deps.ts";
import {
  emptyPjson,
  noPjson,
  pjsonMain,
  pjsonMain2,
  pjsonMainModule,
  pjsonNoMain,
} from "../../tests/fixtures/node_modules.ts";
import { existFile, readFile, root } from "../../tests/context.ts";

describe("loadAsDirectory", () => {
  it("should resolve as index if the package.json does not exist and index.js exist", async () => {
    await expect(
      loadAsDirectory(noPjson.packageURL, {
        mainFields: [],
        readFile,
        existFile,
        root,
        specifier: "",
      }),
    )
      .resolves.toEqual({
        url: new URL(noPjson.indexJs),
        format: "commonjs",
      });
  });

  it("should resolve as index if the package.json does not includes any `mainFields`", async () => {
    await expect(
      loadAsDirectory(emptyPjson.packageURL, {
        mainFields: [],
        readFile,
        existFile,
        root,
        specifier: "",
      }),
    )
      .resolves.toEqual({
        url: new URL(emptyPjson.indexJs),
        format: "commonjs",
      });
  });

  it("should resolve as index if the package.json does not have `mainFields`", async () => {
    await expect(
      loadAsDirectory(emptyPjson.packageURL, {
        mainFields: ["unknown"],
        readFile,
        existFile,
        root,
        specifier: "",
      }),
    )
      .resolves.toEqual({
        url: new URL(emptyPjson.indexJs),
        format: "commonjs",
      });
  });

  it("should resolve as file if the package.json includes `mainFields`", async () => {
    await expect(
      loadAsDirectory(pjsonMain.packageURL, {
        mainFields: ["main"],
        readFile,
        existFile,
        root,
        specifier: "",
      }),
    )
      .resolves.toEqual({
        url: new URL(pjsonMain.mainJs),
        format: "commonjs",
      });
  });

  it("should resolve as directory if the package.json includes `mainFields`", async () => {
    await expect(
      loadAsDirectory(pjsonMain2.packageURL, {
        mainFields: ["main"],
        readFile,
        existFile,
        root,
        specifier: "",
      }),
    )
      .resolves.toEqual({
        url: new URL(pjsonMain2.indexJs),
        format: "commonjs",
      });
  });

  it("should resolve order by mainFields - main", async () => {
    await expect(
      loadAsDirectory(pjsonMainModule.packageURL, {
        mainFields: ["main", "module"],
        readFile,
        existFile,
        root,
        specifier: "",
      }),
    )
      .resolves.toEqual({
        url: new URL(pjsonMainModule.indexCjs),
        format: "commonjs",
      });
  });

  it("should resolve order by mainFields - module", async () => {
    await expect(
      loadAsDirectory(pjsonMainModule.packageURL, {
        mainFields: ["module", "main"],
        readFile,
        existFile,
        root,
        specifier: "",
      }),
    )
      .resolves.toEqual({
        url: new URL(pjsonMainModule.indexMjs),
        format: "module",
      });
  });

  it("should throw error if `mainFields` cannot resolve", async () => {
    await expect(
      loadAsDirectory(pjsonNoMain.packageURL, {
        mainFields: ["main"],
        readFile,
        existFile,
        root,
        specifier: "",
      }),
    )
      .rejects.toThrow();
  });
});
