import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVANCED_PLANNING_MODEL_VERSION,
  type AdvancedPlanningConstraintModel,
} from "./advanced-planning-constraints.ts";
import { evaluateConstrainedCapableToPromise } from "./constrained-capable-to-promise.ts";

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
        capacity: [{ period: 1, maxQty: 20 }],
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

test("CTP finds the earliest feasible committed period and identifies forecast replanning impact", () => {
  const result = evaluateConstrainedCapableToPromise(model(), {
    requestId: "QUOTE-1",
    productId: "latitude",
    quantity: 2,
    requestedPeriod: 1,
    sourceRef: "COMMERCIAL:QUOTE-1",
  });

  assert.equal(result.status, "promise_available");
  assert.equal(result.promisedPeriod, 2);
  assert.equal(result.promiseMeetsRequestedPeriod, false);
  assert.equal(result.forecastReplanRequired, true);
  assert.equal(result.candidates[0].period, 1);
  assert.equal(result.candidates[0].committedStatus, "infeasible");
  assert.equal(result.candidates[1].period, 2);
  assert.equal(result.candidates[1].committedStatus, "feasible");
  assert.equal(result.candidates[1].totalStatus, "infeasible");
});

test("CTP confirms the requested period when governed constraints support it", () => {
  const input = model();
  input.materials[0].onHandQty = 10;

  const result = evaluateConstrainedCapableToPromise(input, {
    requestId: "QUOTE-2",
    productId: "latitude",
    quantity: 2,
    requestedPeriod: 1,
  });

  assert.equal(result.status, "promise_available");
  assert.equal(result.promisedPeriod, 1);
  assert.equal(result.promiseMeetsRequestedPeriod, true);
});

test("CTP refuses new promises when existing committed demand is already infeasible", () => {
  const input = model();
  input.materials[0].onHandQty = 4;
  input.committedReceipts = [];

  const result = evaluateConstrainedCapableToPromise(input, {
    requestId: "QUOTE-3",
    productId: "latitude",
    quantity: 1,
    requestedPeriod: 1,
  });

  assert.equal(result.status, "baseline_infeasible");
  assert.equal(result.promisedPeriod, undefined);
  assert.ok(result.blockingConstraints.some((row) => row.code === "MATERIAL_SHORTAGE_COMMITTED"));
});

test("CTP does not convert supplier remediation into an uncommitted promise", () => {
  const input = model();
  input.committedReceipts = [];

  const result = evaluateConstrainedCapableToPromise(input, {
    requestId: "QUOTE-4",
    productId: "latitude",
    quantity: 2,
    requestedPeriod: 1,
  });

  assert.equal(result.status, "not_available");
  assert.equal(result.promisedPeriod, undefined);
  assert.equal(result.supplierRemediation.length, 1);
  assert.equal(result.supplierRemediation[0].supplierId, "SUP-A");
});

test("CTP remains indeterminate when deterministic resource assignment is incomplete", () => {
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

  const result = evaluateConstrainedCapableToPromise(input, {
    requestId: "QUOTE-5",
    productId: "latitude",
    quantity: 1,
    requestedPeriod: 1,
  });

  assert.equal(result.status, "indeterminate");
  assert.ok(result.indeterminate.some((row) => row.code === "ALTERNATE_RESOURCE_ASSIGNMENT_REQUIRED"));
});

test("CTP validates the commercial request before evaluating promise dates", () => {
  const result = evaluateConstrainedCapableToPromise(model(), {
    requestId: "",
    productId: "latitude",
    quantity: 0,
    requestedPeriod: 4,
  });

  assert.equal(result.status, "invalid_request");
  assert.equal(result.candidates.length, 0);
});
