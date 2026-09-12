import test from "node:test";
import assert from "node:assert/strict";
import {
  formatAdvancedOptimizationVibpeEvidence,
  shouldSurfaceOptimizationEvidence,
  type AdvancedOptimizationVibpeEvidence,
} from "./advanced-optimization-vibpe-evidence-format.ts";

const evidence: AdvancedOptimizationVibpeEvidence = {
  runId: "OPT-RUN-1",
  parentAdvancedPacketId: "ADV-1",
  requestId: "REQ-1",
  contractVersion: "VYNDI-ADVANCED-OPTIMIZER-0.1",
  optimizerId: "vyndi-highs-wasm",
  optimizerVersion: "VYNDI-HIGHS-ADAPTER-0.1",
  optimizerEngine: "HiGHS Wasm",
  solverClass: "milp",
  deterministic: true,
  accepted: true,
  optimizationStatus: "optimal",
  objectiveValue: 125,
  objectiveContributions: [
    { objective: "unmetCommittedDemand", rawValue: 1, weight: 100, weightedValue: 100 },
    { objective: "procurementCost", rawValue: 5, weight: 5, weightedValue: 25 },
    { objective: "workingCapital", rawValue: 0, weight: 3, weightedValue: 0 },
  ],
  bindingConstraints: [
    {
      code: "RESOURCE_CAP",
      entityType: "resource",
      entityId: "WC-LAYUP",
      period: 2,
      slack: 0,
      message: "Layup capacity is binding.",
    },
  ],
  diagnostics: ["HiGHS status: Optimal"],
  issues: [],
  createdAt: "2026-09-12T05:00:00Z",
};

test("optimization evidence is surfaced only for optimization/trade-off questions", () => {
  assert.equal(shouldSurfaceOptimizationEvidence("What is the best optimized production plan?"), true);
  assert.equal(shouldSurfaceOptimizationEvidence("Which constraint is binding in the MILP?"), true);
  assert.equal(shouldSurfaceOptimizationEvidence("today founder status report"), false);
  assert.equal(shouldSurfaceOptimizationEvidence("hello"), false);
});

test("formatter keeps mathematical optimization distinct from business authority", () => {
  const text = formatAdvancedOptimizationVibpeEvidence(evidence);
  assert.match(text, /optimal under the governed mathematical model/);
  assert.match(text, /Governed validator acceptance=yes/);
  assert.match(text, /unmetCommittedDemand=100\.00/);
  assert.match(text, /RESOURCE_CAP:WC-LAYUP M2 slack=0\.0000/);
  assert.match(text, /HiGHS Wasm/);
  assert.match(text, /advisory optimization evidence only/i);
  assert.match(text, /cannot create transactions/i);
  assert.match(text, /does not replace the deterministic feasibility baseline/i);
});
