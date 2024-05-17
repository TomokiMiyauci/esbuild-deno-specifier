import {
  type EsModule,
  format,
  type Module,
  type ModuleEntry,
} from "../../deps.ts";
import { Msg } from "../constants.ts";

export function assertModuleEntry(
  moduleEntry: ModuleEntry | undefined,
  specifier: string,
): asserts moduleEntry is ModuleEntry {
  if (!moduleEntry) {
    const message = format(Msg.NotFound, { specifier });

    throw new Error(message);
  }
}

export function assertModule(
  moduleEntry: ModuleEntry,
): asserts moduleEntry is Module {
  if ("error" in moduleEntry) throw new Error(moduleEntry.error);
}

export function assertEsModule(module: Module): asserts module is EsModule {
  if (module.kind !== "esm") throw new Error("module should be esm");
}
