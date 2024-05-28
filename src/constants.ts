export const enum Msg {
  NotFound = `Cannot find module "{specifier}"`,
  DependencyNotFound = `Cannot find dependency of "{specifier}"`,
  BuildInNodeModule =
    `The package "{specifier}" wasn't found on the file system but is built into node. Are you trying
    to bundle for node? You can use "platform: 'node'" to do that, which will remove this error.`,
}

export const enum Namespace {
  DenoUrl = "deno-url",
  Disabled = "(disabled)",
}
