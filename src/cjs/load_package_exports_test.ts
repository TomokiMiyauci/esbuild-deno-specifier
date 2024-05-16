import { loadPackageExports } from "./load_package_exports.ts";
import { describe, expect, it } from "../../dev_deps.ts";
import {
  noPjson,
  pjsonExportsSugar,
  virtualPackageDir,
} from "../../tests/fixtures/node_modules.ts";
import { existDir, existFile, readFile } from "../../tests/context.ts";

describe("loadPackageExports", () => {
  it("should return undefined if the package.json does not exist", async () => {
    await expect(
      loadPackageExports(virtualPackageDir, ".", {
        conditions: [],
        existFile,
        readFile,
        existDir,
      }),
    )
      .resolves
      .toBe(undefined);
  });

  it("should return undefined if the package.json does not contain `exports` field", async () => {
    await expect(
      loadPackageExports(noPjson.packageURL, ".", {
        conditions: [],
        existFile,
        readFile,
        existDir,
      }),
    )
      .resolves
      .toBe(undefined);
  });

  it("should return result", async () => {
    await expect(
      loadPackageExports(pjsonExportsSugar.packageURL, ".", {
        conditions: [],
        existFile,
        readFile,
        existDir,
      }),
    )
      .resolves
      .toEqual({
        url: pjsonExportsSugar.mainJs,
        format: "commonjs",
      });
  });
});
