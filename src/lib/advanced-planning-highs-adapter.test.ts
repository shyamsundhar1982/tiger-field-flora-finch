import test from "node:test";
import assert from "node:assert/strict";
import loadHighs from "highs";
import {
  createHighsAdvancedPlanningOptimizer,
  encodeAdvancedMathModelToCplexLp,
  type HighsLegacyLike,
} from "./advanced-planning-highs-adapter.ts";
import { compileAdvancedPlanningMathematicalModel } from "./advanced-planning-math-model.ts";
import { runGovernedAdvancedOptimizer } from "./advanced-planning-optimizer.ts";
import {
  ADVANCED_PLANNING_MODEL_VERSION,
  type AdvancedPlanningConstraintModel,
} from "./advanced-planning-constraints.ts";

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
      { sku: "FRAME-M", onHandQty: 10, reservedQty: 0, safetyStockQty: 0 },
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

test("CPLEX LP encoder emits deterministic objective, bounds, binaries and constraints", () => {
  const compiled = compileAdvancedPlanningMathematicalModel(sourceModel());
  assert.equal(compiled.valid, true);
  assert.ok(compiled.model);
  const lp = encodeAdvancedMathModelToCplexLp(compiled.model);
  assert.match(lp, /^Minimize\n obj:/);
  assert.match(lp, /Subject To/);
  assert.match(lp, /DEMAND_BALANCE__D_1:/);
  assert.match(lp, /RESOURCE_CAP__WC_1__1:/);
  assert.match(lp, /Bounds/);
  assert.match(lp, /Binary\n OP_ACTIVE__OP_1__WC_1__1/);
  assert.match(lp, /End\n$/);
  assert.equal(lp, encodeAdvancedMathModelToCplexLp(compiled.model));
});

test("HiGHS adapter maps a valid optimal MIP result through the governed optimizer contract", async () => {
  let problemText = "";
  let receivedOptions: Record<string, unknown> | undefined;
  const highs: HighsLegacyLike = {
    solve(problem, options) {
      problemText = problem;
      receivedOptions = options;
      return {
        Status: "Optimal",
        ObjectiveValue: 0,
        Columns: {
          PROD__BIKE_M__1: { Primal: 2 },
          PROD__BIKE_M__2: { Primal: 0 },
          UNMET__D_1: { Primal: 0 },
          FULFILL__D_1__1: { Primal: 2 },
          FULFILL__D_1__2: { Primal: 0 },
          ASSIGN__OP_1__WC_1__1: { Primal: 2 },
          ASSIGN__OP_1__WC_1__2: { Primal: 0 },
          OP_ACTIVE__OP_1__WC_1__1: { Primal: 1 },
          OP_ACTIVE__OP_1__WC_1__2: { Primal: 0 },
          RES_OVER__WC_1__1: { Primal: 0 },
          RES_OVER__WC_1__2: { Primal: 0 },
        },
        Rows: [],
      };
    },
  };

  const run = await runGovernedAdvancedOptimizer(
    sourceModel(),
    createHighsAdvancedPlanningOptimizer(highs),
    { requestId: "TEST-HIGHS-1", maxRuntimeMs: 5000, mipGap: 0.02 },
  );

  assert.equal(run.accepted, true);
  assert.equal(run.result?.status, "optimal");
  assert.equal(run.result?.objectiveValue, 0);
  assert.deepEqual(run.result?.solution?.production, [{ productId: "BIKE-M", period: 1, quantity: 2 }]);
  assert.deepEqual(run.result?.solution?.demandOutcomes, [
    { demandId: "D-1", servedQty: 2, unmetQty: 0, latenessPeriods: 0 },
  ]);
  assert.deepEqual(run.result?.solution?.resourceAssignments, [
    { operationId: "OP-1", resourceId: "WC-1", period: 1, quantity: 2, loadHours: 2.5 },
  ]);
  assert.match(problemText, /Minimize/);
  assert.equal(receivedOptions?.threads, 1);
  assert.equal(receivedOptions?.parallel, "off");
  assert.equal(receivedOptions?.random_seed, 0);
  assert.equal(receivedOptions?.time_limit, 5);
  assert.equal(receivedOptions?.mip_rel_gap, 0.02);
});

test("time-limited HiGHS result is feasible only when a primal solution exists", async () => {
  const withPrimal: HighsLegacyLike = {
    solve() {
      return {
        Status: "Time limit reached",
        ObjectiveValue: 20000,
        Columns: {
          UNMET__D_1: { Primal: 2 },
        },
        Rows: [],
      };
    },
  };
  const feasible = await createHighsAdvancedPlanningOptimizer(withPrimal).solve(sourceModel(), { requestId: "TL-1" });
  assert.equal(feasible.status, "feasible");
  assert.equal(feasible.solution?.demandOutcomes[0].unmetQty, 2);

  const withoutPrimal: HighsLegacyLike = {
    solve() {
      return { Status: "Time limit reached", Columns: {}, Rows: [] };
    },
  };
  const indeterminate = await createHighsAdvancedPlanningOptimizer(withoutPrimal).solve(sourceModel(), { requestId: "TL-2" });
  assert.equal(indeterminate.status, "indeterminate");
  assert.equal(indeterminate.solution, undefined);
});

test("published HiGHS 1.15.3 runtime solves the governed smoke model", async () => {
  const runtime = await loadHighs();
  const run = await runGovernedAdvancedOptimizer(
    sourceModel(),
    createHighsAdvancedPlanningOptimizer(runtime as unknown as HighsLegacyLike),
    { requestId: "REAL-HIGHS-1", maxRuntimeMs: 5000, mipGap: 0 },
  );

  assert.equal(run.accepted, true, run.issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n"));
  assert.equal(run.result?.status, "optimal");
  assert.equal(run.result?.solution?.demandOutcomes[0].unmetQty, 0);
  assert.equal(run.result?.solution?.production.reduce((sum, row) => sum + row.quantity, 0), 2);
  assert.equal(run.result?.objectiveValue, 0);
});
