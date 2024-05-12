import { Dependency, format, ModuleEntry, type NpmModule } from "../../deps.ts";
import { Msg } from "../constants.ts";
import type { Context } from "./types.ts";

/**
 * @throws {Error}
 */
export function findDependency(
  dependencies: Dependency[],
  specifier: string,
): Dependency {
  const dep = dependencies.find((dep) => dep.specifier === specifier);

  if (!dep) {
    const message = format(Msg.DependencyNotFound, { specifier });

    throw new Error(message);
  }

  return dep;
}

export function resolveDependency(
  dependency: Dependency,
  context: Pick<Context, "source">,
): ModuleEntry | undefined {
  if (dependency.npmPackage) {
    const specifier = dependency.code.specifier;
    return {
      kind: "npm",
      npmPackage: dependency.npmPackage,
      specifier: context.source.redirects[specifier] ?? specifier,
    } satisfies NpmModule;
  }

  return context.source.modules.find((module) =>
    module.specifier === dependency.code.specifier
  );
}
