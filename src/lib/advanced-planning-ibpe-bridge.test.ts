import assert from "node:assert/strict";
import test from "node:test";
import type { RuntimeIbpeInput } from "./ibpe-runtime-parity.ts";
import { buildAdvancedPlanningFromGovernedIbpe } from "./advanced-planning-ibpe-bridge.ts";

function governedInput(): RuntimeIbpeInput {
  return {
    demand: [
      {
        id: "M1-carbon",
        productId: "carbon",
        period: 1,
        planQty: 2,
        forecastQty: 2,
        committedQty: 1,
        actualQty: 0,
        confidence: 1,
        sourceRef: "PLAN-1-R1",
      },
    ],
    bom: [
      {
        id: "carbon:BOM-R1:FRAME",
        productId: "carbon",
        revisionId: "BOM-R1",
        approved: true,
        sku: "FRAME-CARBON-M",
        quantityPerUnit: 1,
        sourceRef: "BOM-R1",
      },
    ],
    inventory: [
      {
        sku: "FRAME-CARBON-M",
        onHandQty: 10,
        reservedQty: 0,
        safetyStockQty: 1,
        sourceRef: "EPR-FIFO-ATP",
      },
    ],
    receipts: [],
    reservations: [],
    committedMaterialRequirements: [],
    capacity: [],
    cashFlows: [],
    funding: {
      openingBankCashLakh: 10,
      minimumOperatingReserveLakh: 2,
      restrictedCashLakh: 0,
      fundraisingLeadMonths: 3,
    },
  };
}

const lineage = {
  sourceSnapshotId: "IBPE-1-abcdef123456-1234567",
  sourceSnapshotAt: "2026-09-12T03:30:00.000Z",
  sourceSha: "1234567890abcdef",
  sourceInputHash: "a".repeat(64),
  sourceEngineVersion: "VYNDI-IBPE-TEST",
  approvedPlanId: "PLAN-1",
  approvedPlanRevision: 1,
};

const capacity = [
  {
    workCentreId: "WC-010",
    workCentreName: "Kitting",
    travellerOperation: "Kitting",
    sequence: 10,
    availableHoursPerPeriod: 160,
    efficiency: 0.85,
    standardHoursPerUnit: 0.35,
    sourceRef: "CAPACITY-APPROVED",
    planningStatus: "approved",
  },
];

test("advanced packet is derived from governed IBPE input and remains provisional on planning-default capacity", () => {
  const result = buildAdvancedPlanningFromGovernedIbpe({
    lineage,
    input: governedInput(),
    createdAt: "2026-09-12T03:31:00.000Z",
    packetId: "ADV-IBPE-1",
    capacityStandards: [
      {
        ...capacity[0],
        sourceRef: "WORKBOOK-V5",
        planningStatus: "planning-default",
      },
    ],
  });

  assert.equal(result.authority.sourceTruth, "persisted-governed-ibpe-input");
  assert.equal(result.authority.routingAuthority, "provisional");
  assert.equal(result.authority.firmCtpEligible, false);
  assert.equal(result.authority.optimisationEligible, false);
  assert.ok(result.adapterNotices.some((row) => row.code === "SUPPLIER_LANES_NOT_COMPILED"));
  assert.equal(result.packetBuild.valid, true);
  assert.equal(result.packetBuild.packet?.lineage.sourceSnapshotId, lineage.sourceSnapshotId);
  assert.equal(result.packetBuild.packet?.summary.committedStatus, "feasible");
});

test("approved capacity standards improve evidence status but do not become persisted routing authority", () => {
  const result = buildAdvancedPlanningFromGovernedIbpe({
    lineage,
    input: governedInput(),
    createdAt: "2026-09-12T03:31:00.000Z",
    packetId: "ADV-IBPE-2",
    capacityStandards: capacity,
  });

  assert.equal(result.authority.routingAuthority, "approved-capacity-standards");
  assert.equal(result.authority.routingMode, "capacity-standard-derived");
  assert.equal(result.authority.firmCtpEligible, false);
  assert.equal(result.packetBuild.valid, true);
});

test("complete persisted approved routing elevates routing authority and packet evidence", () => {
  const routingSource = "ROUTING:CARBON:R1 | ROUTING:CARBON:R1:20";
  const result = buildAdvancedPlanningFromGovernedIbpe({
    lineage,
    input: governedInput(),
    createdAt: "2026-09-12T03:31:00.000Z",
    packetId: "ADV-IBPE-3",
    capacityStandards: capacity,
    governedRoutingOperations: [
      {
        id: "ROUTE-CARBON-R1:20",
        productId: "carbon",
        operationCode: "FINAL-KIT",
        sequence: 20,
        eligibleResourceIds: ["WC-010"],
        runHoursPerUnit: 0.4,
        setupHours: 0.1,
        yieldPct: 0.99,
        sourceRef: routingSource,
      },
    ],
    persistedRoutingRevisionIds: ["ROUTE-CARBON-R1"],
  });

  assert.equal(result.authority.routingMode, "persisted-approved");
  assert.equal(result.authority.routingAuthority, "approved-persisted");
  assert.deepEqual(result.authority.persistedRoutingRevisionIds, ["ROUTE-CARBON-R1"]);
  assert.equal(result.authority.firmCtpEligible, false);
  assert.equal(result.authority.optimisationEligible, false);
  assert.ok(result.adapterNotices.some((row) => row.code === "PERSISTED_ROUTING_AUTHORITY_COMPILED"));
  assert.equal(result.packetBuild.valid, true);
  assert.ok(result.packetBuild.packet?.evidenceRefs.includes(routingSource));
  assert.equal(result.packetBuild.packet?.summary.committedStatus, "feasible");
});
