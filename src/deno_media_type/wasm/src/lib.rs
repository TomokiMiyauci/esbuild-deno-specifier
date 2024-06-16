use deno_media_type::MediaType;
use std::str::FromStr;
use url::Url;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = fromSpecifier)]
pub fn from_specifier(url: &str) -> String {
    let url: Url = Url::from_str(url).map_err(|op| op.to_string()).unwrap();

    MediaType::from_specifier(&url).to_string()
}
