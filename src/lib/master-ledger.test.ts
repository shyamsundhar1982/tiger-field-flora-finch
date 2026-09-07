import assert from "node:assert/strict";
import test from "node:test";
import {
  availableQuantity,
  fifoIssue,
  forecastLedger,
  stockHealth,
  summarizeInventoryRows,
  type MasterLedgerRow,
} from "./master-ledger.ts";

const rows: MasterLedgerRow[] = [
  {
    id: "new",
    ledgerId: "components",
    serialNo: "PART-1",
    description: "New lot",
    purchasePrice: 12,
    purchaseDate: "2026-02-01",
    expiryDate: "",
    nextInspectionDate: "",
    quantity: 4,
    mslLevel: 4,
    plannedMonthlyUse: 2,
    issues: [],
  },
  {
    id: "old",
    ledgerId: "components",
    serialNo: "PART-1",
    description: "Old lot",
    purchasePrice: 10,
    purchaseDate: "2026-01-01",
    expiryDate: "",
    nextInspectionDate: "",
    quantity: 3,
    mslLevel: 4,
    plannedMonthlyUse: 2,
    issues: [],
  },
  {
    id: "other",
    ledgerId: "components",
    serialNo: "PART-2",
    description: "Different item",
    purchasePrice: 5,
    purchaseDate: "2025-01-01",
    expiryDate: "",
    nextInspectionDate: "",
    quantity: 9,
    mslLevel: 0,
    plannedMonthlyUse: 0,
    issues: [],
  },
];

test("FIFO issues consume only the requested SKU and sort oldest lot first", () => {
  const issued = fifoIssue(rows, "components", "PART-1", 4, "2026-09-07", "issue");
  assert.equal(availableQuantity(issued[0]), 3);
  assert.equal(availableQuantity(issued[1]), 0);
  assert.equal(availableQuantity(issued[2]), 9);
  assert.equal(issued[1].issues[0]?.quantity, 3);
  assert.equal(issued[0].issues[0]?.quantity, 1);
  assert.equal(issued[2].issues.length, 0);
});

test("36-month forecast reports deterministic replenishment", () => {
  const forecast = forecastLedger(rows.slice(0, 2), "components");
  assert.deepEqual(forecast, {
    quantity: 7,
    mslLevel: 4,
    monthlyDemand: 2,
    firstReplenishmentMonth: 2,
    plannedPurchaseQuantity: 69,
    status: "Replenish",
  });
});

test("MSL and demand remain SKU controls when one item has multiple lots", () => {
  const [item] = summarizeInventoryRows(rows.slice(0, 2));
  assert.equal(item.quantity, 7);
  assert.equal(item.mslLevel, 4);
  assert.equal(item.monthlyDemand, 2);
  assert.equal(item.lotCount, 2);
  assert.equal(item.stockValue, 78);
});

test("health and missing-plan states stay explicit", () => {
  assert.equal(stockHealth(0, 2), "Out of stock");
  assert.equal(stockHealth(1, 2), "Below MSL");
  assert.equal(stockHealth(2, 2), "At MSL");
  assert.equal(stockHealth(3, 2), "Sufficient");
  assert.equal(forecastLedger(rows.slice(2), "components").status, "Plan missing");
});
