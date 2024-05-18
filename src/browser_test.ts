import { resolveBrowser } from "./browser.ts";
import { describe, expect, it } from "../dev_deps.ts";

describe("resolveBrowser", () => {
  it("should return resolved value", () => {
    const table: [
      specifier: string,
      browser: Record<string, unknown>,
      unknown,
    ][] = [
      ["pkg", { pkg: false }, false],
      ["./index.js", { "./index.js": "./index.mjs" }, "./index.mjs"],
    ];

    table.forEach(([specifier, browser, expected]) => {
      expect(resolveBrowser(specifier, browser)).toEqual(expected);
    });
  });

  it("should resolve `.js`, `.json`, and `.node` by estimating them in that order", () => {
    const table: [
      specifier: string,
      browser: Record<string, unknown>,
      unknown,
    ][] = [
      [
        "./index",
        { "./index.js": "./index.mjs" },
        "./index.mjs",
      ],
      [
        "./index",
        { "./index.json": "./index.browser.json" },
        "./index.browser.json",
      ],

      [
        "./index",
        { "./index.node": "./index.browser.node" },
        "./index.browser.node",
      ],
      [
        "./index",
        {
          "./index.node": "./index.browser.node",
          "./index.js": "./index.mjs",
          "./index.json": "./index.browser.json",
        },
        "./index.mjs",
      ],
      [
        "./index",
        {
          "./index": false,
          "./index.node": "./index.browser.node",
          "./index.js": "./index.mjs",
          "./index.json": "./index.browser.json",
        },
        false,
      ],
    ];

    table.forEach(([specifier, browser, expected]) => {
      expect(resolveBrowser(specifier, browser)).toEqual(expected);
    });
  });

  it("should resolve if the specifier does not begin with `./`, match with `./` + specifier", () => {
    const table: [
      specifier: string,
      browser: Record<string, unknown>,
      unknown,
    ][] = [
      ["index.js", { "./index.js": "./index.mjs" }, "./index.mjs"],
      ["index", { "./index.js": "./index.mjs" }, "./index.mjs"],
      [
        "index",
        { "./index.json": "./index.browser.json" },
        "./index.browser.json",
      ],
    ];

    table.forEach(([specifier, browser, expected]) => {
      expect(resolveBrowser(specifier, browser)).toEqual(expected);
    });
  });

  it("should resolve to give priority to the estimation of the current path over the estimation of the extension", () => {
    const table: [
      specifier: string,
      browser: Record<string, unknown>,
      unknown,
    ][] = [
      ["./index", {
        "./index": "a",
        "index": "b",
        "./index.js": "c",
        "index.js": "d",
        "./index.json": "e",
        "index.json": "f",
        "./index.node": "g",
        "index.node": "h",
      }, "a"],
      ["index", {
        "./index": "a",
        "index": "b",
        "./index.js": "c",
        "index.js": "d",
        "./index.json": "e",
        "index.json": "f",
        "./index.node": "g",
        "index.node": "h",
      }, "b"],
      ["index", {
        "./index": "a",
        "./index.js": "c",
        "index.js": "d",
        "./index.json": "e",
        "index.json": "f",
        "./index.node": "g",
        "index.node": "h",
      }, "a"],
      ["index", {
        "./index.js": "c",
        "index.js": "d",
        "./index.json": "e",
        "index.json": "f",
        "./index.node": "g",
        "index.node": "h",
      }, "d"],
      ["index", {
        "./index.js": "c",
        "./index.json": "e",
        "index.json": "f",
        "./index.node": "g",
        "index.node": "h",
      }, "c"],
      ["index", {
        "./index.json": "e",
        "index.json": "f",
        "./index.node": "g",
        "index.node": "h",
      }, "f"],
      ["index", {
        "./index.json": "e",
        "./index.node": "g",
        "index.node": "h",
      }, "e"],
      ["index", {
        "./index.node": "g",
        "index.node": "h",
      }, "h"],
      ["index", {
        "./index.node": "g",
      }, "g"],
    ];

    table.forEach(([specifier, browser, expected]) => {
      expect(resolveBrowser(specifier, browser)).toEqual(expected);
    });
  });

  it("should return undefined if it does not match", () => {
    const table: [
      specifier: string,
      browser: Record<string, unknown>,
    ][] = [
      ["unknown", {}],
      ["unknown", { no: false }],
    ];

    table.forEach(([specifier, browser]) => {
      expect(resolveBrowser(specifier, browser)).toBe(undefined);
    });
  });
});
