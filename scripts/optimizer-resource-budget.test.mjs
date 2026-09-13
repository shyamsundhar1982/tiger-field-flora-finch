import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Cloudflare optimizer execution is time-bounded and never auto-retries a heavy solver request", async () => {
  const budget = await source("src/lib/optimizer-resource-budget.ts");
  const execution = await source("src/lib/advanced-optimizer-execution.ts");
  const route = await source("src/routes/command/ibpe-operating-workspace_.optimizer.tsx");

  assert.match(budget, /VYNDI_OPTIMIZER_DEFAULT_RUNTIME_MS = 12_000/);
  assert.match(budget, /VYNDI_OPTIMIZER_MAX_RUNTIME_MS = 12_000/);
  assert.match(execution, /governedOptimizerRuntimeMs/);
  assert.match(execution, /maxRuntimeMs: effectiveMaxRuntimeMs/);
  assert.doesNotMatch(route, /runWithSingleOptimizerTransportRetry/);
  assert.doesNotMatch(route, /Retrying once safely/);
});
