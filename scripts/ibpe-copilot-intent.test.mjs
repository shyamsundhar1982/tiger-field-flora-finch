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
  assert.match(copilot, /full material-funding requirement/);
});
