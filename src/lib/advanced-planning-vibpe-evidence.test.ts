import assert from "node:assert/strict";
import test from "node:test";
import {
  formatAdvancedPlanningVibpeEvidence,
  shouldSurfaceAdvancedPlanningEvidence,
  type AdvancedPlanningVibpeEvidence,
} from "./advanced-planning-vibpe-evidence-format.ts";

function evidence(): AdvancedPlanningVibpeEvidence {
  return {
    packetId: "ADV-IBPE-1-VYNDI-ADVANCED-DECISION-PACKET-0.1-VYNDI-ADVANCED-PLANNING-0.1",
    parentIbpeRunId: "IBPE-1",
    packetVersion: "VYNDI-ADVANCED-DECISION-PACKET-0.1",
    advancedModelVersion: "VYNDI-ADVANCED-PLANNING-0.1",
    createdAt: "2026-09-12T04:00:00.000Z",
    committedStatus: "infeasible",
    totalStatus: "indeterminate",
    bindingConstraints: [
      {
        code: "MATERIAL_SHORTAGE",
        truth: "committed",
        period: 2,
        entityId: "FRAME-CARBON-M",
        amount: 3,
        unit: "qty",
        message: "Committed frame demand exceeds governed supply.",
      },
    ],
    indeterminateCount: 2,
    ctpPromiseAvailableCount: 0,
    ctpBlockedOrIndeterminateCount: 1,
    authority: {
      sourceTruth: "persisted-governed-ibpe-input",
      routingMode: "capacity-standard-derived",
      routingAuthority: "provisional",
      supplierLaneAuthority: "not-compiled",
      firmCtpEligible: false,
      optimisationEligible: false,
      limitations: [
        "Routing is still capacity-standard-derived.",
        "Supplier lane evidence is not compiled.",
      ],
    },
    adapterNotices: [{ code: "SUPPLIER_LANES_NOT_COMPILED", message: "Supplier lanes unavailable." }],
    sourceInputHash: "a".repeat(64),
    sourceSha: "1234567890abcdef",
  };
}

test("advanced evidence is surfaced for executive and constraint questions but not small talk", () => {
  assert.equal(shouldSurfaceAdvancedPlanningEvidence("today's report and action for founder?"), true);
  assert.equal(shouldSurfaceAdvancedPlanningEvidence("what is the biggest constraint to the plan?"), true);
  assert.equal(shouldSurfaceAdvancedPlanningEvidence("hello"), false);
});

test("advanced evidence keeps feasibility, authority limits and lineage explicit", () => {
  const text = formatAdvancedPlanningVibpeEvidence(evidence());
  assert.match(text, /committed feasibility is infeasible/i);
  assert.match(text, /total forecast feasibility is indeterminate/i);
  assert.match(text, /FRAME-CARBON-M M2 committed MATERIAL_SHORTAGE/);
  assert.match(text, /routing=provisional/);
  assert.match(text, /supplier lanes=not-compiled/);
  assert.match(text, /firm CTP=not yet eligible/);
  assert.match(text, /mathematical optimisation=not yet eligible/);
  assert.match(text, /IBPE IBPE-1/);
  assert.match(text, /does not alter IBPE financial metrics or create business transactions/);
});
