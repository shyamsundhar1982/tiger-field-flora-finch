import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVANCED_PLANNING_MODEL_VERSION,
  type AdvancedPlanningConstraintModel,
  type PlanningObjectiveWeights,
} from "./advanced-planning-constraints.ts";
import {
  ADVANCED_OPTIMIZER_CONTRACT_VERSION,
  runGovernedAdvancedOptimizer,
  type AdvancedPlanningOptimizer,
  type AdvancedObjectiveContribution,
} from "./advanced-planning-optimizer.ts";

function model(): AdvancedPlanningConstraintModel {
  return {
    modelVersion: ADVANCED_PLANNING_MODEL_VERSION,
    horizonPeriods: 2,
    demands: [
      {
        id: "D-1",
        productId: "latitude",
        period: 1,
        quantity: 2,
        priority: 10,
        truth: "committed",
      },
    ],
    bom: [
      {
        id: "BOM-1",
        productId: "latitude",
        sku: "FRAME-LAT-M",
        quantityPerUnit: 1,
      },
    ],
    materials: [
      {
        sku: "FRAME-LAT-M",
        onHandQty: 5,
        reservedQty: 0,
        safetyStockQty: 1,
      },
    ],
    committedReceipts: [],
    resources: [
      {
        id: "WC-010",
        name: "Kitting",
        type: "work_center",
        capabilities: ["KITTING"],
        efficiency: 1,
        capacity: [
          { period: 1, availableHours: 10 },
          { period: 2, availableHours: 10 },
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
        reliability: 0.95,
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

function zeroObjectives(weights: PlanningObjectiveWeights): AdvancedObjectiveContribution[] {
  return (Object.keys(weights) as Array<keyof PlanningObjectiveWeights>).map((objective) => ({
    objective,
    rawValue: 0,
    weight: weights[objective],
    weightedValue: 0,
  }));
}

function validOptimizer(input: AdvancedPlanningConstraintModel): AdvancedPlanningOptimizer {
  return {
    metadata: {
      id: "TEST-MILP",
      version: "1.0.0",
      solverClass: "milp",
      engine: "test-solver",
      deterministic: true,
    },
    async solve() {
      return {
        status: "optimal",
        objectiveValue: 0,
        objectiveContributions: zeroObjectives(input.objectiveWeights),
        solution: {
          demandOutcomes: [{ demandId: "D-1", servedQty: 2, unmetQty: 0, latenessPeriods: 0 }],
          production: [{ productId: "latitude", period: 1, quantity: 2 }],
          procurement: [],
          resourceAssignments: [
            { operationId: "LAT-010", resourceId: "WC-010", period: 1, quantity: 2, loadHours: 2 },
          ],
        },
        bindingConstraints: [
          {
            code: "MATERIAL_BALANCE",
            entityType: "material",
            entityId: "FRAME-LAT-M",
            period: 1,
            slack: 2,
            message: "Opening governed inventory covers the committed frame requirement.",
          },
        ],
        diagnostics: ["Optimal test solution."],
      };
    },
  };
}

test("governed optimizer runner accepts a traceable internally valid mathematical solution", async () => {
  const input = model();
  const run = await runGovernedAdvancedOptimizer(input, validOptimizer(input), { requestId: "OPT-1" });

  assert.equal(run.contractVersion, ADVANCED_OPTIMIZER_CONTRACT_VERSION);
  assert.equal(run.accepted, true);
  assert.equal(run.result?.status, "optimal");
  assert.equal(run.baseline.committedStatus, "feasible");
  assert.deepEqual(run.governance, {
    advisoryOnly: true,
    mayCreateTransactions: false,
    humanApprovalRequiredForBusinessAction: true,
  });
  assert.deepEqual(run.issues, []);
});

test("optimizer output using unknown or ineligible governed entities is rejected", async () => {
  const input = model();
  const optimizer = validOptimizer(input);
  optimizer.solve = async () => ({
    status: "feasible",
    objectiveValue: 0,
    objectiveContributions: zeroObjectives(input.objectiveWeights),
    solution: {
      demandOutcomes: [{ demandId: "D-MISSING", servedQty: 1, unmetQty: 0, latenessPeriods: 0 }],
      production: [{ productId: "latitude", period: 1, quantity: 1 }],
      procurement: [
        {
          laneId: "SUP-MISSING",
          supplierId: "SUP-X",
          sku: "FRAME-LAT-M",
          orderPeriod: 1,
          receiptPeriod: 2,
          quantity: 1,
        },
      ],
      resourceAssignments: [
        { operationId: "LAT-010", resourceId: "WC-MISSING", period: 1, quantity: 1, loadHours: 1 },
      ],
    },
    bindingConstraints: [],
    diagnostics: [],
  });

  const run = await runGovernedAdvancedOptimizer(input, optimizer, { requestId: "OPT-2" });
  assert.equal(run.accepted, false);
  assert.ok(run.issues.some((row) => row.code === "UNKNOWN_DEMAND"));
  assert.ok(run.issues.some((row) => row.code === "UNKNOWN_SUPPLIER_LANE"));
  assert.ok(run.issues.some((row) => row.code === "UNKNOWN_RESOURCE"));
});

test("optimizer cannot substitute its own objective weights", async () => {
  const input = model();
  const optimizer = validOptimizer(input);
  const contributions = zeroObjectives(input.objectiveWeights);
  contributions[0] = { ...contributions[0], rawValue: 1, weight: 1, weightedValue: 1 };
  optimizer.solve = async () => ({
    status: "optimal",
    objectiveValue: 1,
    objectiveContributions: contributions,
    solution: {
      demandOutcomes: [{ demandId: "D-1", servedQty: 2, unmetQty: 0, latenessPeriods: 0 }],
      production: [{ productId: "latitude", period: 1, quantity: 2 }],
      procurement: [],
      resourceAssignments: [{ operationId: "LAT-010", resourceId: "WC-010", period: 1, quantity: 2, loadHours: 2 }],
    },
    bindingConstraints: [],
    diagnostics: [],
  });

  const run = await runGovernedAdvancedOptimizer(input, optimizer, { requestId: "OPT-3" });
  assert.equal(run.accepted, false);
  assert.ok(run.issues.some((row) => row.code === "OBJECTIVE_WEIGHT_MISMATCH"));
});

test("invalid governed model blocks solver invocation", async () => {
  const input = model();
  input.resources[0].efficiency = 2;
  let called = false;
  const optimizer = validOptimizer(input);
  optimizer.solve = async () => {
    called = true;
    throw new Error("must not run");
  };

  const run = await runGovernedAdvancedOptimizer(input, optimizer, { requestId: "OPT-4" });
  assert.equal(run.accepted, false);
  assert.equal(called, false);
  assert.ok(run.issues.some((row) => row.code === "MODEL_RESOURCE_EFFICIENCY"));
});

test("solver exceptions remain advisory failures and never become accepted proposals", async () => {
  const input = model();
  const optimizer = validOptimizer(input);
  optimizer.solve = async () => {
    throw new Error("solver runtime unavailable");
  };

  const run = await runGovernedAdvancedOptimizer(input, optimizer, { requestId: "OPT-5" });
  assert.equal(run.accepted, false);
  assert.equal(run.result, undefined);
  assert.ok(run.issues.some((row) => row.code === "SOLVER_EXCEPTION"));
});
