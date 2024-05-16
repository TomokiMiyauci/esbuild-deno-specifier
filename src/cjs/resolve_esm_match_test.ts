import { resolveEsmMatch } from "./resolve_esm_match.ts";
import { describe, expect, it } from "../../dev_deps.ts";
import { noPjson } from "../../tests/fixtures/node_modules.ts";
import { existFile, readFile } from "../../tests/context.ts";

describe("resolveEsmMatch", () => {
  it("should throw error if the url does not exist", async () => {
    await expect(
      resolveEsmMatch(import.meta.resolve("./not-found"), {
        existFile,
        readFile,
      }),
    ).rejects
      .toThrow();
  });

  it("should return result", async () => {
    await expect(resolveEsmMatch(noPjson.indexJs, {
      existFile,
      readFile,
    })).resolves
      .toEqual({
        url: noPjson.indexJs,
        format: "commonjs",
      });
  });
});
