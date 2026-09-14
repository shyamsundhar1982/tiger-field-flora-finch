import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const inventorySource = fs.readFileSync(
  new URL("../src/routes/command/inventory.tsx", import.meta.url),
  "utf8",
);
const engineeringSource = fs.readFileSync(
  new URL("../src/routes/command/engineering.tsx", import.meta.url),
  "utf8",
);

test("Master Inventory stock health uses a full-view responsive register", () => {
  assert.ok(inventorySource.includes('data-full-view-table="master-inventory-stock-health"'));
  assert.ok(!inventorySource.includes("overflow-x-auto"));
  assert.ok(!inventorySource.includes("min-w-[980px]"));
  assert.ok(inventorySource.includes("lg:grid"));
  assert.ok(inventorySource.includes("lg:hidden"));
});

test("Master Inventory full-view register preserves operating fields and audit access", () => {
  for (const label of ["Item", "Ledger", "Available", "MSL", "Health", "Plan / mo", "36-mo forecast", "Audit"]) {
    assert.ok(inventorySource.includes(label), `missing stock-health field: ${label}`);
  }
  assert.ok(inventorySource.includes("getMasterInventoryData"));
  assert.ok(inventorySource.includes("saveMasterInventoryEntry"));
  assert.ok(inventorySource.includes("/command/inventory-ledgers/$ledger"));
  assert.ok(inventorySource.includes("sku: item.sku"));
});

test("Engineering canonical registers use full-view responsive layouts", () => {
  assert.ok(engineeringSource.includes('data-full-view-table="engineering-baseline-register"'));
  assert.ok(engineeringSource.includes('data-full-view-table="engineering-change-register"'));
  assert.ok(!engineeringSource.includes("overflow-x-auto"));
  assert.ok(!engineeringSource.includes("min-w-[1050px]"));
  assert.ok(!engineeringSource.includes("min-w-[900px]"));
  assert.ok(engineeringSource.includes("lg:grid"));
  assert.ok(engineeringSource.includes("lg:hidden"));
});

test("Engineering full-view registers preserve governed authority and lifecycle fields", () => {
  for (const label of [
    "Family / variant",
    "Revision",
    "Geometry / material",
    "Tooling",
    "Drawing / BOM",
    "Status",
    "ECR",
    "Target",
    "Reason",
  ]) {
    assert.ok(engineeringSource.includes(label), `missing engineering field: ${label}`);
  }
  assert.ok(engineeringSource.includes("listEngineeringAuthority"));
  assert.ok(engineeringSource.includes("vyndi_engineering_baselines"));
  assert.ok(engineeringSource.includes("vyndi_engineering_change_requests"));
});
