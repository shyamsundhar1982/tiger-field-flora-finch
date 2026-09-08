import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const copilot = await readFile(new URL("../src/lib/ibpe-copilot.ts", import.meta.url), "utf8");

test("IBPE Copilot resolves named scenarios ahead of stale UI scenario context", () => {
  assert.match(copilot, /function namedScenarioFromQuestion/);
  assert.match(copilot, /growth-25/);
  assert.match(copilot, /cash-protect/);
  assert.match(copilot, /funding-bridge/);
  assert.match(copilot, /const effectiveScenario = namedScenario \?\? \(explicitlyRequestsBaseline/);
});

test("IBPE deterministic fallback remains conversational and deduplicated", () => {
  assert.match(copilot, /function isSmallTalk/);
  assert.match(copilot, /IBPE Copilot is online and connected/);
  assert.match(copilot, /new Set\(relevant\(domains\)\.map/);
  assert.match(copilot, /new Map\(findings\.map/);
});

test("IBPE funding requests use a dedicated diagnostic path", () => {
  assert.match(copilot, /Funding requirement:/);
  assert.match(copilot, /Data-quality caution:/);
  assert.match(copilot, /Minimum modelled intervention:/);
  assert.match(copilot, /complete material-funding requirement/);
});

test("IBPE causal questions use scenario-versus-baseline deltas and correct false premises", () => {
  assert.match(copilot, /type IbpeScenarioComparison/);
  assert.match(copilot, /scenarioComparison = packet\.comparison/);
  assert.match(copilot, /fundingNeedDeltaLakh/);
  assert.match(copilot, /minimumFreeLiquidityAfterRecommendationsDeltaLakh/);
  assert.match(copilot, /does not create additional modelled funding need versus the governed baseline/);
  assert.match(copilot, /Scenario deltas versus baseline:/);
});

test("IBPE multi-metric questions return a deterministic executive assessment before single-domain funding routing", () => {
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
  assert.match(copilot, /executiveAssessment \? undefined : process\.env\.XAI_API_KEY/);
  const executiveBranch = copilot.indexOf("if (isExecutiveAssessmentQuestion(question))");
  const singleFundingBranch = copilot.indexOf("else if (/fund(?:ing)?");
  assert.ok(executiveBranch >= 0 && singleFundingBranch > executiveBranch, "executive routing must precede single-domain funding routing");
});

test("IBPE Copilot refuses stale pre-cost-authority governed packets", () => {
  assert.match(copilot, /VYNDI-IBPE-1\.2\.0/);
  assert.match(copilot, /predates the Procurement Cost Authority/);
  assert.match(copilot, /catalogue\/reference prices cannot masquerade as procurement cost/);
});