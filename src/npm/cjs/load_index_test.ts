import { loadIndex } from "./load_index.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { files, noPjson } from "../../../tests/fixtures/node_modules.ts";
import { existFile, readFile, root } from "../../../tests/context.ts";

describe("loadIndex", () => {
  it("should return result if the url with index.js exists", async () => {
    const url = import.meta.resolve(
      "../../../tests/fixtures/node_modules/no-pjson",
    );
    await expect(loadIndex(url, { existFile, readFile, root })).resolves
      .toEqual(new URL(noPjson.indexJs));
  });

  it("should return result if the url with index.json exists", async () => {
    const url = import.meta.resolve(
      "../../../tests/fixtures/files",
    );

    await expect(loadIndex(url, { existFile, readFile, root })).resolves
      .toEqual(files.indexJson);
  });

  it("should return result if the url with index.node exists", async () => {
    const url = import.meta.resolve(
      "../../../tests/fixtures/files/nest",
    );

    await expect(loadIndex(url, { existFile, readFile, root })).resolves
      .toEqual(files.indexNode);
  });
});
