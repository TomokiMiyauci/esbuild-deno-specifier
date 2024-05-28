import {
  resolveEsModule,
  resolveEsModuleDependency,
  resolveEsModuleDependencyModule,
} from "./esm.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";

import _ from "../../tests/fixtures/sources/jsr/@miyauci+react-router.json" with {
  type: "json",
};
import type { SourceFileInfo as Source } from "@deno/info";
import { assertEsModule, assertModule, assertModuleEntry } from "./utils.ts";
import { existDir, existFile, readFile, root } from "../../tests/context.ts";

const source = _ as Source;

const map = {
  "jsr:@miyauci/react-router":
    "https://jsr.io/@miyauci/react-router/1.2.0/mod.ts",
  "./src/route.ts": "https://jsr.io/@miyauci/react-router/1.2.0/src/route.ts",
};

describe("resolveEsModule", () => {
  it("should return result", () => {
    expect(
      resolveEsModule({ mediaType: "JavaScript", specifier: "file:///" }),
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

describe("resolveEsModuleDependency", () => {
  it("should return esm", async () => {
    const specifier = "./src/route.ts";
    const module = source.modules.find((v) =>
      v.specifier === map["jsr:@miyauci/react-router"]
    );
    assertModuleEntry(module, "");
    assertModule(module);
    assertEsModule(module);

    const depModule = resolveEsModuleDependencyModule(module, {
      specifier,
      source,
    });

    assertEsModule(depModule);

    await expect(
      resolveEsModuleDependency(module, {
        conditions: [],
        mainFields: [],
        source,
        specifier,
        existDir,
        readFile,
        existFile,
        root,
        getPackageURL() {
          return null;
        },
        referrer: new URL("file:///"),
      }),
    ).resolves.toEqual({
      url: new URL(depModule.specifier),
      mediaType: depModule.mediaType,
      module: depModule,
      source: undefined,
    });
  });
});
