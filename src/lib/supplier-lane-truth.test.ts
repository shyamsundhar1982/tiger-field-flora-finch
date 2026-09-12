import assert from "node:assert/strict";
import test from "node:test";
import { compileSupplierLaneTruth } from "./supplier-lane-truth.ts";

const supplier = {
  supplierId: "SUP-A",
  approved: true,
  active: true,
  leadTimeDays: 35,
  qualityRating: 94,
  deliveryRating: 91,
  sourceCurrency: "INR",
  sourceRef: "SUPPLIER-MASTER:SUP-A",
};

const approvedPrice = {
  id: "PPRICE-SUP-A-FRAME",
  supplierId: "SUP-A",
  sku: "FRAME-LAT-M",
  unitPriceInr: 18000,
  currency: "INR",
  approved: true,
  sourceRef: "PROCUREMENT-PRICE:PPRICE-SUP-A-FRAME",
};

test("purchase price and supplier ratings remain evidence and are not promoted into missing solver truth", () => {
  const result = compileSupplierLaneTruth({
    horizonPeriods: 6,
    planningPeriodDays: 30,
    sku: "frame-lat-m",
    supplier,
    purchasePrice: approvedPrice,
  });

  assert.equal(result.solverReady, false);
  assert.equal(result.solverLane, undefined);
  assert.equal(result.candidate.purchaseUnitPriceInr, 18000);
  assert.equal(result.candidate.landedUnitCostInr, undefined);
  assert.equal(result.candidate.reliability, undefined);
  assert.deepEqual(result.missingEvidence.sort(), ["FINITE_CAPACITY", "LANDED_COST", "ORDER_POLICY", "RELIABILITY"]);
  assert.ok(result.notices.some((notice) => notice.code === "PURCHASE_PRICE_IS_NOT_LANDED_COST"));
  assert.ok(result.notices.some((notice) => notice.code === "RATINGS_ARE_NOT_RELIABILITY"));
});

test("complete governed lane evidence becomes solver eligible without changing source semantics", () => {
  const result = compileSupplierLaneTruth({
    horizonPeriods: 6,
    planningPeriodDays: 30,
    sku: "FRAME-LAT-M",
    supplier,
    purchasePrice: approvedPrice,
    landedCost: { landedUnitCostInr: 19500, sourceRef: "LANDED-COST:SUP-A:FRAME-LAT-M" },
    reliability: { reliability: 0.92, sourceRef: "SUPPLIER-RELIABILITY:SUP-A:R1" },
    policy: { moq: 10, orderMultiple: 5, alternateRank: 1, sourceRef: "LANE-POLICY:SUP-A:FRAME-LAT-M" },
    capacity: {
      capacity: [
        { period: 1, maxQty: 40 },
        { period: 2, maxQty: 50 },
        { period: 3, maxQty: 50 },
      ],
      sourceRef: "SUPPLIER-CAPACITY:SUP-A:FRAME-LAT-M:R1",
    },
  });

  assert.equal(result.solverReady, true);
  assert.deepEqual(result.missingEvidence, []);
  assert.ok(result.solverLane);
  assert.equal(result.solverLane?.leadTimePeriods, 2);
  assert.equal(result.solverLane?.landedUnitCostLakh, 0.195);
  assert.equal(result.solverLane?.reliability, 0.92);
  assert.equal(result.solverLane?.moq, 10);
  assert.equal(result.solverLane?.orderMultiple, 5);
  assert.deepEqual(result.solverLane?.capacity?.[0], { period: 1, maxQty: 40 });
  assert.equal(result.candidate.purchaseUnitPriceInr, 18000);
  assert.equal(result.candidate.landedUnitCostInr, 19500);
});

test("inactive or unapproved suppliers are blocked even when lane evidence is otherwise complete", () => {
  for (const supplierOverride of [
    { ...supplier, approved: false },
    { ...supplier, active: false },
  ]) {
    const result = compileSupplierLaneTruth({
      horizonPeriods: 3,
      planningPeriodDays: 30,
      sku: "FRAME-LAT-M",
      supplier: supplierOverride,
      landedCost: { landedUnitCostInr: 19500, sourceRef: "LC" },
      reliability: { reliability: 0.92, sourceRef: "REL" },
      policy: { moq: 1, orderMultiple: 1, sourceRef: "POL" },
      capacity: { capacity: [{ period: 1, maxQty: 20 }], sourceRef: "CAP" },
    });

    assert.equal(result.solverReady, false);
    assert.equal(result.solverLane, undefined);
  }
});

test("invalid finite-capacity evidence is rejected rather than silently clipped", () => {
  const result = compileSupplierLaneTruth({
    horizonPeriods: 3,
    planningPeriodDays: 30,
    sku: "FRAME-LAT-M",
    supplier,
    landedCost: { landedUnitCostInr: 19500, sourceRef: "LC" },
    reliability: { reliability: 0.92, sourceRef: "REL" },
    policy: { moq: 1, orderMultiple: 1, sourceRef: "POL" },
    capacity: {
      capacity: [
        { period: 1, maxQty: 20 },
        { period: 1, maxQty: 30 },
        { period: 4, maxQty: 10 },
      ],
      sourceRef: "CAP",
    },
  });

  assert.equal(result.solverReady, false);
  assert.ok(result.notices.some((notice) => notice.code === "DUPLICATE_CAPACITY_PERIOD"));
  assert.ok(result.notices.some((notice) => notice.code === "INVALID_CAPACITY_PERIOD"));
});
