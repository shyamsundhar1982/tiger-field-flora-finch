import assert from "node:assert/strict";
import test from "node:test";
import type { IntegratedPlanningResult } from "./integrated-business-planning-engine.ts";
import type { RuntimeIbpeInput } from "./ibpe-runtime-parity.ts";
import { prepareAdvancedOptimizerEnvelope } from "./advanced-optimizer-preparation.ts";

const lineage = {
  sourceSnapshotId: "IBPE-EXACT-1",
  sourceSnapshotAt: "2026-09-12T08:00:00.000Z",
  sourceSha: "1234567890abcdef",
  sourceInputHash: "a".repeat(64),
  sourceEngineVersion: "VYNDI-IBPE-TEST",
  approvedPlanId: "PLAN-1",
  approvedPlanRevision: 1,
};

function input(): RuntimeIbpeInput {
  return {
    demand: [{
      id: "M1-carbon",
      productId: "carbon",
      period: 1,
      planQty: 2,
      forecastQty: 2,
      committedQty: 1,
      actualQty: 0,
      confidence: 1,
      sourceRef: "PLAN-1-R1",
    }],
    bom: [{
      id: "carbon:BOM-R1:FRAME",
      productId: "carbon",
      revisionId: "BOM-R1",
      approved: true,
      sku: "FRAME-CARBON-M",
      quantityPerUnit: 1,
      sourceRef: "BOM-R1",
    }],
    inventory: [{
      sku: "FRAME-CARBON-M",
      onHandQty: 10,
      reservedQty: 0,
      safetyStockQty: 1,
      sourceRef: "EPR-FIFO-ATP",
    }],
    receipts: [],
    reservations: [],
    committedMaterialRequirements: [],
    capacity: [],
    cashFlows: [],
    funding: {
      openingBankCashLakh: 20,
      minimumOperatingReserveLakh: 2,
      restrictedCashLakh: 0,
      fundraisingLeadMonths: 3,
    },
  };
}

function result(freeLiquidity = 10): IntegratedPlanningResult {
  return {
    cash: Array.from({ length: 36 }, (_, index) => ({
      period: index + 1,
      selectedInflowsLakh: 0,
      selectedOutflowsLakh: 0,
      incrementalProcurementLakh: 0,
      closingCashLakh: freeLiquidity + 2,
      freeLiquidityLakh: freeLiquidity,
      closingCashAfterRecommendationsLakh: freeLiquidity + 2,
      freeLiquidityAfterRecommendationsLakh: freeLiquidity,
    })),
  } as IntegratedPlanningResult;
}

const capacity = [{
  workCentreId: "WC-010",
  workCentreName: "Kitting",
  travellerOperation: "Kitting",
  sequence: 10,
  availableHoursPerPeriod: 160,
  efficiency: 0.85,
  standardHoursPerUnit: 0.35,
  sourceRef: "CAPACITY-APPROVED",
  planningStatus: "approved",
}];

const routing = [{
  id: "ROUTE-CARBON-R1:20",
  productId: "carbon",
  operationCode: "FINAL-KIT",
  sequence: 20,
  eligibleResourceIds: ["WC-010"],
  runHoursPerUnit: 0.4,
  setupHours: 0.1,
  yieldPct: 0.99,
  sourceRef: "ROUTING:CARBON:R1",
}];

const supplierLanes = [{
  id: "SUP-A:FRAME-CARBON-M",
  supplierId: "SUP-A",
  sku: "FRAME-CARBON-M",
  approved: true,
  leadTimePeriods: 1,
  moq: 1,
  orderMultiple: 1,
  landedUnitCostLakh: 0.25,
  reliability: 0.95,
  capacity: Array.from({ length: 36 }, (_, index) => ({ period: index + 1, maxQty: 100 })),
  sourceRef: "SUPPLIER-LANE:SUP-A:FRAME-CARBON-M:R1",
}];

function prepare(overrides: Partial<Parameters<typeof prepareAdvancedOptimizerEnvelope>[0]> = {}) {
  return prepareAdvancedOptimizerEnvelope({
    lineage,
    input: input(),
    result: result(),
    capacityStandards: capacity,
    governedRoutingOperations: routing,
    persistedRoutingRevisionIds: ["ROUTE-CARBON-R1"],
    supplierLanes,
    persistedSupplierLaneRevisionIds: ["SUP-A:FRAME-CARBON-M:R1"],
    packetId: "ADV-IBPE-EXACT-1",
    createdAt: "2026-09-12T08:01:00.000Z",
    ...overrides,
  });
}

test("complete exact governed evidence produces a solver-ready preparation envelope", () => {
  const prepared = prepare();
  assert.equal(prepared.readyForGovernedOptimization, true);
  assert.equal(prepared.lineage.sourceSnapshotId, lineage.sourceSnapshotId);
  assert.equal(prepared.evidence.sourceInputHash, lineage.sourceInputHash);
  assert.equal(prepared.authority.routingAuthority, "approved-persisted");
  assert.equal(prepared.authority.supplierLaneAuthority, "approved-persisted");
  assert.equal(prepared.model.supplierLanes.length, 1);
  assert.equal(prepared.cashGuardrails.length, 36);
  assert.ok(prepared.cashGuardrails.every((row) => row.sourceRef.includes(lineage.sourceSnapshotId)));
});

test("capacity-derived routing is never upgraded into governed optimizer readiness", () => {
  const prepared = prepare({
    governedRoutingOperations: undefined,
    persistedRoutingRevisionIds: undefined,
  });
  assert.equal(prepared.readyForGovernedOptimization, false);
  assert.ok(prepared.issues.some((row) => row.code === "ROUTING_AUTHORITY_NOT_PERSISTED"));
});

test("missing supplier-lane authority blocks governed optimizer readiness", () => {
  const prepared = prepare({
    supplierLanes: undefined,
    persistedSupplierLaneRevisionIds: undefined,
  });
  assert.equal(prepared.readyForGovernedOptimization, false);
  assert.ok(prepared.issues.some((row) => row.code === "SUPPLIER_LANE_AUTHORITY_NOT_PERSISTED"));
});

test("incomplete exact-run cash evidence blocks readiness instead of inventing liquidity", () => {
  const incomplete = {
    cash: result().cash.slice(0, 35),
  } as IntegratedPlanningResult;
  const prepared = prepare({ result: incomplete });
  assert.equal(prepared.readyForGovernedOptimization, false);
  assert.equal(prepared.cashGuardrails.length, 0);
  assert.ok(prepared.issues.some((row) => row.code === "CASH_MISSING_CASH_PERIOD"));
});

test("source lineage is carried atomically into both model packet and cash evidence", () => {
  const prepared = prepare();
  assert.equal(prepared.packetId, "ADV-IBPE-EXACT-1");
  assert.equal(prepared.evidence.sourceSnapshotId, prepared.lineage.sourceSnapshotId);
  assert.equal(prepared.evidence.sourceSha, prepared.lineage.sourceSha);
  assert.equal(prepared.evidence.cashSourceRef, `${lineage.sourceSnapshotId}:${lineage.sourceInputHash}:CASH`);
});
