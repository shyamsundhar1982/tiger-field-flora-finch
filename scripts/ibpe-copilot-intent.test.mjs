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
  assert.match(copilot, /longitude-growth-25/);
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
