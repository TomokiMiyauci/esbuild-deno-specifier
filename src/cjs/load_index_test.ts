import { loadIndex } from "./load_index.ts";
import { describe, expect, it } from "../../dev_deps.ts";
import { files, noPjson } from "../../tests/fixtures/node_modules.ts";
import { existFile, readFile } from "../../tests/context.ts";

describe("loadIndex", () => {
  it("should return result if the url with index.js exists", async () => {
    const url = import.meta.resolve(
      "../../tests/fixtures/node_modules/no-pjson",
    );
    await expect(loadIndex(url, { existFile, readFile })).resolves.toEqual({
      url: new URL(noPjson.indexJs),
      format: "commonjs",
    });
  });

  it("should return result if the url with index.json exists", async () => {
    const url = import.meta.resolve(
      "../../tests/fixtures/files",
    );

    await expect(loadIndex(url, { existFile, readFile })).resolves.toEqual({
      url: files.indexJson,
      format: "json",
    });
  });

  it("should return result if the url with index.node exists", async () => {
    const url = import.meta.resolve(
      "../../tests/fixtures/files/nest",
    );

    await expect(loadIndex(url, { existFile, readFile })).resolves.toEqual({
      url: files.indexNode,
      format: undefined,
    });
  });
});
