import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVANCED_PLANNING_MODEL_VERSION,
  type AdvancedPlanningConstraintModel,
  validateAdvancedPlanningConstraintModel,
} from "./advanced-planning-constraints.ts";

function validModel(): AdvancedPlanningConstraintModel {
  return {
    modelVersion: ADVANCED_PLANNING_MODEL_VERSION,
    horizonPeriods: 3,
    demands: [
      {
        id: "D-1",
        productId: "latitude",
        period: 1,
        quantity: 10,
        priority: 10,
        truth: "committed",
        sourceRef: "SO-1",
      },
    ],
    bom: [
      {
        id: "BOM-1",
        productId: "latitude",
        sku: "FRAME-LAT-M",
        quantityPerUnit: 1,
        sourceRef: "BOM-R1",
      },
    ],
    materials: [
      {
        sku: "FRAME-LAT-M",
        onHandQty: 4,
        reservedQty: 1,
        safetyStockQty: 1,
        sourceRef: "ATP",
      },
    ],
    committedReceipts: [
      {
        id: "PO-1",
        sku: "FRAME-LAT-M",
        period: 2,
        quantity: 5,
        sourceRef: "PO-1",
      },
    ],
    resources: [
      {
        id: "WC-010",
        name: "Kitting",
        type: "work_center",
        capabilities: ["KITTING"],
        efficiency: 0.85,
        capacity: [
          { period: 1, availableHours: 136 },
          { period: 2, availableHours: 136 },
          { period: 3, availableHours: 136 },
        ],
        sourceRef: "WORKBOOK-V5",
      },
    ],
    routingOperations: [
      {
        id: "LAT-OP-10",
        productId: "latitude",
        operationCode: "KITTING",
        sequence: 10,
        eligibleResourceIds: ["WC-010"],
        runHoursPerUnit: 0.35,
        setupHours: 0.25,
        yieldPct: 1,
      },
    ],
    supplierLanes: [
      {
        id: "SUP-A-FRAME-LAT-M",
        supplierId: "SUP-A",
        sku: "FRAME-LAT-M",
        approved: true,
        leadTimePeriods: 2,
        moq: 1,
        orderMultiple: 1,
        landedUnitCostLakh: 0.18,
        reliability: 0.95,
        alternateRank: 1,
        capacity: [
          { period: 1, maxQty: 20 },
          { period: 2, maxQty: 20 },
        ],
      },
    ],
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

test("advanced planning contract accepts a governed finite-constraint model", () => {
  const result = validateAdvancedPlanningConstraintModel(validModel());
  assert.equal(result.valid, true);
  assert.deepEqual(result.issues, []);
});

test("advanced planning contract rejects broken resource and predecessor lineage", () => {
  const model = validModel();
  model.routingOperations[0].eligibleResourceIds = ["WC-MISSING"];
  model.routingOperations[0].predecessorOperationIds = ["OP-MISSING"];

  const result = validateAdvancedPlanningConstraintModel(model);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "UNKNOWN_RESOURCE"));
  assert.ok(result.issues.some((issue) => issue.code === "UNKNOWN_PREDECESSOR"));
});

test("advanced planning contract rejects invalid numeric and period constraints", () => {
  const model = validModel();
  model.demands[0].period = 4;
  model.resources[0].efficiency = 1.2;
  model.supplierLanes[0].reliability = -0.1;
  model.objectiveWeights.unmetCommittedDemand = -1;

  const result = validateAdvancedPlanningConstraintModel(model);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "DEMAND_PERIOD"));
  assert.ok(result.issues.some((issue) => issue.code === "RESOURCE_EFFICIENCY"));
  assert.ok(result.issues.some((issue) => issue.code === "SUPPLIER_RELIABILITY"));
  assert.ok(result.issues.some((issue) => issue.code === "OBJECTIVE_WEIGHT"));
});

test("unapproved supplier lanes are advisory warnings rather than invalid model state", () => {
  const model = validModel();
  model.supplierLanes[0].approved = false;

  const result = validateAdvancedPlanningConstraintModel(model);
  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].code, "UNAPPROVED_SUPPLIER_LANE");
  assert.equal(result.issues[0].severity, "warning");
});
