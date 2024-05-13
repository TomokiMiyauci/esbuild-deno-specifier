import { type Hint, parseSubpath, type Subpath } from "./npm.ts";
import { describe, expect, it } from "../../dev_deps.ts";

describe("parseSubpath", () => {
  it("should return subpath", () => {
    const table: [string, Hint, Subpath][] = [
      ["npm:/react@18.0.0", { name: "react", version: "18.0.0" }, "."],
      [
        "npm:/react@18.0.0/package.json",
        { name: "react", version: "18.0.0" },
        "./package.json",
      ],
    ];

    table.forEach(([specifier, hint, expected]) => {
      expect(parseSubpath(specifier, hint)).toEqual(expected);
    });
  });
});
