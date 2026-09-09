import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const intent = await readFile(new URL("../src/lib/vibpe-intent.ts", import.meta.url), "utf8");
const doctrine = await readFile(new URL("../src/lib/vibpe-business-operator.ts", import.meta.url), "utf8");
const architecture = await readFile(new URL("../docs/VIBPE-COPILOT-2-ARCHITECTURE.md", import.meta.url), "utf8");
const productionCopilot = await readFile(new URL("../src/lib/ibpe-copilot.ts", import.meta.url), "utf8");

test("VIBPE recognizes conversational closing instead of returning baseline assessment", () => {
  assert.match(intent, /bye\|goodbye\|see you\|thanks\|thank you/);
  assert.match(intent, /intent: "conversation"/);
});

test("VIBPE parses free-form lakh funding scenarios", () => {
  assert.match(intent, /cashInjectionFromQuestion/);
  assert.match(intent, /cashInjectionLakh/);
  assert.match(intent, /fund\|funding\|finance\|capital\|cash/);
});

test("VIBPE supports explicit planning horizons", () => {
  assert.match(intent, /horizonFromQuestion/);
  assert.match(intent, /"planning-horizon"/);
  assert.match(intent, /next\|coming/);
});

test("VIBPE supports product-family scenario overrides", () => {
  assert.match(intent, /longitude/i);
  assert.match(intent, /latitude/i);
  assert.match(intent, /altitude/i);
  assert.match(intent, /demandMultiplierByProduct/);
});

test("VIBPE preserves follow-up scenario context", () => {
  assert.match(intent, /next what\|then what\|what next/);
  assert.match(intent, /preservePriorScenario/);
});

test("Business Operator doctrine protects transaction boundaries", () => {
  assert.match(doctrine, /Recommendation is not a purchase order/);
  assert.match(doctrine, /Scenario is not an approved plan/);
  assert.match(doctrine, /External reference is not governed internal truth/);
});

test("architecture separates deterministic truth from advisory reasoning", () => {
  assert.match(architecture, /IBPE engine.*deterministic business truth/i);
  assert.match(architecture, /External knowledge.*reference context only/i);
});


test("VIBPE 2.0 is active ahead of the legacy production fallback", () => {
  assert.match(productionCopilot, /import \{ runVibpeCopilot2 \}/);
  assert.match(productionCopilot, /await runVibpeCopilot2\(/);
  assert.match(productionCopilot, /if \(handledByVibpe2 && vibpe2\?\.answer\)/);
  assert.match(productionCopilot, /copilotVersion: handledByVibpe2 \? "2\.0" : "legacy-fallback"/);
});


test("VIBPE 2.0 runtime errors fail safely to the governed production fallback", () => {
  assert.match(productionCopilot, /try \{[\s\S]*await runVibpeCopilot2\(/);
  assert.match(productionCopilot, /catch \{[\s\S]*vibpe2FallbackReason = "runtime-error"/);
  assert.match(productionCopilot, /vibpe2FallbackReason: vibpe2FallbackReason \?\? null/);
});
