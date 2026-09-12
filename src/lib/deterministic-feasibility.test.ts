import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVANCED_PLANNING_MODEL_VERSION,
  type AdvancedPlanningConstraintModel,
} from "./advanced-planning-constraints.ts";
import { evaluateDeterministicFeasibility } from "./deterministic-feasibility.ts";

function model(): AdvancedPlanningConstraintModel {
  return {
    modelVersion: ADVANCED_PLANNING_MODEL_VERSION,
    horizonPeriods: 3,
    demands: [
      {
        id: "D-COMMIT-1",
        productId: "latitude",
        period: 1,
        quantity: 5,
        priority: 10,
        truth: "committed",
      },
      {
        id: "D-FORECAST-1",
        productId: "latitude",
        period: 2,
        quantity: 3,
        priority: 50,
        truth: "forecast",
      },
    ],
    bom: [
      {
        id: "BOM-FRAME",
        productId: "latitude",
        sku: "FRAME-LAT-M",
        quantityPerUnit: 1,
        scrapPct: 0,
      },
    ],
    materials: [
      {
        sku: "FRAME-LAT-M",
        onHandQty: 7,
        reservedQty: 1,
        safetyStockQty: 1,
      },
    ],
    committedReceipts: [
      {
        id: "PO-FRAME-1",
        sku: "FRAME-LAT-M",
        period: 2,
        quantity: 4,
      },
    ],
    resources: [
      {
        id: "WC-010",
        name: "Kitting",
        type: "work_center",
        capabilities: ["KITTING"],
        efficiency: 0.8,
        capacity: [
          { period: 1, availableHours: 10 },
          { period: 2, availableHours: 10 },
          { period: 3, availableHours: 10 },
        ],
      },
    ],
    routingOperations: [
      {
        id: "LAT-010",
        productId: "latitude",
        operationCode: "KITTING",
        sequence: 10,
        eligibleResourceIds: ["WC-010"],
        runHoursPerUnit: 1,
        setupHours: 1,
        yieldPct: 1,
      },
    ],
    supplierLanes: [
      {
        id: "SUP-A:FRAME-LAT-M",
        supplierId: "SUP-A",
        sku: "FRAME-LAT-M",
        approved: true,
        leadTimePeriods: 1,
        moq: 1,
        orderMultiple: 1,
        landedUnitCostLakh: 0.2,
        reliability: 0.92,
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

test("baseline feasibility protects reservations and safety stock and uses committed receipts only", () => {
  const result = evaluateDeterministicFeasibility(model());

  assert.equal(result.modelValid, true);
  assert.equal(result.committedStatus, "feasible");
  assert.equal(result.totalStatus, "feasible");

  const period1 = result.materials.find((row) => row.sku === "FRAME-LAT-M" && row.period === 1);
  const period2 = result.materials.find((row) => row.sku === "FRAME-LAT-M" && row.period === 2);
  assert.deepEqual(period1, {
    sku: "FRAME-LAT-M",
    period: 1,
    cumulativeAvailableQty: 5,
    cumulativeCommittedRequirementQty: 5,
    cumulativeTotalRequirementQty: 5,
    committedShortageQty: 0,
    totalShortageQty: 0,
  });
  assert.equal(period2?.cumulativeAvailableQty, 9);
  assert.equal(period2?.cumulativeTotalRequirementQty, 8);

  const resourcePeriod1 = result.resources.find((row) => row.resourceId === "WC-010" && row.period === 1);
  assert.equal(resourcePeriod1?.effectiveCapacityHours, 8);
  assert.equal(resourcePeriod1?.committedLoadHours, 6);
});

test("known material shortage makes committed plan infeasible and exposes supplier remediation without assuming supply", () => {
  const input = model();
  input.materials[0].onHandQty = 4;
  input.committedReceipts = [];

  const result = evaluateDeterministicFeasibility(input);

  assert.equal(result.committedStatus, "infeasible");
  assert.equal(result.totalStatus, "infeasible");
  assert.ok(result.bindingConstraints.some((row) => row.code === "MATERIAL_SHORTAGE_COMMITTED"));
  assert.equal(result.supplierRemediation.length, 1);
  assert.equal(result.supplierRemediation[0].supplierId, "SUP-A");
  assert.equal(result.supplierRemediation[0].earliestReceiptPeriod, 2);
  assert.ok(result.assumptions.some((row) => row.includes("do not change baseline feasibility")));
});

test("known resource overload makes the affected truth set infeasible", () => {
  const input = model();
  input.resources[0].capacity = [
    { period: 1, availableHours: 5 },
    { period: 2, availableHours: 10 },
    { period: 3, availableHours: 10 },
  ];

  const result = evaluateDeterministicFeasibility(input);
  assert.equal(result.committedStatus, "infeasible");
  assert.ok(result.bindingConstraints.some((row) => row.code === "RESOURCE_OVERLOAD_COMMITTED"));
});

test("alternate-resource routing is indeterminate rather than assigned by guess", () => {
  const input = model();
  input.resources.push({
    id: "WC-011",
    name: "Alternate Kitting",
    type: "work_center",
    capabilities: ["KITTING"],
    efficiency: 0.9,
    capacity: [
      { period: 1, availableHours: 10 },
      { period: 2, availableHours: 10 },
      { period: 3, availableHours: 10 },
    ],
  });
  input.routingOperations[0].eligibleResourceIds = ["WC-010", "WC-011"];

  const result = evaluateDeterministicFeasibility(input);
  assert.equal(result.committedStatus, "indeterminate");
  assert.equal(result.totalStatus, "indeterminate");
  assert.ok(result.indeterminate.some((row) => row.code === "ALTERNATE_RESOURCE_ASSIGNMENT_REQUIRED"));
});

test("missing governed inventory truth remains indeterminate rather than becoming zero stock", () => {
  const input = model();
  input.materials = [];

  const result = evaluateDeterministicFeasibility(input);
  assert.equal(result.committedStatus, "indeterminate");
  assert.equal(result.totalStatus, "indeterminate");
  assert.ok(result.indeterminate.some((row) => row.code === "MISSING_MATERIAL_POSITION"));
});

test("invalid constraint model is not evaluated as a business feasibility conclusion", () => {
  const input = model();
  input.resources[0].efficiency = 1.2;

  const result = evaluateDeterministicFeasibility(input);
  assert.equal(result.modelValid, false);
  assert.equal(result.committedStatus, "indeterminate");
  assert.equal(result.totalStatus, "indeterminate");
  assert.ok(result.indeterminate.some((row) => row.code === "MODEL_RESOURCE_EFFICIENCY"));
});
