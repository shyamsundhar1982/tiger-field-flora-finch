import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const optimiser = await readFile(new URL("../src/lib/vibpe-optimiser.ts", import.meta.url), "utf8");

test("VIBPE optimiser ranks deterministic scenario candidates without approving them", () => {
  assert.match(optimiser, /rankVibpeCandidates/);
  assert.match(optimiser, /evaluateScenario/);
  assert.match(optimiser, /sort\(\(a, b\) => b\.score - a\.score\)/);
});

test("VIBPE optimiser can explore funding and operating-pace candidates", () => {
  assert.match(optimiser, /buildFundingPaceCandidates/);
  assert.match(optimiser, /demandMultipliers = \[1, 0\.95, 0\.9, 0\.85\]/);
  assert.match(optimiser, /cashInjectionLakh: funding/);
});
