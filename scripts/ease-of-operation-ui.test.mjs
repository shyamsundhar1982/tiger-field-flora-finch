import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/routes/command/inventory.tsx", import.meta.url), "utf8");

test("Master Inventory stock health uses a full-view responsive register", () => {
  assert.ok(source.includes('data-full-view-table="master-inventory-stock-health"'));
  assert.ok(!source.includes("overflow-x-auto"));
  assert.ok(!source.includes("min-w-[980px]"));
  assert.ok(source.includes("lg:grid"));
  assert.ok(source.includes("lg:hidden"));
});

test("full-view register preserves operating fields and audit access", () => {
  for (const label of ["Item", "Ledger", "Available", "MSL", "Health", "Plan / mo", "36-mo forecast", "Audit"]) {
    assert.ok(source.includes(label), `missing stock-health field: ${label}`);
  }
  assert.ok(source.includes("getMasterInventoryData"));
  assert.ok(source.includes("saveMasterInventoryEntry"));
  assert.ok(source.includes("/command/inventory-ledgers/$ledger"));
  assert.ok(source.includes("sku: item.sku"));
});
