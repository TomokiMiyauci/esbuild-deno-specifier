import { MediaType } from "@deno/info";
import {
  fromSpecifier as _fromSpecifier,
  instantiate,
} from "./deno_media_type_wasm.generated.js";

await instantiate();

export function fromSpecifier(url: URL | string): MediaType {
  return _fromSpecifier(url.toString()) as MediaType;
}
