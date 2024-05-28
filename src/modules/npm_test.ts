import { type Hint, parseSubpath } from "./npm.ts";
import { type Subpath } from "../types.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";

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
