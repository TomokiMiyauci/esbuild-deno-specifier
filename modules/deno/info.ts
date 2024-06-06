export interface DenoInfoOptions {
  /** Outputs the information in JSON format */
  json?: boolean;

  /** Disable automatic loading of the configuration file. */
  noConfig?: boolean;

  /** Enables or disables the use of a local node_modules folder for npm packages */
  nodeModulesDir?: boolean;

  /** Check the specified lock file. */
  lock?: string;
}

export type InfoOptions =
  & DenoInfoOptions
  & Pick<
    Deno.CommandOptions,
    | "clearEnv"
    | "cwd"
    | "env"
    | "gid"
    | "signal"
    | "uid"
    | "windowsRawArguments"
  >;

/**
 * @throws {Error}
 */
export async function info(
  file?: undefined,
  options?: InfoOptions & { json: false },
): Promise<string>;
export async function info(
  file?: undefined,
  options?: InfoOptions & { json: true },
): Promise<Output>;
export async function info(
  file: string,
  options?: InfoOptions & { json: false },
): Promise<string>;
export async function info(
  file: string,
  options?: InfoOptions & { json: true },
): Promise<SourceFileInfo>;
export async function info(
  file?: string,
  options: InfoOptions = {},
): Promise<Output | SourceFileInfo | string> {
  const { json, noConfig, nodeModulesDir, lock, ...cmdOptions } = options;
  const denoInfoOptions = {
    json,
    noConfig,
    nodeModulesDir,
    lock,
  } satisfies DenoInfoOptions;
  const opt = resolveOptions(denoInfoOptions);
  const args = ["info", ...opt];
  const commandOptions = {
    ...cmdOptions,
    args,
    stdout: "piped",
    stderr: "inherit",
  } satisfies Deno.CommandOptions;

  if (typeof file === "string") args.push(file);

  const output = await new Deno.Command(Deno.execPath(), commandOptions)
    .output();

  if (!output.success) {
    throw new Error(`Failed to call 'deno info' on '${file}'`);
  }
  const txt = new TextDecoder().decode(output.stdout);

  return JSON.parse(txt);
}

function resolveOptions(options: DenoInfoOptions): string[] {
  const args: string[] = [];

  if (options.json) args.push("--json");
  if (options.noConfig) args.push("--no-config");
  if (options.nodeModulesDir) args.push("--node-modules-dir");
  if (typeof options.lock === "string") args.push(`--lock`, options.lock);

  return args;
}

export interface Output {
  denoDir: string;
  modulesCache: string;
  npmCache: string;
  typescriptCache: string;
  registryCache: string;
  originStorage: string;
}

export interface SourceFileInfo {
  roots: string[];
  modules: ModuleEntry[];
  redirects: Record<string, string>;
  packages: Record<string, string>;
  npmPackages: Record<string, NpmPackage>;
}

export interface NpmPackage {
  name: string;
  version: string;
  dependencies: string[];
}

export type ModuleEntry =
  | ErrorEntry
  | Module;

export type Module =
  | EsModule
  | NpmModule
  | AssertedModule
  | NodeModule;

interface BaseEntry {
  specifier: string;
}

export interface ErrorEntry extends BaseEntry {
  error: string;
}

// Lifted from https://raw.githubusercontent.com/denoland/deno_graph/89affe43c9d3d5c9165c8089687c107d53ed8fe1/lib/media_type.ts
export type MediaType =
  | "JavaScript"
  | "Mjs"
  | "Cjs"
  | "JSX"
  | "TypeScript"
  | "Mts"
  | "Cts"
  | "Dts"
  | "Dmts"
  | "Dcts"
  | "TSX"
  | "Json"
  | "Wasm"
  | "TsBuildInfo"
  | "SourceMap"
  | "Unknown";

export interface EsModule extends BaseEntry, CacheInfo {
  kind: "esm";
  dependencies?: Dependency[];
  mediaType: MediaType;
  size: number;
}

export interface AssertedModule extends BaseEntry, CacheInfo {
  kind: "asserted";
  size: number;
  mediaType: MediaType;
}

export interface Dependency extends BaseEntry {
  code: ResolvedDependencyEntry;
  type?: ResolvedDependencyEntry;
  npmPackage?: string;
}

interface BaseSpan {
  span: Span;
}

export interface ResolvedDependency extends BaseSpan {
  specifier: string;
}

export type ResolvedDependencyEntry = ResolvedDependency | ErrorEntry;

export interface ErrorEntry extends BaseSpan {
  error: string;
}

export interface Span {
  start: LineChar;
  end: LineChar;
}

export interface LineChar {
  line: number;
  character: number;
}

export interface CacheInfo {
  local?: string | null;
  emit?: string | null;
  map?: string | null;
}

export interface NpmModule extends BaseEntry {
  kind: "npm";
  npmPackage: string;
}

export interface NodeModule extends BaseEntry {
  kind: "node";
  moduleName: string;
}
