/**
 * @throws {Error}
 */
export async function info(): Promise<Output>;
export async function info(file: string): Promise<SourceFileInfo>;
export async function info(file?: string): Promise<Output | SourceFileInfo> {
  const options = {
    args: ["info", "--json", "--no-config"],
    stdout: "piped",
    stderr: "inherit",
  } satisfies Deno.CommandOptions;

  if (typeof file === "string") options.args.push(file);

  const output = await new Deno.Command(Deno.execPath(), options).output();

  if (!output.success) {
    throw new Error(`Failed to call 'deno info' on '${file}'`);
  }
  const txt = new TextDecoder().decode(output.stdout);

  return JSON.parse(txt);
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

export interface Dependency {
  specifier: string;
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
