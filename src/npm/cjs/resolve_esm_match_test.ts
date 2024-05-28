import { resolveEsmMatch } from "./resolve_esm_match.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { noPjson } from "../../../tests/fixtures/node_modules.ts";
import { existFile } from "../../../tests/context.ts";

describe("resolveEsmMatch", () => {
  it("should throw error if the url does not exist", async () => {
    await expect(
      resolveEsmMatch(import.meta.resolve("./not-found"), {
        existFile,
        specifier: "",
      }),
    ).rejects.toThrow();
  });

  it("should return result", async () => {
    await expect(resolveEsmMatch(noPjson.indexJs, {
      existFile,
      specifier: "",
    })).resolves.toEqual(noPjson.indexJs);
  });
});
