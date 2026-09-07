import assert from "node:assert/strict";
import test from "node:test";
import { availableQuantity, fifoIssue, forecastLedger, type MasterLedgerRow } from "./master-ledger.ts";

const rows: MasterLedgerRow[] = [
  { id: "old", ledgerId: "stock", serialNo: "OLD", description: "Old lot", purchasePrice: 10, purchaseDate: "2026-01-01", expiryDate: "", nextInspectionDate: "", quantity: 3, mslLevel: 2, issues: [] },
  { id: "new", ledgerId: "stock", serialNo: "NEW", description: "New lot", purchasePrice: 12, purchaseDate: "2026-02-01", expiryDate: "", nextInspectionDate: "", quantity: 4, mslLevel: 2, issues: [] },
];

test("FIFO issues consume the oldest lot first", () => {
  const issued = fifoIssue(rows, "stock", 4, "2026-09-07", "issue");
  assert.equal(availableQuantity(issued[0]), 0);
  assert.equal(availableQuantity(issued[1]), 3);
  assert.equal(issued[0].issues[0]?.quantity, 3);
  assert.equal(issued[1].issues[0]?.quantity, 1);
});

test("36-month forecast reports deterministic replenishment", () => {
  const forecast = forecastLedger(rows, "stock");
  assert.deepEqual(forecast, {
    quantity: 7,
    mslLevel: 4,
    monthlyDemand: 2,
    firstReplenishmentMonth: 2,
    plannedPurchaseQuantity: 69,
    status: "Replenish",
  });
});
