import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVANCED_PLANNING_MODEL_VERSION,
  type AdvancedPlanningConstraintModel,
} from "./advanced-planning-constraints.ts";
import {
  ADVANCED_PLANNING_PACKET_VERSION,
  CONSTRAINED_CTP_ALGORITHM,
  DETERMINISTIC_FEASIBILITY_ALGORITHM,
  buildAdvancedPlanningDecisionPacket,
} from "./advanced-planning-decision-packet.ts";

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
        sourceRef: "IBPE-DEMAND:D-1",
      },
    ],
    bom: [
      {
        id: "BOM-1",
        productId: "latitude",
        sku: "FRAME-LAT-M",
        quantityPerUnit: 1,
        sourceRef: "BOM:R1",
      },
    ],
    materials: [
      {
        sku: "FRAME-LAT-M",
        onHandQty: 5,
        reservedQty: 0,
        safetyStockQty: 1,
        sourceRef: "ATP:FRAME-LAT-M",
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
        sourceRef: "CAPACITY:WC-010",
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
        sourceRef: "ROUTING:LAT-R1:010",
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

const lineage = {
  sourceSnapshotId: "IBPE-RUN-100",
  sourceSnapshotAt: "2026-09-12T03:30:00.000Z",
  sourceSha: "abcdef1234567890",
  sourceInputHash: "0123456789abcdef0123456789abcdef",
  sourceEngineVersion: "VYNDI-IBPE-1.3",
  approvedPlanId: "PLAN-2026",
  approvedPlanRevision: 7,
};

test("decision packet preserves exact source/model/algorithm lineage and advisory governance", () => {
  const result = buildAdvancedPlanningDecisionPacket({
    packetId: "ADV-PKT-1",
    createdAt: "2026-09-12T03:31:00.000Z",
    lineage,
    model: model(),
    ctpRequests: [
      {
        requestId: "QUOTE-1",
        productId: "latitude",
        quantity: 1,
        requestedPeriod: 1,
        sourceRef: "COMMERCIAL:QUOTE-1",
      },
    ],
  });

  assert.equal(result.valid, true);
  assert.ok(result.packet);
  assert.equal(result.packet?.packetVersion, ADVANCED_PLANNING_PACKET_VERSION);
  assert.equal(result.packet?.lineage.sourceSnapshotId, "IBPE-RUN-100");
  assert.equal(result.packet?.lineage.advancedModelVersion, ADVANCED_PLANNING_MODEL_VERSION);
  assert.equal(result.packet?.lineage.algorithms.feasibility, DETERMINISTIC_FEASIBILITY_ALGORITHM);
  assert.equal(result.packet?.lineage.algorithms.capableToPromise, CONSTRAINED_CTP_ALGORITHM);
  assert.deepEqual(result.packet?.governance, {
    advisoryOnly: true,
    mayCreateTransactions: false,
    humanApprovalRequiredForBusinessAction: true,
  });
  assert.equal(result.packet?.summary.committedStatus, "feasible");
  assert.equal(result.packet?.summary.ctpPromiseAvailableCount, 1);
  assert.deepEqual(result.packet?.evidenceRefs, [
    "ATP:FRAME-LAT-M",
    "BOM:R1",
    "CAPACITY:WC-010",
    "IBPE-DEMAND:D-1",
    "ROUTING:LAT-R1:010",
  ]);
});

test("decision packet refuses incomplete lineage", () => {
  const result = buildAdvancedPlanningDecisionPacket({
    packetId: "ADV-PKT-2",
    createdAt: "2026-09-12T03:31:00.000Z",
    lineage: { ...lineage, sourceSha: "", sourceInputHash: "short" },
    model: model(),
  });

  assert.equal(result.valid, false);
  assert.equal(result.packet, undefined);
  assert.ok(result.issues.some((row) => row.code === "SOURCE_SHA"));
  assert.ok(result.issues.some((row) => row.code === "SOURCE_INPUT_HASH"));
});

test("decision packet refuses invalid advanced planning truth rather than persisting a conclusion", () => {
  const input = model();
  input.resources[0].efficiency = 1.5;

  const result = buildAdvancedPlanningDecisionPacket({
    packetId: "ADV-PKT-3",
    createdAt: "2026-09-12T03:31:00.000Z",
    lineage,
    model: input,
  });

  assert.equal(result.valid, false);
  assert.equal(result.packet, undefined);
  assert.ok(result.issues.some((row) => row.code === "ADVANCED_MODEL_INVALID"));
});

test("duplicate CTP request IDs block packet emission", () => {
  const request = {
    requestId: "QUOTE-1",
    productId: "latitude",
    quantity: 1,
    requestedPeriod: 1,
  };
  const result = buildAdvancedPlanningDecisionPacket({
    packetId: "ADV-PKT-4",
    createdAt: "2026-09-12T03:31:00.000Z",
    lineage,
    model: model(),
    ctpRequests: [request, request],
  });

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((row) => row.code === "CTP_DUPLICATE_REQUEST_ID"));
});
