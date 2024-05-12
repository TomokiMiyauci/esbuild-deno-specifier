import { resolveNodeModule } from "./node.ts";
import { describe, expect, it } from "../../dev_deps.ts";

describe("resolveNodeModule", () => {
  it("should return url formatted", () => {
    expect(resolveNodeModule({ moduleName: "crypto" })).toEqual({
      url: new URL("node:crypto"),
      mediaType: "Unknown",
    });
  });
});
