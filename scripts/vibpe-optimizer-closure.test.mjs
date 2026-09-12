import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("governed optimizer execution is edit-authorized, readiness-gated, cash-governed and persisted through v2", async () => {
  const execution = await source("src/lib/advanced-optimizer-execution.ts");
  assert.match(execution, /requireBusinessActor\("edit"\)/);
  assert.match(execution, /readyForGovernedOptimization/);
  assert.match(execution, /createPrecompiledHighsOptimizer/);
  assert.match(execution, /runGovernedAdvancedOptimizer/);
  assert.match(execution, /applyCashGovernanceToOptimizationRun/);
  assert.match(execution, /persist_vyndi_advanced_optimization_run_v2/);
});

test("live HiGHS Wasm is prepared from the pinned package and bundled as a relative server asset", async () => {
  const wrapper = await source("scripts/with-app-env.mjs");
  const execution = await source("src/lib/advanced-optimizer-execution.ts");
  const pkg = JSON.parse(await source("package.json"));
  assert.equal(pkg.dependencies.highs, "1.15.3");
  assert.match(wrapper, /node_modules[\s\S]*highs[\s\S]*build[\s\S]*highs\.wasm/);
  assert.match(wrapper, /src[\s\S]*generated[\s\S]*highs\.wasm/);
  assert.match(execution, /\.\.\/generated\/highs\.wasm/);
});

test("VIBPE exposes an explicit human execution surface and chat cannot auto-run HiGHS", async () => {
  const route = await source("src/routes/command/ibpe-operating-workspace_.optimizer.tsx");
  const copilot = await source("src/lib/vibpe-optimizer-copilot.ts");
  const server = await source("src/lib/vibpe-governance-server.ts");
  assert.match(route, /Run governed HiGHS optimization/);
  assert.match(route, /runAdvancedOptimizerFromPacket/);
  assert.match(route, /advisory evidence only/i);
  assert.match(copilot, /chat deliberately does not execute/i);
  assert.match(copilot, /cannot bypass readiness gates or start HiGHS automatically/i);
  assert.match(server, /answerGovernedOptimizerExecutionRequest/);
});

test("production health requires database, Hyperdrive, migration 0071 and v2 persistence authority", async () => {
  const health = await source("src/lib/optimizer-production-readiness.ts");
  assert.match(health, /0071_live_governed_optimizer_execution\.sql/);
  assert.match(health, /persist_vyndi_advanced_optimization_run_v2/);
  assert.match(health, /transportSource === "hyperdrive"/);
  assert.match(health, /databaseReachable/);
  assert.match(health, /productionReady: blockers\.length === 0/);
});

test("persistence boundary refuses transaction authority and requires feasible math plus cash for acceptance", async () => {
  const migration = await source("migrations/0071_live_governed_optimizer_execution.sql");
  assert.match(migration, /Only advisory optimization runs can be persisted/);
  assert.match(migration, /cannot carry transaction-write authority/);
  assert.match(migration, /requires human approval for business action/);
  assert.match(migration, /Accepted optimization runs must have optimal or feasible mathematical status/);
  assert.match(migration, /Accepted optimization runs require feasible cash governance/);
});

test("runtime exposes protected optimizer health and a public no-business-data deployment marker", async () => {
  const healthRoute = await source("src/routes/api/runtime/optimizer-health.ts");
  const marker = await source("src/routes/api/runtime/release-marker.ts");
  assert.match(healthRoute, /requireBusinessActor\("view"\)/);
  assert.match(healthRoute, /readOptimizerProductionReadiness/);
  assert.match(marker, /VIBPE-OPTIMIZER-CLOSURE-5/);
  assert.match(marker, /cloudflare-workers/);
  assert.match(marker, /ibpe-operating-workspace\/release/);
  assert.doesNotMatch(marker, /DATABASE_URL|connectionString|password|secret/i);
});

test("final release closure can only report GREEN when every runtime, run, governance, actor and audit gate passes", async () => {
  const closure = await source("src/lib/vibpe-optimizer-release-closure.ts");
  const page = await source("src/routes/command/ibpe-operating-workspace_.release.tsx");
  assert.match(closure, /verdict: gates\.every\(\(gate\) => gate\.pass\) \? "GREEN" : "NOT GREEN"/);
  assert.match(closure, /entity_type='advanced_optimization_run'/);
  assert.match(closure, /action='computed'/);
  assert.match(closure, /advisoryOnly/);
  assert.match(closure, /mayCreateTransactions/);
  assert.match(closure, /humanApprovalRequiredForBusinessAction/);
  assert.match(closure, /optimization_status === "optimal"/);
  assert.match(closure, /cash_guardrail_status === "feasible"/);
  assert.match(page, /Release verdict/);
  assert.match(page, /GREEN/);
  assert.match(page, /NOT GREEN/);
});
