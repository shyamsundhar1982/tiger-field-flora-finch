import assert from "node:assert/strict";
import test from "node:test";
import type { CashPlanRow } from "./integrated-business-planning-engine.ts";
import type { SupplierLane } from "./advanced-planning-constraints.ts";
import {
  compileCashGuardrailsFromIbpe,
  evaluateProcurementCashGuardrails,
} from "./advanced-planning-cash-guardrails.ts";

const cash: CashPlanRow[] = [
  { period: 1, selectedInflowsLakh: 0, selectedOutflowsLakh: 0, incrementalProcurementLakh: 0, closingCashLakh: 10, freeLiquidityLakh: 8, closingCashAfterRecommendationsLakh: 10, freeLiquidityAfterRecommendationsLakh: 8 },
  { period: 2, selectedInflowsLakh: 5, selectedOutflowsLakh: 2, incrementalProcurementLakh: 0, closingCashLakh: 13, freeLiquidityLakh: 11, closingCashAfterRecommendationsLakh: 13, freeLiquidityAfterRecommendationsLakh: 11 },
  { period: 3, selectedInflowsLakh: 0, selectedOutflowsLakh: 4, incrementalProcurementLakh: 0, closingCashLakh: 9, freeLiquidityLakh: 7, closingCashAfterRecommendationsLakh: 9, freeLiquidityAfterRecommendationsLakh: 7 },
];

const lane: SupplierLane = {
  id: "SUP-A:FRAME-LAT-M",
  supplierId: "SUP-A",
  sku: "FRAME-LAT-M",
  approved: true,
  leadTimePeriods: 1,
  moq: 1,
  orderMultiple: 1,
  landedUnitCostLakh: 1.5,
  reliability: 0.95,
};

test("IBPE base free liquidity compiles into cumulative reserve-preserving procurement headroom", () => {
  const compiled = compileCashGuardrailsFromIbpe(cash, 3, "IBPE-RUN-100:CASH");
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.guardrails.map((row) => row.cumulativeIncrementalProcurementHeadroomLakh), [8, 11, 7]);
  assert.ok(compiled.assumptions.some((row) => row.includes("before analytical replenishment recommendations")));
});

test("proposed procurement is checked cumulatively against governed cash headroom", () => {
  const compiled = compileCashGuardrailsFromIbpe(cash, 3, "IBPE-RUN-100:CASH");
  const result = evaluateProcurementCashGuardrails([
    { laneId: lane.id, supplierId: lane.supplierId, sku: lane.sku, orderPeriod: 1, receiptPeriod: 2, quantity: 2 },
    { laneId: lane.id, supplierId: lane.supplierId, sku: lane.sku, orderPeriod: 2, receiptPeriod: 3, quantity: 2 },
  ], [lane], compiled.guardrails);
  assert.equal(result.status, "feasible");
  assert.equal(result.totalProposedProcurementLakh, 6);
  assert.equal(result.periods[0].cumulativeProcurementSpendLakh, 3);
  assert.equal(result.periods[1].cumulativeProcurementSpendLakh, 6);
  assert.equal(result.periods[2].headroomAfterProposedProcurementLakh, 1);
});

test("cash guardrail detects a future reserve breach caused by earlier procurement spend", () => {
  const compiled = compileCashGuardrailsFromIbpe(cash, 3, "IBPE-RUN-100:CASH");
  const result = evaluateProcurementCashGuardrails([
    { laneId: lane.id, supplierId: lane.supplierId, sku: lane.sku, orderPeriod: 1, receiptPeriod: 2, quantity: 5 },
  ], [lane], compiled.guardrails);
  assert.equal(result.status, "infeasible");
  assert.equal(result.totalProposedProcurementLakh, 7.5);
  assert.equal(result.firstProposedBreachPeriod, 3);
});

test("baseline reserve breach is preserved even with zero incremental procurement", () => {
  const breached = cash.map((row) => ({ ...row }));
  breached[1].freeLiquidityLakh = -2;
  const compiled = compileCashGuardrailsFromIbpe(breached, 3, "IBPE-RUN-101:CASH");
  const result = evaluateProcurementCashGuardrails([], [lane], compiled.guardrails);
  assert.equal(compiled.valid, true);
  assert.equal(result.status, "infeasible");
  assert.equal(result.firstBaselineBreachPeriod, 2);
});

test("missing cash authority or supplier lane stays indeterminate", () => {
  const incomplete = compileCashGuardrailsFromIbpe(cash.slice(0, 2), 3, "IBPE-RUN-102:CASH");
  assert.equal(incomplete.valid, false);
  const compiled = compileCashGuardrailsFromIbpe(cash, 3, "IBPE-RUN-100:CASH");
  const result = evaluateProcurementCashGuardrails([
    { laneId: "UNKNOWN-LANE", supplierId: "SUP-X", sku: "FRAME-LAT-M", orderPeriod: 1, receiptPeriod: 2, quantity: 1 },
  ], [lane], compiled.guardrails);
  assert.equal(result.status, "indeterminate");
  assert.ok(result.issues.some((row) => row.code === "UNKNOWN_SUPPLIER_LANE"));
});
