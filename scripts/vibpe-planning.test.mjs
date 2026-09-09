import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const planning = await readFile(new URL("../src/lib/vibpe-planning.ts", import.meta.url), "utf8");

test("VIBPE horizon planning restricts analysis to requested months", () => {
  assert.match(planning, /row\.period <= horizonMonths/);
  assert.match(planning, /expectedUnits/);
  assert.match(planning, /recommendedProcurementLakh/);
  assert.match(planning, /fundingNeedLakh/);
});
