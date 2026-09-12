import loadHighs from "highs";
import {
  createHighsAdvancedPlanningOptimizer,
  type HighsLegacyLike,
} from "./advanced-planning-highs-adapter.ts";

let cachedRuntime: Promise<HighsLegacyLike> | undefined;

/**
 * Production-safe HiGHS loader seam for environments such as Cloudflare Workers.
 *
 * The caller must supply a bundler-imported, already compiled WebAssembly.Module.
 * This function deliberately has no URL/fetch/instantiateStreaming fallback and
 * never calls WebAssembly.compile(). Cloudflare can therefore own the .wasm ->
 * WebAssembly.Module bundling step while VYNDI owns solver governance.
 */
export function loadHighsFromPrecompiledModule(wasmModule: WebAssembly.Module): Promise<HighsLegacyLike> {
  if (!cachedRuntime) {
    cachedRuntime = loadHighs({ wasmModule }).then((runtime) => runtime as unknown as HighsLegacyLike);
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
