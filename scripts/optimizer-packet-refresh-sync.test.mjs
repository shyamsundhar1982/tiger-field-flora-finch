import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("governed packet refresh reloads optimizer route state before another execution", async () => {
  const route = await source("src/routes/command/ibpe-operating-workspace_.optimizer.tsx");
  const prepare = route.indexOf("const response = await runAdvancedPlanningFromLatestIbpe()");
  const reload = route.indexOf("window.location.reload()", prepare);
  const execute = route.indexOf("async function execute()", prepare);
  assert.ok(prepare >= 0, "governed packet refresh action is missing");
  assert.ok(reload > prepare, "packet refresh must force a client loader-state reload");
  assert.ok(reload < execute, "reload must occur before a subsequent optimizer execution can be initiated");
  assert.match(route, /Reloading the optimizer against this exact packet/i);
});
