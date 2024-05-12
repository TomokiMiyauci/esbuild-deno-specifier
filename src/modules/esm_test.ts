import { resolveEsModule } from "./esm.ts";
import { describe, expect, it } from "../../dev_deps.ts";

describe("resolveEsModule", () => {
  it("should throw error if `local` property is not string", () => {
    expect(
      () =>
        resolveEsModule({ local: undefined, mediaType: "Unknown" }, {
          specifier: "",
        }),
    ).toThrow();
  });

  it("should return result", () => {
    expect(
      resolveEsModule({ local: "/", mediaType: "JavaScript" }, {
        specifier: "",
      }),
    ).toEqual({
      url: new URL("file:///"),
      mediaType: "JavaScript",
    });
  });
});
