import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { patchPinnedHighsEsmLoaderForCloudflare } from "./with-app-env.mjs";

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

test("optimizer browser boundary returns a compact receipt and never dereferences an absent result payload", async () => {
  const execution = await source("src/lib/advanced-optimizer-execution.ts");
  const route = await source("src/routes/command/ibpe-operating-workspace_.optimizer.tsx");
  assert.match(execution, /AdvancedOptimizerExecutionReceipt/);
  assert.match(execution, /mathematicalStatus: optimizationStatus/);
  assert.match(execution, /cashGovernanceStatus: governedRun\.cashGovernance\.status/);
  assert.match(execution, /cashPlanningDisposition: governedRun\.cashGovernance\.planningDisposition/);
  assert.match(execution, /firstFundingNeedLakh/);
  assert.match(execution, /firstFundingNeedPeriod/);
  assert.match(execution, /peakAdditionalFundingLakh/);
  assert.match(execution, /peakFundingPeriod/);
  assert.match(execution, /baselineReserveFundingNeedLakh/);
  assert.match(execution, /firstInfeasibilityWitness/);
  assert.doesNotMatch(execution, /\.\.\.governedRun[\s\S]*return/);
  assert.match(route, /if \(!response\)/);
  assert.match(route, /response\.mathematicalStatus/);
  assert.match(route, /response\.cashGovernanceStatus/);
  assert.match(route, /response\.cashPlanningDisposition/);
  assert.match(route, /response\.firstFundingNeedLakh/);
  assert.match(route, /response\.peakAdditionalFundingLakh/);
  assert.match(route, /execution remains blocked until funding is evidenced/i);
  assert.match(route, /response\.firstInfeasibilityWitness/);
  assert.doesNotMatch(route, /response\.result/);
});

test("live HiGHS Wasm is prepared from the pinned package and bundled as a relative server asset", async () => {
  const wrapper = await source("scripts/with-app-env.mjs");
  const execution = await source("src/lib/advanced-optimizer-execution.ts");
  const pkg = JSON.parse(await source("package.json"));
  assert.equal(pkg.dependencies.highs, "1.15.3");
  assert.match(wrapper, /node_modules[\s\S]*highs[\s\S]*build[\s\S]*highs\.wasm/);
  assert.match(wrapper, /src[\s\S]*generated[\s\S]*highs\.wasm/);
  assert.match(wrapper, /patchPinnedHighsEsmLoaderForCloudflare/);
  assert.match(execution, /\.\.\/generated\/highs\.wasm/);
});

test("Worker bundle resolves the governed optimizer to the patched HiGHS ESM entry", async () => {
  const vite = await source("vite.config.ts");
  const runtime = await source("src/lib/advanced-planning-highs-runtime.ts");
  assert.match(runtime, /import loadHighs from "highs"/);
  assert.match(vite, /find:\s*\/\^highs\$\//);
  assert.match(vite, /node_modules[\s\S]*highs[\s\S]*build[\s\S]*highs\.mjs/);
  assert.doesNotMatch(vite, /highs\.js"/);
});

test("HiGHS runtime instantiates the bundled Wasm module directly without filesystem fallback", async () => {
  const runtime = await source("src/lib/advanced-planning-highs-runtime.ts");
  assert.match(runtime, /const instantiateWasm/);
  assert.match(runtime, /new WebAssembly\.Instance\(wasmModule, imports\)/);
  assert.match(runtime, /receiveInstance\(instance, wasmModule\)/);
  assert.match(runtime, /wasmModule,[\s\S]*instantiateWasm/);
});

test("HiGHS ESM loader keeps a valid module URL when Cloudflare strips import.meta.url", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyndi-highs-loader-"));
  try {
    const loaderDir = join(root, "node_modules", "highs", "build");
    const loaderPath = join(loaderDir, "highs.mjs");
    await mkdir(loaderDir, { recursive: true });
    await writeFile(
      loaderPath,
      [
        'import { createRequire } from "node:module";',
        "const require = createRequire(import.meta.url);",
        "const scriptDirectory = import.meta.url;",
        "export default scriptDirectory;",
      ].join("\n"),
      "utf8",
    );

    assert.equal(patchPinnedHighsEsmLoaderForCloudflare(root), true);
    const patched = await readFile(loaderPath, "utf8");
    assert.doesNotMatch(patched, /createRequire\(import\.meta\.url\)/);
    assert.match(patched, /file:\/\/\/highs\.mjs/);
    assert.match(patched, /typeof import\.meta\.url === "string"/);

    assert.equal(patchPinnedHighsEsmLoaderForCloudflare(root), true);
    assert.equal(await readFile(loaderPath, "utf8"), patched);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
  assert.match(page, /closure\.verdict/);
  assert.match(closure, /"GREEN"/);
  assert.match(closure, /"NOT GREEN"/);
});
