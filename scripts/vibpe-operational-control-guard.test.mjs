import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/lib/vibpe-governance-server.ts", import.meta.url), "utf8");

test("exact operational-control questions fail closed instead of falling through to generic planning or traceability", () => {
  assert.match(source, /function isExactOperationalControlQuestion/);
  assert.match(source, /Exact operational-control answer: NOT VERIFIED/);
  assert.match(source, /will not substitute a planning summary, traceability lookup, knowledge-pack excerpt, or generic recommendation/);

  const specialistCall = source.indexOf("tryVibpeLiveSpecialistAnswer");
  const governanceCall = source.indexOf("tryGovernanceDataAnswer(sql, data.question)");
  const exactGuard = source.lastIndexOf("isExactOperationalControlQuestion(data.question)");
  assert.ok(specialistCall >= 0);
  assert.ok(governanceCall > specialistCall);
  assert.ok(exactGuard > governanceCall, "unsupported exact-control questions must be guarded after existing exact handlers");
});

test("known Co-Pilot audit failures have direct governed handlers", () => {
  for (const token of [
    "isConfirmedOrderCountQuestion",
    "isConfirmedOrderMissingJobCardQuestion",
    "isExactCommittedShortageQuestion",
    "isDraftPoLineageQuestion",
    "isDraftPoMissingSupplierQuestion",
    "isSupplierRatingGapQuestion",
  ]) {
    assert.match(source, new RegExp(`function ${token}\\b`));
  }

  assert.match(source, /Confirmed-order job-card coverage: PASS/);
  assert.match(source, /Exact confirmed-order shortage check: BLOCKED/);
  assert.match(source, /Draft-PO lineage:/);
  assert.match(source, /Draft-PO supplier assignment: FAIL/);
  assert.match(source, /Supplier .*rating completeness: FAIL/);
});

test("BOM-to-job-card audit cannot reuse a procurement-ledger reconciliation PASS", () => {
  const bomGuard = source.indexOf("isBomToJobCardAuditQuestion(data.question)");
  const specialistCall = source.indexOf("tryVibpeLiveSpecialistAnswer");
  assert.ok(bomGuard >= 0);
  assert.ok(specialistCall > bomGuard, "BOM audit guard must run before the broad live-specialist reconciliation matcher");
  assert.match(source, /specialist reconciliation is required/);
});
