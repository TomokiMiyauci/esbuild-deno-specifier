import { findDependency, resolveDependency } from "./dependency.ts";
import {
  describe,
  type EsModule,
  expect,
  it,
  type Module,
  type Source,
} from "../../dev_deps.ts";
import _source from "../../tests/fixtures/sources/jsr:@miyauci+react-router.json" with {
  type: "json",
};
import { assertModule, assertModuleEntry } from "./utils.ts";
const source = _source as Source;

const specifier = "https://jsr.io/@miyauci/react-router/1.2.0/mod.ts";
const dpeSpecifier = "https://jsr.io/@miyauci/react-router/1.2.0/src/route.ts";

function assertEsModule(module: Module): asserts module is EsModule {
  if (module.kind !== "esm") throw new Error();
}

describe("findDependency", () => {
  const module = source.modules.find((module) =>
    module.specifier === specifier
  );

  assertModuleEntry(module, specifier);
  assertModule(module);
  assertEsModule(module);

  const { dependencies } = module;

  it("should throw error if the specifier does not exist", () => {
    expect(
      () => findDependency(dependencies ?? [], ""),
    ).toThrow();
  });

  it("should return dependency", () => {
    expect(
      findDependency(dependencies ?? [], "./src/route.ts"),
    ).toBeTruthy();
  });
});

describe("resolveDependency", () => {
  describe("esm module", () => {
    const module = source.modules.find((module) =>
      module.specifier === specifier
    );

    assertModuleEntry(module, specifier);
    assertModule(module);
    assertEsModule(module);

    const { dependencies } = module;

    it("should resolve esm module", () => {
      const dep = findDependency(dependencies ?? [], "./src/route.ts");
      const module = resolveDependency(dep, { source });

      expect(module?.specifier).toBe(dpeSpecifier);
    });
  });

  describe("npm module", () => {
    const specifier = "https://jsr.io/@miyauci/react-router/1.2.0/deps.ts";
    const module = source.modules.find((module) =>
      module.specifier === specifier
    );

    assertModuleEntry(module, specifier);
    assertModule(module);
    assertEsModule(module);

    const { dependencies } = module;

    it("should resolve npm module", () => {
      const dep = findDependency(dependencies ?? [], "npm:/react@^18");
      const module = resolveDependency(dep, { source });

      expect(module).toEqual({
        kind: "npm",
        npmPackage: "react@18.3.1",
        specifier: "npm:/react@18.3.1",
      });
    });
  });
});
