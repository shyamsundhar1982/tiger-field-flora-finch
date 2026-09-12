import assert from "node:assert/strict";
import test from "node:test";
import type { AdvancedPlanningConstraintModel } from "./advanced-planning-constraints.ts";
import type { GovernedAdvancedOptimizationRun } from "./advanced-planning-optimizer.ts";
import { applyCashGovernanceToOptimizationRun } from "./advanced-planning-cash-governance.ts";
import type { AdvancedCashGuardrail } from "./advanced-planning-cash-guardrails.ts";

const model: AdvancedPlanningConstraintModel = {
  modelVersion: "VYNDI-ADVANCED-PLANNING-0.1",
  horizonPeriods: 3,
  demands: [{ id: "D1", productId: "P1", period: 2, quantity: 2, priority: 100, truth: "committed" }],
  bom: [{ id: "B1", productId: "P1", sku: "SKU1", quantityPerUnit: 1 }],
  materials: [{ sku: "SKU1", onHandQty: 0 }],
  committedReceipts: [],
  resources: [],
  routingOperations: [],
  supplierLanes: [{
    id: "SUP1:SKU1",
    supplierId: "SUP1",
    sku: "SKU1",
    approved: true,
    leadTimePeriods: 1,
    moq: 1,
    orderMultiple: 1,
    landedUnitCostLakh: 2,
    reliability: 0.95,
    capacity: [{ period: 1, maxQty: 10 }, { period: 2, maxQty: 10 }, { period: 3, maxQty: 10 }],
  }],
  objectiveWeights: {
    unmetCommittedDemand: 100,
    unmetForecastDemand: 30,
    lateness: 50,
    resourceOverload: 100,
    supplierOverload: 100,
    procurementCost: 5,
    workingCapital: 3,
    scheduleChange: 2,
  },
};

function run(quantity: number): GovernedAdvancedOptimizationRun {
  return {
    contractVersion: "VYNDI-ADVANCED-OPTIMIZER-0.1",
    requestId: "REQ-1",
    optimizer: { id: "vyndi-highs-wasm", version: "test", solverClass: "milp", engine: "HiGHS Wasm", deterministic: true },
    governance: { advisoryOnly: true, mayCreateTransactions: false, humanApprovalRequiredForBusinessAction: true },
    baseline: {
      modelValid: true,
      committedStatus: "feasible",
      totalStatus: "feasible",
      materials: [],
      resources: [],
      bindingConstraints: [],
      indeterminate: [],
      supplierRemediation: [],
      assumptions: [],
    },
    result: {
      status: "optimal",
      objectiveValue: 0,
      objectiveContributions: [],
      solution: {
        demandOutcomes: [{ demandId: "D1", servedQty: 2, unmetQty: 0, latenessPeriods: 0 }],
        production: [{ productId: "P1", period: 2, quantity: 2 }],
        procurement: quantity > 0 ? [{ laneId: "SUP1:SKU1", supplierId: "SUP1", sku: "SKU1", orderPeriod: 1, receiptPeriod: 2, quantity }] : [],
        resourceAssignments: [],
      },
      bindingConstraints: [],
      diagnostics: [],
    },
    accepted: true,
    issues: [],
  };
}

const guardrails: AdvancedCashGuardrail[] = [
  { period: 1, baselineFreeLiquidityLakh: 5, cumulativeIncrementalProcurementHeadroomLakh: 5, sourceRef: "IBPE:CASH" },
  { period: 2, baselineFreeLiquidityLakh: 5, cumulativeIncrementalProcurementHeadroomLakh: 5, sourceRef: "IBPE:CASH" },
  { period: 3, baselineFreeLiquidityLakh: 5, cumulativeIncrementalProcurementHeadroomLakh: 5, sourceRef: "IBPE:CASH" },
];

test("cash-feasible optimal solver output remains governance-accepted", () => {
  const governed = applyCashGovernanceToOptimizationRun(run(2), model, guardrails);
  assert.equal(governed.result?.status, "optimal");
  assert.equal(governed.cashGovernance.status, "feasible");
  assert.equal(governed.accepted, true);
});

test("cash-infeasible optimal solver output preserves math status but is not accepted", () => {
  const governed = applyCashGovernanceToOptimizationRun(run(3), model, guardrails);
  assert.equal(governed.result?.status, "optimal");
  assert.equal(governed.cashGovernance.status, "infeasible");
  assert.equal(governed.accepted, false);
  assert.ok(governed.issues.some((issue) => issue.code === "CASH_GOVERNANCE_INFEASIBLE"));
});

test("incomplete liquidity horizon is governance-indeterminate and cannot be accepted", () => {
  const governed = applyCashGovernanceToOptimizationRun(run(1), model, guardrails.slice(0, 2));
  assert.equal(governed.accepted, false);
  assert.ok(governed.issues.some((issue) => issue.code === "CASH_GOVERNANCE_INCOMPLETE_HORIZON"));
});

test("non-feasible solver outputs do not masquerade as cash-evaluated proposals", () => {
  const source = run(1);
  source.result = { status: "infeasible", bindingConstraints: [], diagnostics: [] };
  source.accepted = false;
  const governed = applyCashGovernanceToOptimizationRun(source, model, guardrails);
  assert.equal(governed.cashGovernance.status, "not-evaluated");
  assert.equal(governed.accepted, false);
});
