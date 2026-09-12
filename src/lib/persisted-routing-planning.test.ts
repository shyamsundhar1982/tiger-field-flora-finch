import assert from "node:assert/strict";
import test from "node:test";
import {
  compilePersistedRoutingForPlanning,
  type PersistedRoutingOperationRow,
} from "./persisted-routing-planning.ts";

function routeRows(productId = "latitude", revisionId = "ROUTE-LAT-R1"): PersistedRoutingOperationRow[] {
  return [
    {
      revision_id: revisionId,
      product_id: productId,
      revision_code: "R1",
      effective_from: "2026-09-01",
      effective_to: null,
      revision_source_ref: `ROUTING:${productId}:R1`,
      operation_id: `${revisionId}:10`,
      operation_code: "LAYUP",
      sequence: 10,
      run_hours_per_unit: 2,
      setup_hours: 0.5,
      yield_pct: 0.98,
      epr_gate_id: "EPR-10",
      traveller_operation: "Layup",
      operation_source_ref: `ROUTING:${productId}:R1:10`,
      eligible_resource_ids: ["WC-LAYUP"],
      predecessor_operation_ids: [],
    },
    {
      revision_id: revisionId,
      product_id: productId,
      revision_code: "R1",
      effective_from: "2026-09-01",
      effective_to: null,
      revision_source_ref: `ROUTING:${productId}:R1`,
      operation_id: `${revisionId}:20`,
      operation_code: "CURE",
      sequence: 20,
      run_hours_per_unit: 3,
      setup_hours: 0.25,
      yield_pct: 0.99,
      epr_gate_id: "EPR-20",
      traveller_operation: "Cure",
      operation_source_ref: `ROUTING:${productId}:R1:20`,
      eligible_resource_ids: ["WC-CURE"],
      predecessor_operation_ids: [`${revisionId}:10`],
    },
  ];
}

test("complete approved persisted routes compile for every planned product", () => {
  const rows = [...routeRows("latitude", "ROUTE-LAT-R1"), ...routeRows("altitude", "ROUTE-ALT-R1")];
  const result = compilePersistedRoutingForPlanning({
    rows,
    productIds: ["latitude", "altitude"],
    knownResourceIds: ["WC-LAYUP", "WC-CURE"],
    asOfDate: "2026-09-12T04:00:00.000Z",
  });

  assert.equal(result.complete, true);
  assert.deepEqual(result.revisionIds, ["ROUTE-ALT-R1", "ROUTE-LAT-R1"]);
  assert.equal(result.routingOperations.length, 4);
  assert.deepEqual(result.missingProductIds, []);
  assert.deepEqual(result.ambiguousProductIds, []);
});

test("one missing product prevents mixed routing authority", () => {
  const result = compilePersistedRoutingForPlanning({
    rows: routeRows(),
    productIds: ["latitude", "altitude"],
    knownResourceIds: ["WC-LAYUP", "WC-CURE"],
    asOfDate: "2026-09-12",
  });

  assert.equal(result.complete, false);
  assert.deepEqual(result.routingOperations, []);
  assert.deepEqual(result.missingProductIds, ["altitude"]);
});

test("overlapping effective persisted revisions remain ambiguous rather than selecting one", () => {
  const result = compilePersistedRoutingForPlanning({
    rows: [...routeRows("latitude", "ROUTE-LAT-R1"), ...routeRows("latitude", "ROUTE-LAT-R2")],
    productIds: ["latitude"],
    knownResourceIds: ["WC-LAYUP", "WC-CURE"],
    asOfDate: "2026-09-12",
  });

  assert.equal(result.complete, false);
  assert.deepEqual(result.ambiguousProductIds, ["latitude"]);
  assert.deepEqual(result.routingOperations, []);
});

test("unknown resource in a persisted revision blocks solver routing", () => {
  const rows = routeRows();
  rows[0] = { ...rows[0], eligible_resource_ids: ["WC-UNKNOWN"] };
  const result = compilePersistedRoutingForPlanning({
    rows,
    productIds: ["latitude"],
    knownResourceIds: ["WC-LAYUP", "WC-CURE"],
    asOfDate: "2026-09-12",
  });

  assert.equal(result.complete, false);
  assert.deepEqual(result.routingOperations, []);
  assert.ok(result.issues.some((issue) => issue.code === "ROUTING_RESOURCE_UNKNOWN"));
});

test("out-of-effectivity routing is treated as missing", () => {
  const rows = routeRows().map((row) => ({ ...row, effective_to: "2026-09-10" }));
  const result = compilePersistedRoutingForPlanning({
    rows,
    productIds: ["latitude"],
    knownResourceIds: ["WC-LAYUP", "WC-CURE"],
    asOfDate: "2026-09-12",
  });
  assert.equal(result.complete, false);
  assert.deepEqual(result.missingProductIds, ["latitude"]);
});
