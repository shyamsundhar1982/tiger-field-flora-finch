import test from "node:test";
import assert from "node:assert/strict";
import {
  compileAdvancedPlanningMathematicalModel,
  type MathConstraint,
} from "./advanced-planning-math-model.ts";
import {
  ADVANCED_PLANNING_MODEL_VERSION,
  type AdvancedPlanningConstraintModel,
} from "./advanced-planning-constraints.ts";

function governedModel(): AdvancedPlanningConstraintModel {
  return {
    modelVersion: ADVANCED_PLANNING_MODEL_VERSION,
    horizonPeriods: 2,
    demands: [
      { id: "D-COMMIT", productId: "BIKE-M", period: 1, quantity: 5, priority: 100, truth: "committed" },
      { id: "D-FORECAST", productId: "BIKE-M", period: 2, quantity: 3, priority: 50, truth: "forecast" },
    ],
    bom: [
      { id: "BOM-FRAME", productId: "BIKE-M", sku: "FRAME-M", quantityPerUnit: 2, scrapPct: 0.1 },
    ],
    materials: [
      { sku: "FRAME-M", onHandQty: 8, reservedQty: 1, safetyStockQty: 2 },
    ],
    committedReceipts: [
      { id: "REC-1", sku: "FRAME-M", period: 1, quantity: 4 },
    ],
    resources: [
      {
        id: "WC-A",
        name: "Work Centre A",
        type: "work_center",
        capabilities: ["LAMINATION"],
        efficiency: 0.8,
        capacity: [
          { period: 1, availableHours: 10 },
          { period: 2, availableHours: 10 },
        ],
      },
      {
        id: "WC-B",
        name: "Work Centre B",
        type: "work_center",
        capabilities: ["LAMINATION"],
        efficiency: 1,
        capacity: [
          { period: 1, availableHours: 6 },
          { period: 2, availableHours: 6 },
        ],
      },
    ],
    routingOperations: [
      {
        id: "OP-LAYUP",
        productId: "BIKE-M",
        operationCode: "LAYUP",
        sequence: 10,
        eligibleResourceIds: ["WC-A", "WC-B"],
        runHoursPerUnit: 1,
        setupHours: 0.5,
        yieldPct: 0.5,
      },
    ],
    supplierLanes: [
      {
        id: "SUP-1:FRAME-M",
        supplierId: "SUP-1",
        sku: "FRAME-M",
        approved: true,
        leadTimePeriods: 1,
        moq: 4,
        orderMultiple: 2,
        landedUnitCostLakh: 0.01,
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

function byId(rows: MathConstraint[], id: string) {
  const row = rows.find((item) => item.id === id);
  assert.ok(row, `missing constraint ${id}`);
  return row;
}

function coefficient(row: MathConstraint, variableId: string) {
  return row.terms.find((term) => term.variableId === variableId)?.coefficient;
}

test("compiler emits governed MILP algebra for demand, material, supplier and resources", () => {
  const compiled = compileAdvancedPlanningMathematicalModel(governedModel());
  assert.equal(compiled.valid, true);
  assert.ok(compiled.model);
  const model = compiled.model;
  assert.equal(model.version, "VYNDI-ADVANCED-MATH-MODEL-0.2");
  assert.equal(model.solverClass, "milp");

  const demandBalance = byId(model.constraints, "DEMAND_BALANCE__D_COMMIT");
  assert.equal(demandBalance.sense, "eq");
  assert.equal(demandBalance.rhs, 5);
  assert.equal(coefficient(demandBalance, "UNMET__D_COMMIT"), 1);
  assert.equal(coefficient(demandBalance, "FULFILL__D_COMMIT__1"), 1);
  assert.equal(coefficient(demandBalance, "FULFILL__D_COMMIT__2"), 1);

  const productionCap = byId(model.constraints, "PRODUCTION_TOTAL_CAP__BIKE_M");
  assert.equal(productionCap.sense, "le");
  assert.equal(productionCap.rhs, 8);
  assert.equal(coefficient(productionCap, "PROD__BIKE_M__1"), 1);
  assert.equal(coefficient(productionCap, "PROD__BIKE_M__2"), 1);

  const materialM1 = byId(model.constraints, "MATERIAL_CUMULATIVE__FRAME_M__1");
  assert.equal(materialM1.sense, "ge");
  // Protected opening = 8 - 1 reserved - 2 physically available safety + 4 committed receipt = 9.
  assert.equal(materialM1.rhs, -9);
  // BOM requirement = 2 × (1 + 0.1) = 2.2 per finished unit.
  assert.equal(coefficient(materialM1, "PROD__BIKE_M__1"), -2.2);

  const materialM2 = byId(model.constraints, "MATERIAL_CUMULATIVE__FRAME_M__2");
  assert.equal(coefficient(materialM2, "PROC_LOTS__SUP_1_FRAME_M__1"), 2);

  const moq = byId(model.constraints, "PROC_MOQ__SUP_1_FRAME_M__1");
  assert.equal(coefficient(moq, "PROC_LOTS__SUP_1_FRAME_M__1"), 2);
  assert.equal(coefficient(moq, "PROC_ACTIVE__SUP_1_FRAME_M__1"), -4);

  const supplierCap = byId(model.constraints, "SUP_CAP__SUP_1_FRAME_M__2");
  assert.equal(supplierCap.rhs, 20);
  assert.equal(coefficient(supplierCap, "PROC_LOTS__SUP_1_FRAME_M__1"), 2);
  assert.equal(coefficient(supplierCap, "SUP_OVER__SUP_1_FRAME_M__2"), -1);

  const assignment = byId(model.constraints, "OP_ASSIGNMENT__OP_LAYUP__1");
  assert.equal(coefficient(assignment, "ASSIGN__OP_LAYUP__WC_A__1"), 1);
  assert.equal(coefficient(assignment, "ASSIGN__OP_LAYUP__WC_B__1"), 1);
  assert.equal(coefficient(assignment, "PROD__BIKE_M__1"), -1);

  const resourceCap = byId(model.constraints, "RESOURCE_CAP__WC_A__1");
  assert.equal(resourceCap.rhs, 8); // 10 available hours × 0.8 governed efficiency.
  assert.equal(coefficient(resourceCap, "ASSIGN__OP_LAYUP__WC_A__1"), 2); // 1 run hour / 0.5 yield.
  assert.equal(coefficient(resourceCap, "OP_ACTIVE__OP_LAYUP__WC_A__1"), 0.5);
  assert.equal(coefficient(resourceCap, "RES_OVER__WC_A__1"), -1);
});

test("compiler does not turn an opening safety-stock deficit into negative inventory", () => {
  const model = governedModel();
  model.materials = [
    { sku: "FRAME-M", onHandQty: 0, reservedQty: 0, safetyStockQty: 5 },
  ];
  model.committedReceipts = [];
  model.supplierLanes = [];

  const compiled = compileAdvancedPlanningMathematicalModel(model);
  assert.equal(compiled.valid, true);
  assert.equal(compiled.model?.version, "VYNDI-ADVANCED-MATH-MODEL-0.2");
  const materialM1 = byId(compiled.model!.constraints, "MATERIAL_CUMULATIVE__FRAME_M__1");
  assert.equal(materialM1.rhs, 0);
  assert.ok(compiled.issues.some((issue) => issue.code === "OPENING_SAFETY_STOCK_DEFICIT"));
  assert.match(
    compiled.issues.find((issue) => issue.code === "OPENING_SAFETY_STOCK_DEFICIT")?.message ?? "",
    /opens 5 below its governed safety-stock target/i,
  );
});

test("compiler keeps over-reservation as a hard negative opening balance", () => {
  const model = governedModel();
  model.materials = [
    { sku: "FRAME-M", onHandQty: 0, reservedQty: 3, safetyStockQty: 5 },
  ];
  model.committedReceipts = [];
  model.supplierLanes = [];

  const compiled = compileAdvancedPlanningMathematicalModel(model);
  assert.equal(compiled.valid, true);
  const materialM1 = byId(compiled.model!.constraints, "MATERIAL_CUMULATIVE__FRAME_M__1");
  assert.equal(materialM1.rhs, 3);
});

test("compiler keeps unsupported objective semantics explicit rather than inventing them", () => {
  const compiled = compileAdvancedPlanningMathematicalModel(governedModel());
  assert.equal(compiled.valid, true);
  const codes = new Set(compiled.issues.map((issue) => issue.code));
  assert.ok(codes.has("WORKING_CAPITAL_ZERO_BASIS"));
  assert.ok(codes.has("SCHEDULE_CHANGE_ZERO_BASIS"));
  assert.ok(codes.has("SUPPLIER_RELIABILITY_NOT_DERATED"));
  assert.equal(compiled.model?.variables.some((row) => row.objectiveKey === "workingCapital"), false);
  assert.equal(compiled.model?.variables.some((row) => row.objectiveKey === "scheduleChange"), false);
});

test("compiler blocks solver model when required finite supplier capacity evidence is incomplete", () => {
  const model = governedModel();
  model.supplierLanes[0].capacity = [{ period: 1, maxQty: 20 }];
  const compiled = compileAdvancedPlanningMathematicalModel(model);
  assert.equal(compiled.valid, false);
  assert.ok(compiled.issues.some((issue) => issue.code === "SUPPLIER_CAPACITY_PERIOD_REQUIRED"));
  assert.equal(compiled.model, undefined);
});
