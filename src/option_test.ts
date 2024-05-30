import { resolveConditions, type ResolveConditionsContext } from "./option.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";

describe("resolveConditions", () => {
  it("if conditions is undefined", () => {
    const table: [ResolveConditionsContext, string[]][] = [
      [{
        kind: "import-statement",
        platform: "browser",
      }, ["import", "browser", "module"]],
      [{ kind: "require-call", platform: "browser" }, [
        "require",
        "browser",
        "module",
      ]],
      [{ kind: "require-resolve", platform: "browser" }, ["browser", "module"]],
      [{ kind: "require-resolve", platform: "neutral" }, ["module"]],
      [{ kind: "require-resolve", platform: "node" }, ["node", "module"]],
    ];

    table.forEach(([context, expected]) => {
      expect(
        resolveConditions(undefined, context),
      ).toEqual(expected);
    });
  });

  it("if conditions is defined, the result does not includes module", () => {
    const table: [string[], string[]][] = [
      [[], ["import", "browser"]],
      [["testing"], ["testing", "import", "browser"]],
      [["module"], ["module", "import", "browser"]],
      [["a", "a", "b", "b"], ["a", "b", "import", "browser"]],
      [["import", "browser"], ["import", "browser"]],
    ];

    table.forEach(([conditions, expected]) => {
      expect(
        resolveConditions(conditions, {
          kind: "import-statement",
          platform: "browser",
        }),
      ).toEqual(expected);
    });
  });
});
