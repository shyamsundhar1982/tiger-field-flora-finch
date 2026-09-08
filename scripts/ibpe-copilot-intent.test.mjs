import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const copilot = await readFile(new URL("../src/lib/ibpe-copilot.ts", import.meta.url), "utf8");
const scenarioLab = await readFile(new URL("../src/lib/ibpe-scenario-lab.ts", import.meta.url), "utf8");

test("IBPE Copilot resolves named scenarios ahead of stale UI scenario context", () => {
  assert.match(copilot, /function namedScenarioFromQuestion/);
  assert.match(copilot, /growth-25/);
  assert.match(copilot, /cash-protect/);
  assert.match(copilot, /funding-bridge/);
  assert.match(copilot, /const effectiveScenario = namedScenario \?\? \(explicitlyRequestsBaseline/);
});

test("IBPE Copilot supports product-family demand overrides", () => {
  assert.match(copilot, /familyGrowth\.family}-growth-25/);
  assert.match(copilot, /family: "longitude", productId: "aluminium", label: "Longitude"/);
  assert.match(copilot, /demandMultiplierByProduct: \{ \[familyGrowth\.productId\]: 1\.25 \}/);
  assert.match(scenarioLab, /demandMultiplierByProduct\?: Record<string, number>/);
  assert.match(scenarioLab, /const rowDemandMultiplier = demandMultiplierByProduct\[row\.productId\] \?\? demandMultiplier/);
});

test("IBPE Copilot answers multi-question prompts separately", () => {
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

test("Copilot refuses stale pre-procurement-cost-authority packets", () => {
  assert.match(copilot, /VYNDI-IBPE-1\.2\.0/);
  assert.match(copilot, /predates the Procurement Cost Authority/);
  assert.match(copilot, /catalogue\/reference prices cannot masquerade as procurement cost/);
});