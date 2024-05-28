import { resolveNodeModule } from "./node.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";

describe("resolveNodeModule", () => {
  it("should return url formatted", () => {
    expect(resolveNodeModule({ moduleName: "crypto" })).toEqual({
      url: new URL("node:crypto"),
      mediaType: "Unknown",
    });
  });
});
