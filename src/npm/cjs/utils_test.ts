import { getParents } from "./utils.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";

describe("getParents", () => {
  it("should yield", () => {
    const table: [url: string, root: string, expected: string[]][] = [
      ["file:///Users", "file:///", ["file:///"]],
      ["file:///Users/", "file:///", ["file:///"]],
      ["file:///Users///", "file:///", ["file:///"]],
      ["file:///Users/main.ts", "file:///", ["file:///Users", "file:///"]],
      ["file:///Users/main.ts", "file:///Users", ["file:///Users"]],
      ["file:///Users/main.ts", "file:///Users/", ["file:///Users"]],
      ["file:///Users/main.ts", "file:///Users//", ["file:///Users"]],
      ["file:///Users/user/tests/testing.ts", "file:///", [
        "file:///Users/user/tests",
        "file:///Users/user",
        "file:///Users",
        "file:///",
      ]],
      ["file:///Users/user/tests/testing.ts", "file:///Users", [
        "file:///Users/user/tests",
        "file:///Users/user",
        "file:///Users",
      ]],
    ];

    table.forEach(([url, root, expected]) => {
      expect([...getParents(url, root)]).toEqual(
        expected.map((v) => new URL(v)),
      );
    });
  });

  it("should not yield anything", () => {
    const table: [url: string, root: string][] = [
      ["file:///", "file:///"],
      ["file:///Users", "file:///Users"],
      ["file:///Users/", "file:///Users"],
      ["file:///Users", "file:///Users/"],
      ["file:///Users//", "file:///Users"],
      ["file:///Users//", "file:///Users//"],
      ["file:///Users//", "file:///Users/"],
      ["file:///Users/", "file:///Users//"],
      ["file:///Users", "file:///Var"],
      ["file:///Users/user", "file:///user"],
      ["file:///", "unknown:///"],
    ];

    table.forEach(([url, root]) => {
      expect([...getParents(url, root)]).toEqual([]);
    });
  });
});
