import {
  resolveEsModule,
  resolveEsModuleDependency,
  resolveEsModuleDependencyModule,
} from "./esm.ts";
import { toFileUrl } from "../../deps.ts";
import { describe, expect, it } from "../../dev_deps.ts";
import _ from "../../tests/fixtures/sources/jsr/@miyauci+react-router.json" with {
  type: "json",
};
import { Source } from "../../deps.ts";
import { assertEsModule, assertModule, assertModuleEntry } from "./utils.ts";
import { existDir, existFile, readFile, root } from "../../tests/context.ts";

const source = _ as Source;

const map = {
  "jsr:@miyauci/react-router":
    "https://jsr.io/@miyauci/react-router/1.2.0/mod.ts",
  "./src/route.ts": "https://jsr.io/@miyauci/react-router/1.2.0/src/route.ts",
};

describe("resolveEsModule", () => {
  it("should throw error if `local` property is not string", () => {
    const data = "data:text/javascript,export default {};";
    expect(
      resolveEsModule({
        local: undefined,
        mediaType: "JavaScript",
        specifier: data,
      }),
    ).toEqual({
      url: new URL(data),
      mediaType: "JavaScript",
    });
  });

  it("should return result", () => {
    expect(
      resolveEsModule({ local: "/", mediaType: "JavaScript", specifier: "" }),
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
        *getPackageURL() {},
        referrer: new URL("file:///"),
      }),
    ).resolves.toEqual({
      url: toFileUrl(depModule.local!),
      mediaType: depModule.mediaType,
      module: depModule,
      source: undefined,
    });
  });
});
