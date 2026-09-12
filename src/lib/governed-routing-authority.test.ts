import assert from "node:assert/strict";
import test from "node:test";
import { compileGovernedRoutingAuthority } from "./governed-routing-authority.ts";

const revision = {
  id: "ROUTE-LAT-R1",
  productId: "latitude",
  revision: "R1",
  status: "approved" as const,
  effectiveFrom: "2026-09-01",
  sourceRef: "ROUTING-AUTHORITY:ROUTE-LAT-R1",
};

const operations = [
  {
    id: "LAT-010",
    revisionId: "ROUTE-LAT-R1",
    operationCode: "KITTING",
    sequence: 10,
    eligibleResourceIds: ["WC-010"],
    runHoursPerUnit: 0.35,
    setupHours: 0.1,
    yieldPct: 1,
    eprGateId: "EPR-04",
    travellerOperation: "Kitting",
    sourceRef: "ROUTE-LAT-R1:010",
  },
  {
    id: "LAT-020",
    revisionId: "ROUTE-LAT-R1",
    operationCode: "FRAME_RECEIPT",
    sequence: 20,
    eligibleResourceIds: ["WC-020"],
    runHoursPerUnit: 0.25,
    predecessorOperationIds: ["LAT-010"],
    eprGateId: "EPR-05",
    travellerOperation: "Frame / frameset receipt",
    sourceRef: "ROUTE-LAT-R1:020",
  },
];

test("approved effective routing compiles into ordered advanced-planning operations", () => {
  const result = compileGovernedRoutingAuthority({
    asOfDate: "2026-09-12",
    revision,
    operations,
    knownResourceIds: ["WC-010", "WC-020"],
  });

  assert.equal(result.solverReady, true);
  assert.deepEqual(result.issues, []);
  assert.equal(result.operations.length, 2);
  assert.equal(result.operations[0].id, "LAT-010");
  assert.equal(result.operations[1].predecessorOperationIds?.[0], "LAT-010");
  assert.equal(result.eprGateByOperationId["LAT-020"], "EPR-05");
  assert.equal(result.travellerOperationByOperationId["LAT-010"], "Kitting");
});

test("draft or out-of-effectivity routing is not solver eligible", () => {
  const draft = compileGovernedRoutingAuthority({
    asOfDate: "2026-09-12",
    revision: { ...revision, status: "draft" as const },
    operations,
    knownResourceIds: ["WC-010", "WC-020"],
  });
  assert.equal(draft.solverReady, false);
  assert.equal(draft.operations.length, 0);
  assert.ok(draft.issues.some((row) => row.code === "ROUTING_REVISION_NOT_APPROVED"));

  const future = compileGovernedRoutingAuthority({
    asOfDate: "2026-09-12",
    revision: { ...revision, effectiveFrom: "2026-10-01" },
    operations,
    knownResourceIds: ["WC-010", "WC-020"],
  });
  assert.equal(future.solverReady, false);
  assert.ok(future.issues.some((row) => row.code === "ROUTING_NOT_EFFECTIVE"));
});

test("unknown resources and invalid predecessor order block routing", () => {
  const result = compileGovernedRoutingAuthority({
    asOfDate: "2026-09-12",
    revision,
    operations: [
      operations[0],
      {
        ...operations[1],
        eligibleResourceIds: ["WC-MISSING"],
        predecessorOperationIds: ["LAT-020"],
      },
    ],
    knownResourceIds: ["WC-010", "WC-020"],
  });

  assert.equal(result.solverReady, false);
  assert.ok(result.issues.some((row) => row.code === "ROUTING_UNKNOWN_RESOURCE"));
  assert.ok(result.issues.some((row) => row.code === "ROUTING_PREDECESSOR_SEQUENCE"));
});

test("missing EPR gate linkage is visible but does not invalidate a planning routing", () => {
  const result = compileGovernedRoutingAuthority({
    asOfDate: "2026-09-12",
    revision,
    operations: [{ ...operations[0], eprGateId: undefined }],
    knownResourceIds: ["WC-010"],
  });

  assert.equal(result.solverReady, true);
  assert.equal(result.operations.length, 1);
  assert.ok(result.issues.some((row) => row.code === "ROUTING_EPR_GATE_MISSING" && row.severity === "warning"));
});
