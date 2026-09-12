declare module "*.wasm" {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}

declare module "*.wasm?module" {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}
