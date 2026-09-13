import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("governed packet refresh reloads optimizer route state before another execution", async () => {
  const route = await source("src/routes/command/ibpe-operating-workspace_.optimizer.tsx");
  const prepare = route.indexOf("const response = await runAdvancedPlanningFromLatestIbpe()");
  const refresh = route.indexOf("await reloadOptimizerState()", prepare);
  const execute = route.indexOf("async function execute()", prepare);
  assert.ok(prepare >= 0, "governed packet refresh action is missing");
  assert.ok(refresh > prepare, "packet refresh must force a client loader-state reload");
  assert.ok(refresh < execute, "reload must occur before a subsequent optimizer execution can be initiated");
  assert.match(route, /Reloading the optimizer against this exact packet/i);
});

test("optimizer execution cannot crash on transient undefined loader data", async () => {
  const route = await source("src/routes/command/ibpe-operating-workspace_.optimizer.tsx");
  assert.match(
    route,
    /const state = loadedState \?\? \{/,
    "optimizer page must provide a safe control-state fallback before reading packet",
  );
  assert.match(route, /OPTIMIZER_STATE_UNAVAILABLE/);

  const execute = route.indexOf("async function execute()");
  const recentFunding = route.indexOf("const recentFundingAuthoritative", execute);
  assert.ok(execute >= 0 && recentFunding > execute, "optimizer execution block is missing");
  const executionBlock = route.slice(execute, recentFunding);
  assert.match(
    executionBlock,
    /await reloadOptimizerState\(\)/,
    "optimizer execution must refresh through the hard-reload boundary",
  );
  assert.doesNotMatch(
    executionBlock,
    /await router\.invalidate\(\)/,
    "optimizer execution must not directly invalidate into transient undefined loader state",
  );

  const refreshHelper = route.slice(
    route.indexOf("async function reloadOptimizerState()"),
    route.indexOf("async function preparePacket()"),
  );
  assert.match(refreshHelper, /window\.location\.reload\(\)/);
});
