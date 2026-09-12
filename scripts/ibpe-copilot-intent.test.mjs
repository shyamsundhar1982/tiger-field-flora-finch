import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const copilot = await readFile(new URL("../src/lib/ibpe-copilot.ts", import.meta.url), "utf8");
const copilot2 = await readFile(new URL("../src/lib/vibpe-copilot-2.ts", import.meta.url), "utf8");
const scenarioLab = await readFile(new URL("../src/lib/ibpe-scenario-lab.ts", import.meta.url), "utf8");
const workflow = await readFile(new URL("../src/lib/operating-workflow.ts", import.meta.url), "utf8");

test("VIBPE Co-Pilot resolves named scenarios ahead of stale UI scenario context", () => {
  assert.match(copilot, /function namedScenarioFromQuestion/);
  assert.match(copilot, /growth-25/);
  assert.match(copilot, /cash-protect/);
  assert.match(copilot, /funding-bridge/);
  assert.match(copilot, /const effectiveScenario = namedScenario \?\? \(explicitlyRequestsBaseline/);
});

test("VIBPE Co-Pilot supports product-family demand overrides", () => {
  assert.match(copilot, /familyGrowth\.family}-growth-25/);
  assert.match(copilot, /family: "longitude", productId: "aluminium", label: "Longitude"/);
  assert.match(copilot, /demandMultiplierByProduct: \{ \[familyGrowth\.productId\]: 1\.25 \}/);
  assert.match(scenarioLab, /demandMultiplierByProduct\?: Record<string, number>/);
  assert.match(scenarioLab, /const rowDemandMultiplier = demandMultiplierByProduct\[row\.productId\] \?\? demandMultiplier/);
});

test("VIBPE Co-Pilot answers multi-question prompts separately", () => {
  assert.match(copilot, /function splitQuestions/);
  assert.match(copilot, /if \(questions\.length > 1\)/);
  assert.match(copilot, /for \(const \[index, question\] of questions\.entries\(\)\)/);
  assert.match(copilot, /Each numbered answer uses the governed baseline unless that question explicitly requests/);
});

test("IBPE deterministic fallback covers executive diagnostics", () => {
  assert.match(copilot, /Biggest constraint:/);
  assert.match(copilot, /Next-12-month funding requirement:/);
  assert.match(copilot, /Largest cash-risk month:/);
  assert.match(copilot, /Funding reduction without delaying launch:/);
  assert.match(copilot, /Buy first:/);
});

test("IBPE causal scenario questions use governed baseline deltas", () => {
  assert.match(copilot, /type IbpeScenarioComparison/);
  assert.match(copilot, /fundingNeedDeltaLakh/);
  assert.match(copilot, /minimumFreeLiquidityAfterRecommendationsDeltaLakh/);
  assert.match(copilot, /Scenario impact:/);
  assert.match(copilot, /Funding effect:/);
});

test("single multi-metric prompt returns complete governed executive assessment", () => {
  assert.match(copilot, /function requestedExecutiveDomains/);
  assert.match(copilot, /function isExecutiveAssessmentQuestion/);
  assert.match(copilot, /IBPE Executive Assessment:/);
  assert.match(copilot, /Procurement & shortages:/);
  assert.match(copilot, /Capacity:/);
  assert.match(copilot, /Cash & liquidity:/);
  assert.match(copilot, /Commercial EBITDA break-even:/);
  assert.match(copilot, /Procurement cost authority:/);
  assert.match(copilot, /activePlanningBomMissingCostSkus/);
  assert.match(copilot, /bomCogsReconciliation/);
  assert.match(copilot, /questions\.length === 1 && isExecutiveAssessmentQuestion/);
  assert.match(copilot, /isSmallTalk\(data\.question\) \|\| executiveAssessment \? undefined : process\.env\.XAI_API_KEY/);
  const executiveBranch = copilot.indexOf("if (isExecutiveAssessmentQuestion(question))");
  const fundingBranch = copilot.indexOf("else if (/fund(?:ing)?");
  assert.ok(executiveBranch >= 0 && fundingBranch > executiveBranch, "multi-metric executive routing must precede single-domain funding routing");
});

test("VIBPE Co-Pilot refuses packets that predate exact committed-material reconciliation", () => {
  assert.match(copilot, /RUNTIME_IBPE_ENGINE_VERSION/);
  assert.match(copilot, /predates exact committed-material reconciliation/);
  assert.match(copilot, /released job-card requirements participate in procurement and funding analysis/);
});

test("VIBPE Co-Pilot 2 returns intent-specific governed answers instead of an empty fallback", () => {
  assert.match(copilot2, /function intentAnswer/);
  assert.match(copilot2, /intent === "demand"/);
  assert.match(copilot2, /intent === "materials"/);
  assert.match(copilot2, /intent === "procurement"/);
  assert.match(copilot2, /intent === "capacity"/);
  assert.match(copilot2, /intent === "funding"/);
  assert.match(copilot2, /intent === "baseline" \|\| intent === "assessment"/);
  assert.match(copilot2, /const answer = intentAnswer\(parsed\.intent, question, governedBaseline\)/);
  assert.match(copilot2, /answer,/);
});

test("VIBPE evaluates committed-demand production feasibility across materials and capacity", () => {
  assert.match(copilot2, /function asksCommittedDemandFeasibility/);
  assert.match(copilot2, /function committedDemandFeasibilityAnswer/);
  assert.match(copilot2, /committedFulfillmentShortageQty/);
  assert.match(copilot2, /capacityShortfalls/);
  assert.match(copilot2, /Committed-demand feasibility:/);
  assert.match(copilot2, /should not promise production of all committed demand/);
});

test("Command navigation exposes the governed VIBPE Optimizer surface", () => {
  assert.match(workflow, /\/command\/ibpe-operating-workspace\/optimizer", label: "VIBPE Optimizer"/);
  assert.match(workflow, /\/command\/ibpe-operating-workspace\/optimizer", label: "Optimizer"/);
});
