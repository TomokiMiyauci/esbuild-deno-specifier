import { loadAsFile } from "./load_file.ts";
import { describe, expect, it } from "../../dev_deps.ts";
import {
  emptyPjson,
  esmPjson,
  noPjson,
} from "../../tests/fixtures/node_modules.ts";
import { existFile, readFile, root } from "../../tests/context.ts";

describe("loadAsFile", () => {
  it("should return result if the url exists", async () => {
    await expect(loadAsFile(noPjson.indexJs, { existFile, readFile, root }))
      .resolves
      .toEqual({
        url: new URL(noPjson.indexJs),
        format: "commonjs",
      });
  });

  it("should return result if the url with .js exists and the package does not have package.json", async () => {
    const url = import.meta.resolve(
      "../../tests/fixtures/node_modules/no-pjson/index",
    );

    await expect(loadAsFile(url, { existFile, readFile, root })).resolves
      .toEqual({
        url: noPjson.indexJs,
        format: "commonjs",
      });
  });

  it("should return result if the url with .js exists and the package.json of `type` field is empty", async () => {
    const url = import.meta.resolve(
      "../../tests/fixtures/node_modules/empty-pjson/index",
    );

    await expect(loadAsFile(url, { existFile, readFile, root })).resolves
      .toEqual({
        url: emptyPjson.indexJs,
        format: "commonjs",
      });
  });

  it("should return result if the url with .js exists and the package.json of `type` field is `module`", async () => {
    const url = import.meta.resolve(
      "../../tests/fixtures/node_modules/esm-pjson/index",
    );

    await expect(loadAsFile(url, { existFile, readFile, root })).resolves
      .toEqual({
        url: esmPjson.indexJs,
        format: "module",
      });
  });

  it("should return result if the url with .json exists", async () => {
    const url = import.meta.resolve(
      "../../tests/fixtures/node_modules/empty-pjson/package",
    );

    await expect(loadAsFile(url, { existFile, readFile, root })).resolves
      .toEqual({
        url: emptyPjson.pjson,
        format: "json",
      });
  });

  it("should return result if the url with .node exists", async () => {
    const url = import.meta.resolve(
      "../../tests/fixtures/node_modules/no-pjson/main",
    );

    await expect(loadAsFile(url, { existFile, readFile, root })).resolves
      .toEqual({
        url: noPjson.mainNode,
        format: undefined,
      });
  });

  it("should return result if the url does not exist", async () => {
    const url = import.meta.resolve(
      "../../tests/fixtures/node_modules/not-found",
    );

    await expect(loadAsFile(url, { existFile, readFile, root })).resolves
      .toBe(
        undefined,
      );
  });
});
