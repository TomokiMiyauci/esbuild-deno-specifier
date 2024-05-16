import { resolveEsModule, resolveEsModuleDependencyModule } from "./esm.ts";
import { describe, expect, it } from "../../dev_deps.ts";
import _ from "../../tests/fixtures/sources/jsr:@miyauci+react-router.json" with {
  type: "json",
};
import { Source } from "../../deps.ts";
import { assertEsModule, assertModule, assertModuleEntry } from "./utils.ts";

const source = _ as Source;

const map = {
  "jsr:@miyauci/react-router":
    "https://jsr.io/@miyauci/react-router/1.2.0/mod.ts",
  "./src/route.ts": "https://jsr.io/@miyauci/react-router/1.2.0/src/route.ts",
};

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

describe("resolveEsModuleDependencyModule", () => {
  it("should resolve if the dependency is es module", () => {
    const specifier = "./src/route.ts";
    const module = source.modules.find((v) =>
      v.specifier === map["jsr:@miyauci/react-router"]
    );
    assertModuleEntry(module, "");
    assertModule(module);
    assertEsModule(module);

    expect(resolveEsModuleDependencyModule(module, {
      specifier,
      source,
    })).toEqual(source.modules.find((v) => v.specifier === map[specifier]));
  });
});
