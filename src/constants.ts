export const enum Msg {
  NotFound = `Cannot find module "{specifier}"`,
  LocalPathNotFound = `Cannot find local path "{specifier}"`,
  DependencyNotFound = `Cannot find dependency of "{specifier}"`,
}

export const enum Namespace {
  Deno = "deno",
  Disabled = "(disabled)",
}
