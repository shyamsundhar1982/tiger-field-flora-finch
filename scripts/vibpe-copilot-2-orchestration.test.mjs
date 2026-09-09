import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const copilot2 = await readFile(new URL("../src/lib/vibpe-copilot-2.ts", import.meta.url), "utf8");

test("VIBPE Co-Pilot 2 evaluates parsed scenarios against the governed SQL snapshot", () => {
  assert.match(copilot2, /parseVibpeIntent/);
  assert.match(copilot2, /await evaluateScenario\(sql, parsed\.scenario\)/);
  assert.match(copilot2, /packet\.comparison/);
  assert.match(copilot2, /does not modify the governed plan/);
});

test("VIBPE Co-Pilot 2 routes planning horizons before generic assessment", () => {
  assert.match(copilot2, /parsed\.intent === "planning-horizon"/);
  assert.match(copilot2, /explainVibpeHorizon/);
});

test("VIBPE Co-Pilot 2 retains advisory follow-up context", () => {
  assert.match(copilot2, /session\.activeScenario/);
  assert.match(copilot2, /parsed\.intent === "follow-up"/);
});
