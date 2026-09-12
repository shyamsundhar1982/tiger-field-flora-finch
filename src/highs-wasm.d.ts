declare module "*.wasm?module" {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}

declare module "highs/runtime?module" {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}
