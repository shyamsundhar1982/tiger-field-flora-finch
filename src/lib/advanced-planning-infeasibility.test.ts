import test from "node:test";
import assert from "node:assert/strict";
import {
  ADVANCED_PLANNING_MODEL_VERSION,
  type AdvancedPlanningConstraintModel,
} from "./advanced-planning-constraints.ts";
import { diagnoseAdvancedPlanningInfeasibility } from "./advanced-planning-infeasibility.ts";

function sourceModel(): AdvancedPlanningConstraintModel {
  return {
    modelVersion: ADVANCED_PLANNING_MODEL_VERSION,
    horizonPeriods: 2,
    demands: [
      { id: "D-1", productId: "BIKE-M", period: 1, quantity: 2, priority: 100, truth: "committed" },
    ],
    bom: [
      { id: "B-1", productId: "BIKE-M", sku: "FRAME-M", quantityPerUnit: 1, scrapPct: 0 },
    ],
    materials: [
      { sku: "FRAME-M", onHandQty: 0, reservedQty: 3, safetyStockQty: 0 },
    ],
    committedReceipts: [],
    resources: [
      {
        id: "WC-1",
        name: "Layup",
        type: "work_center",
        capabilities: ["LAYUP"],
        efficiency: 1,
        capacity: [
          { period: 1, availableHours: 10 },
          { period: 2, availableHours: 10 },
        ],
      },
    ],
    routingOperations: [
      {
        id: "OP-1",
        productId: "BIKE-M",
        operationCode: "LAYUP",
        sequence: 10,
        eligibleResourceIds: ["WC-1"],
        runHoursPerUnit: 1,
        setupHours: 0.5,
        yieldPct: 1,
      },
    ],
    supplierLanes: [],
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
}

test("bound diagnosis proves impossible protected material opening balance from over-reservation", () => {
  const diagnosis = diagnoseAdvancedPlanningInfeasibility(sourceModel());

  assert.equal(diagnosis.method, "constraint-bound-propagation-v1");
  assert.equal(diagnosis.totalBoundContradictions, 2);
  assert.equal(diagnosis.witnesses[0]?.constraintFamily, "MATERIAL_CUMULATIVE");
  assert.equal(diagnosis.witnesses[0]?.constraintId, "MATERIAL_CUMULATIVE__FRAME_M__1");
  assert.equal(diagnosis.witnesses[0]?.rhs, 3);
  assert.equal(diagnosis.witnesses[0]?.maxPossibleLhs, 0);
  assert.equal(diagnosis.witnesses[0]?.violationGap, 3);
  assert.match(diagnosis.diagnostics.join("\n"), /exact infeasibility witnesses/i);
  assert.match(diagnosis.diagnostics.join("\n"), /protected cumulative material balance FRAME-M M1/i);
  assert.match(diagnosis.diagnostics.join("\n"), /Minimum bound relaxation: 3/i);
});

test("pre-existing safety-stock deficit alone does not manufacture a mathematical contradiction", () => {
  const safetyDeficit = sourceModel();
  safetyDeficit.materials = [
    { sku: "FRAME-M", onHandQty: 0, reservedQty: 0, safetyStockQty: 5 },
  ];

  const diagnosis = diagnoseAdvancedPlanningInfeasibility(safetyDeficit);

  assert.equal(diagnosis.totalBoundContradictions, 0);
  assert.equal(
    diagnosis.witnesses.some((row) => row.constraintFamily === "MATERIAL_CUMULATIVE"),
    false,
  );
  assert.match(diagnosis.diagnostics.join("\n"), /interaction among multiple constraints/i);
});

test("bound diagnosis stays conservative when no single constraint is contradictory", () => {
  const feasible = sourceModel();
  feasible.materials = [
    { sku: "FRAME-M", onHandQty: 10, reservedQty: 0, safetyStockQty: 0 },
  ];
  const diagnosis = diagnoseAdvancedPlanningInfeasibility(feasible);

  assert.equal(diagnosis.totalBoundContradictions, 0);
  assert.deepEqual(diagnosis.witnesses, []);
  assert.match(diagnosis.diagnostics.join("\n"), /interaction among multiple constraints/i);
});
