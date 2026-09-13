import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildActualSourceReference, extractManagementEvidence } from "../src/lib/actuals-evidence.ts";

const actualsRoute = readFileSync(new URL("../src/routes/command/actuals.tsx", import.meta.url), "utf8");

test("management evidence survives canonical transaction provenance", () => {
  assert.equal(
    extractManagementEvidence("transaction-ledger:M1; Founder-declared current bank balance: ₹5,00,000"),
    "Founder-declared current bank balance: ₹5,00,000",
  );
});

test("reconcile normalization removes duplicate transaction-ledger prefixes", () => {
  assert.equal(
    buildActualSourceReference(
      1,
      "transaction-ledger:M1; transaction-ledger:M1; Founder-declared current bank balance: ₹5,00,000",
    ),
    "transaction-ledger:M1; Founder-declared current bank balance: ₹5,00,000",
  );
});

test("actuals UI renders and submits management evidence instead of hiding system provenance", () => {
  assert.match(actualsRoute, /value=\{extractManagementEvidence\(a\.sourceReference\)\}/);
  assert.match(actualsRoute, /sourceReference:extractManagementEvidence\(actual\.sourceReference\)/);
  assert.doesNotMatch(actualsRoute, /sourceReference\?\.startsWith\("transaction-ledger:"\)\?"":/);
});
