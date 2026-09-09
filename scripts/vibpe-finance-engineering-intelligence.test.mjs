import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const finance = await readFile(new URL("../src/lib/vibpe-financial-analyst.ts", import.meta.url), "utf8");
const accounting = await readFile(new URL("../src/lib/vibpe-accounting-intelligence.ts", import.meta.url), "utf8");
const engineering = await readFile(new URL("../src/lib/vibpe-engineering-intelligence.ts", import.meta.url), "utf8");
const authority = await readFile(new URL("../src/lib/vibpe-authority-registry.ts", import.meta.url), "utf8");

test("financial analyst separates import cash from potentially recoverable ITC", () => {
  assert.match(finance, /landedCashOutflowLakh/);
  assert.match(finance, /potentiallyRecoverableInputTaxLakh/);
  assert.match(finance, /landedEconomicCostAfterEligibleItcLakh/);
});

test("financial analyst refuses ungoverned hard-coded current tax law", () => {
  assert.match(finance, /Never hard-code a tax\/duty rate as current law/);
  assert.match(finance, /versioned governed tax rule/);
});

test("accounting intelligence preserves truth classes and never auto-posts", () => {
  assert.match(accounting, /"plan" \| "forecast" \| "commitment" \| "actual"/);
  assert.match(accounting, /never post ledgers automatically/);
  assert.match(accounting, /profit is not cash/);
});

test("engineering references are explicitly selection-only", () => {
  assert.match(engineering, /selectionOnly: true/);
  assert.match(engineering, /production release authority/);
  assert.match(engineering, /Ply angles, ply count, overlaps, drops, cure cycle/);
});

test("authority registry uses official and manufacturer sources with governance", () => {
  for (const source of ["cbic-gst.gov.in", "icegate.gov.in", "dgft.gov.in", "toraycma.com", "productinfo.shimano.com"]) {
    assert.match(authority, new RegExp(source.replaceAll(".", "\\.")));
  }
  assert.match(authority, /externalMayOverwriteApprovedMasterData: false/);
  assert.match(authority, /requireEffectiveDateForTaxAndTrade: true/);
});
