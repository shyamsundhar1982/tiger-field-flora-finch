import assert from "node:assert/strict";
import test from "node:test";
import {
  compileAdvancedPlanningModel,
  type AdvancedPlanningAdapterInput,
} from "./advanced-planning-adapter.ts";
import { validateAdvancedPlanningConstraintModel } from "./advanced-planning-constraints.ts";

function input(): AdvancedPlanningAdapterInput {
  return {
    horizonPeriods: 3,
    planningInput: {
      demand: [
        {
          id: "D-LAT-M1",
          productId: "latitude",
          period: 1,
          planQty: 20,
          forecastQty: 20,
          committedQty: 6,
          actualQty: 4,
          sourceRef: "PLAN-R1",
        },
      ],
      bom: [
        {
          id: "B-LAT-FRAME",
          productId: "latitude",
          revisionId: "BOM-R1",
          approved: true,
          sku: "FRAME-LAT-M",
          quantityPerUnit: 1,
          sourceRef: "BOM-R1",
        },
      ],
      inventory: [
        {
          sku: "FRAME-LAT-M",
          onHandQty: 12,
          reservedQty: 2,
          safetyStockQty: 1,
          sourceRef: "ATP",
        },
      ],
      receipts: [
        {
          id: "PO-COMMITTED",
          sku: "FRAME-LAT-M",
          period: 2,
          quantity: 5,
          truth: "committed",
          sourceRef: "PO-1",
        },
        {
          id: "GR-ACTUAL",
          sku: "FRAME-LAT-M",
          period: 1,
          quantity: 3,
          truth: "actual",
          sourceRef: "GR-1",
        },
      ],
    },
    capacityStandards: [
      {
        workCentreId: "WC-010",
        workCentreName: "Kitting",
        travellerOperation: "Kitting",
        sequence: 10,
        availableHoursPerPeriod: 160,
        efficiency: 0.85,
        standardHoursPerUnit: 0.35,
        sourceRef: "WORKBOOK-V5",
      },
      {
        workCentreId: "WC-020",
        workCentreName: "Frameset receipt",
        travellerOperation: "Frame / frameset receipt",
        sequence: 20,
        availableHoursPerPeriod: 160,
        efficiency: 0.85,
        standardHoursPerUnit: 0.25,
        sourceRef: "WORKBOOK-V5",
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
    committedDemandPriority: 10,
    forecastDemandPriority: 50,
  };
}

test("adapter excludes actuals and avoids double-counting committed demand inside forecast", () => {
  const { model } = compileAdvancedPlanningModel(input());

  assert.equal(model.demands.length, 2);
  assert.deepEqual(
    model.demands.map((row) => [row.truth, row.quantity]),
    [
      ["committed", 6],
      ["forecast", 10],
    ],
  );
  assert.deepEqual(model.committedReceipts.map((row) => row.id), ["PO-COMMITTED"]);
});

test("adapter promotes governed work-centre standards into finite resources and ordered routings", () => {
  const { model } = compileAdvancedPlanningModel(input());

  assert.equal(model.resources.length, 2);
  assert.equal(model.resources[0].capacity.length, 3);
  assert.equal(model.resources[0].capacity[0].availableHours, 160);
  assert.equal(model.resources[0].efficiency, 0.85);

  assert.equal(model.routingOperations.length, 2);
  assert.deepEqual(model.routingOperations[0].eligibleResourceIds, ["WC-010"]);
  assert.deepEqual(model.routingOperations[1].predecessorOperationIds, [
    "latitude:WC-010",
  ]);
  assert.equal(model.routingOperations[1].runHoursPerUnit, 0.25);
});

test("adapter refuses to imply supplier optimisation when no governed supplier lanes exist", () => {
  const result = compileAdvancedPlanningModel(input());

  assert.equal(result.model.supplierLanes.length, 0);
  assert.ok(
    result.notices.some((notice) => notice.code === "SUPPLIER_LANES_NOT_COMPILED"),
  );
  assert.equal(validateAdvancedPlanningConstraintModel(result.model).valid, true);
});

test("adapter reports missing capacity authority instead of inventing capacity", () => {
  const value = input();
  value.capacityStandards = [];
  const result = compileAdvancedPlanningModel(value);

  assert.equal(result.model.resources.length, 0);
  assert.equal(result.model.routingOperations.length, 0);
  assert.ok(
    result.notices.some(
      (notice) => notice.code === "CAPACITY_STANDARDS_NOT_COMPILED",
    ),
  );
});
