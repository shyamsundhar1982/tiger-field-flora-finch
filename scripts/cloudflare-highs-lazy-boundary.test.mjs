import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Cloudflare cold-start path keeps HiGHS JS and Wasm behind the explicit optimizer execution boundary", async () => {
  const execution = await source("src/lib/advanced-optimizer-execution.ts");

  assert.doesNotMatch(execution, /import\s+highsWasm\s+from\s+["']\.\.\/generated\/highs\.wasm["']/);
  assert.doesNotMatch(execution, /import\s+\{\s*createPrecompiledHighsOptimizer\s*\}\s+from\s+["']\.\/advanced-planning-highs-runtime\.ts["']/);

  assert.match(execution, /async function createLazyPrecompiledHighsOptimizer/);
  assert.match(execution, /import\(["']\.\.\/generated\/highs\.wasm["']\)/);
  assert.match(execution, /import\(["']\.\/advanced-planning-highs-runtime\.ts["']\)/);
  assert.match(execution, /await createLazyPrecompiledHighsOptimizer\(\)/);
});
