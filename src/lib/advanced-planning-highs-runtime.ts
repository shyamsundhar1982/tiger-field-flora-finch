import loadHighs from "highs";
import {
  createHighsAdvancedPlanningOptimizer,
  type HighsLegacyLike,
} from "./advanced-planning-highs-adapter.ts";

let cachedRuntime: Promise<HighsLegacyLike> | undefined;

type HighsInstantiateWasm = (
  imports: WebAssembly.Imports,
  receiveInstance: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
) => WebAssembly.Exports;

/**
 * Production-safe HiGHS loader seam for environments such as Cloudflare Workers.
 *
 * The caller supplies a bundler-imported, already compiled WebAssembly.Module.
 * Cloudflare owns the .wasm -> WebAssembly.Module bundling step while VYNDI owns
 * solver governance. The explicit instantiateWasm hook prevents Emscripten from
 * falling back to locateFile/readAll/fetch paths such as /highs.wasm.
 */
export function loadHighsFromPrecompiledModule(wasmModule: WebAssembly.Module): Promise<HighsLegacyLike> {
  if (!cachedRuntime) {
    const instantiateWasm: HighsInstantiateWasm = (imports, receiveInstance) => {
      const instance = new WebAssembly.Instance(wasmModule, imports);
      receiveInstance(instance, wasmModule);
      return instance.exports;
    };

    const options = {
      wasmModule,
      instantiateWasm,
    } as unknown as Parameters<typeof loadHighs>[0];

    cachedRuntime = loadHighs(options).then((runtime) => runtime as unknown as HighsLegacyLike);
  }
  return cachedRuntime;
}

export async function createPrecompiledHighsOptimizer(wasmModule: WebAssembly.Module) {
  const runtime = await loadHighsFromPrecompiledModule(wasmModule);
  return createHighsAdvancedPlanningOptimizer(runtime);
}

/** Test-only reset for deterministic isolated unit tests. */
export function resetHighsRuntimeCacheForTests() {
  cachedRuntime = undefined;
}
