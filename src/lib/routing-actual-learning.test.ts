import assert from "node:assert/strict";
import test from "node:test";
import type { RoutingOperation } from "./advanced-planning-constraints.ts";
import { reconcileRoutingActuals } from "./routing-actual-learning.ts";

const routing: RoutingOperation[] = [
  {
    id: "LAT-010",
    productId: "latitude",
    operationCode: "KITTING",
    sequence: 10,
    eligibleResourceIds: ["WC-010"],
    runHoursPerUnit: 1,
  },
  {
    id: "LAT-020",
    productId: "latitude",
    operationCode: "FRAME_RECEIPT",
    sequence: 20,
    eligibleResourceIds: ["WC-020"],
    runHoursPerUnit: 0.5,
    predecessorOperationIds: ["LAT-010"],
  },
];

test("completed EPR operations reconcile to routing and produce cycle variance without auto-updating standards", () => {
  const result = reconcileRoutingActuals(routing, [
    {
      id: "EPR-OP-1",
      travellerId: "TRV-1",
      operationCode: "KITTING",
      workstation: "WC-010",
      startedAt: "2026-09-12T01:00:00.000Z",
      completedAt: "2026-09-12T02:30:00.000Z",
      status: "completed",
      recordReference: "TRV-1-KIT",
    },
    {
      id: "EPR-OP-2",
      travellerId: "TRV-1",
      operationCode: "FRAME_RECEIPT",
      workstation: "WC-020",
      startedAt: "2026-09-12T03:00:00.000Z",
      completedAt: "2026-09-12T03:30:00.000Z",
      status: "completed",
    },
  ]);

  assert.equal(result.learningReady, true);
  assert.equal(result.summary.completedTimedOperationCount, 2);
  assert.equal(result.summary.totalActualHours, 2);
  assert.equal(result.summary.totalExpectedRunHours, 1.5);
  assert.equal(result.summary.totalVarianceHours, 0.5);
  assert.equal(result.matches[0].varianceHours, 0.5);
  assert.equal(result.matches[0].variancePct, 0.5);
  assert.equal(result.matches[0].resourceEvidence, "eligible_resource_id");
  assert.deepEqual(result.governance, {
    mayAutoUpdateRoutingStandards: false,
    humanReviewRequiredForStandardChange: true,
  });
});

test("free-text workstation that is not a governed resource remains visible as unresolved evidence", () => {
  const result = reconcileRoutingActuals([routing[0]], [
    {
      id: "EPR-OP-3",
      travellerId: "TRV-2",
      operationCode: "KITTING",
      workstation: "Kitting Bay A",
      startedAt: "2026-09-12T01:00:00.000Z",
      completedAt: "2026-09-12T02:00:00.000Z",
      status: "completed",
    },
  ]);

  assert.equal(result.learningReady, true);
  assert.equal(result.matches[0].resourceEvidence, "unresolved");
  assert.ok(result.issues.some((row) => row.code === "WORKSTATION_RESOURCE_UNRESOLVED"));
});

test("completed operation without a timestamp pair cannot calibrate cycle time", () => {
  const result = reconcileRoutingActuals([routing[0]], [
    {
      id: "EPR-OP-4",
      travellerId: "TRV-3",
      operationCode: "KITTING",
      workstation: "WC-010",
      status: "completed",
    },
  ]);

  assert.equal(result.learningReady, false);
  assert.equal(result.summary.completedTimedOperationCount, 0);
  assert.ok(result.issues.some((row) => row.code === "COMPLETED_OPERATION_WITHOUT_DURATION"));
});

test("unmatched actual operations and missing routing actuals are reported rather than coerced", () => {
  const result = reconcileRoutingActuals(routing, [
    {
      id: "EPR-OP-5",
      travellerId: "TRV-4",
      operationCode: "UNKNOWN_PROCESS",
      status: "completed",
      startedAt: "2026-09-12T01:00:00.000Z",
      completedAt: "2026-09-12T02:00:00.000Z",
    },
  ]);

  assert.deepEqual(result.unmatchedActualOperationIds, ["EPR-OP-5"]);
  assert.deepEqual(result.missingRoutingOperationIds, ["LAT-010", "LAT-020"]);
  assert.ok(result.issues.some((row) => row.code === "UNMATCHED_ACTUAL_OPERATION"));
  assert.ok(result.issues.some((row) => row.code === "ROUTING_OPERATION_NO_ACTUAL"));
});

test("ambiguous routing operation codes block learning", () => {
  const result = reconcileRoutingActuals(
    [routing[0], { ...routing[1], operationCode: "KITTING" }],
    [
      {
        id: "EPR-OP-6",
        travellerId: "TRV-5",
        operationCode: "KITTING",
        status: "completed",
        startedAt: "2026-09-12T01:00:00.000Z",
        completedAt: "2026-09-12T02:00:00.000Z",
      },
    ],
  );

  assert.equal(result.learningReady, false);
  assert.ok(result.issues.some((row) => row.code === "AMBIGUOUS_ROUTING_OPERATION_CODE"));
  assert.ok(result.issues.some((row) => row.code === "AMBIGUOUS_ACTUAL_OPERATION"));
});
