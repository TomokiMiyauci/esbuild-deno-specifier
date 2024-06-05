import { resolveReferrer, ResolveReferrerArgs } from "./referrer.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";

describe("resolveReferrer", () => {
  it("should return url", () => {
    const table: [ResolveReferrerArgs, string][] = [
      [
        {
          importer: "/path/to/file",
          namespace: "file",
          resolveDir: "",
          path: "",
        },
        "file:///path/to/file",
      ],
      [
        {
          importer: "",
          namespace: "file",
          resolveDir: "/path/to",
          path: "./main.ts",
        },
        "file:///path/to/main.ts",
      ],
      [
        { importer: "file:", namespace: "", resolveDir: "", path: "" },
        "file:",
      ],
      [
        { importer: "https://a", namespace: "", resolveDir: "", path: "" },
        "https://a",
      ],
      [
        { importer: "", namespace: "", resolveDir: "/", path: "npm:/react" },
        "file:///react",
      ],
    ];

    table.forEach(([args, expected]) => {
      expect(resolveReferrer(args)).toEqual(new URL(expected));
    });
  });

  it("should throw error", () => {
    const table: ResolveReferrerArgs[] = [
      { importer: "<stdin>", namespace: "", resolveDir: "", path: "" },
      { importer: "", namespace: "", resolveDir: "", path: "" },
    ];

    table.forEach((args) => {
      expect(() => resolveReferrer(args)).toThrow();
    });
  });
});
