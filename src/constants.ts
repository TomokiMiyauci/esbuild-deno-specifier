export const enum Msg {
  NotFound = `Cannot find module "{specifier}"`,
  DependencyNotFound = `Cannot find dependency of "{specifier}"`,
  BuildInNodeModule =
    `The package "{specifier}" wasn't found on the file system but is built into node. Are you trying
    to bundle for node? You can use "platform: 'node'" to do that, which will remove this error.`,
  InvalidMediaType =
    `Expected a JavaScript or TypeScript module, but identified a {mediaType} module. Importing these types of modules is currently not supported.`,
  InvalidMediaTypeOfJson =
    `Expected a JavaScript or TypeScript module, but identified a Json module. Consider importing Json modules with an import attribute with the type of "json".`,
}

export const enum Namespace {
  DenoUrl = "deno-url",
  Disabled = "(disabled)",
  DenoData = "deno-data",
}
