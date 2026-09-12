import assert from "node:assert/strict";
import test from "node:test";
import {
  compilePersistedSupplierLanesForPlanning,
  type PersistedSupplierLaneRow,
} from "./persisted-supplier-lane-planning.ts";

function lane(sku = "FRAME-CARBON-M", supplier = "SUP-A", rank = 1): PersistedSupplierLaneRow {
  return {
    lane_revision_id: `${supplier}:${sku}:R1`, supplier_id: supplier, sku, revision_code: "R1",
    effective_from: "2026-09-01", effective_to: null, planning_period_days: 30, horizon_periods: 3,
    lead_time_days: 30, moq: 1, order_multiple: 1, alternate_rank: rank,
    landed_unit_cost_inr: 25000, landed_cost_source_ref: `LANDED:${supplier}:${sku}`,
    reliability: 0.95, reliability_method: "OTIF-12M", reliability_source_ref: `REL:${supplier}:${sku}`,
    policy_source_ref: `POLICY:${supplier}:${sku}`, source_ref: `LANE:${supplier}:${sku}:R1`,
    supplier_approval_status: "approved", supplier_active: true, supplier_currency: "INR",
    quality_rating: 96, delivery_rating: 93, supplier_source_ref: `SUPPLIER:${supplier}`,
    capacity_json: [{ period: 1, maxQty: 10 }, { period: 2, maxQty: 12 }, { period: 3, maxQty: 14 }],
  };
}

test("complete persisted supplier lanes compile for every required BOM SKU", () => {
  const result = compilePersistedSupplierLanesForPlanning({
    rows: [lane("FRAME-CARBON-M"), lane("FORK-CARBON-M", "SUP-B")],
    requiredSkus: ["FRAME-CARBON-M", "FORK-CARBON-M"], asOfDate: "2026-09-12",
  });
  assert.equal(result.complete, true);
  assert.equal(result.supplierLanes.length, 2);
  assert.deepEqual(result.missingSkus, []);
});

test("multiple approved alternate lanes remain available for one SKU", () => {
  const result = compilePersistedSupplierLanesForPlanning({
    rows: [lane("FRAME-CARBON-M", "SUP-A", 1), lane("FRAME-CARBON-M", "SUP-B", 2)],
    requiredSkus: ["FRAME-CARBON-M"], asOfDate: "2026-09-12",
  });
  assert.equal(result.complete, true);
  assert.deepEqual(result.supplierLanes.map((row) => row.supplierId), ["SUP-A", "SUP-B"]);
});

test("one uncovered BOM SKU disables the whole supplier network", () => {
  const result = compilePersistedSupplierLanesForPlanning({
    rows: [lane()], requiredSkus: ["FRAME-CARBON-M", "FORK-CARBON-M"], asOfDate: "2026-09-12",
  });
  assert.equal(result.complete, false);
  assert.deepEqual(result.supplierLanes, []);
  assert.deepEqual(result.missingSkus, ["FORK-CARBON-M"]);
});

test("supplier ratings remain evidence and do not substitute for governed reliability", () => {
  const broken = { ...lane(), reliability: Number.NaN };
  const result = compilePersistedSupplierLanesForPlanning({ rows: [broken], requiredSkus: ["FRAME-CARBON-M"], asOfDate: "2026-09-12" });
  assert.equal(result.complete, false);
  assert.ok(result.notices.some((notice) => notice.code === "INVALID_RELIABILITY"));
});

test("suspended or inactive supplier cannot become a solver lane", () => {
  const blocked = { ...lane(), supplier_approval_status: "suspended", supplier_active: false };
  const result = compilePersistedSupplierLanesForPlanning({ rows: [blocked], requiredSkus: ["FRAME-CARBON-M"], asOfDate: "2026-09-12" });
  assert.equal(result.complete, false);
  assert.deepEqual(result.supplierLanes, []);
});
