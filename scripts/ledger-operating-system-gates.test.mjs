import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("migrations/0061_full_day_to_day_catalogue.sql").replace(/\r\n/g, "\n");
const ledger = read("src/routes/command/inventory-ledgers/$ledger.tsx");
const peopleOffice = read("src/routes/command/people-office.tsx");
const inventory = read("src/lib/master-inventory.ts");
const lifecycle = read("src/components/governed-lifecycle.tsx");

test("Gate 0: canonical catalogue migration is idempotent and zero-balance", () => {
  assert.match(migration, /insert into master_inventory_items/);
  assert.match(migration, /on conflict \(ledger_id, sku\)/);
  assert.match(migration, /minimum_stock_level, planned_monthly_use/);
  assert.match(migration, /\n\s+0,\n\s+0,\n\s+true/);
  assert.match(inventory, /from master_inventory_items/);
});

test("Gate 1: ledger renders catalogue rows independently of receipt lots", () => {
  assert.match(ledger, /Item balance register/);
  assert.match(ledger, /items\.map/);
  assert.match(ledger, /balance\.toLocaleString/);
  assert.match(ledger, /including zero balance/);
  assert.match(peopleOffice, /Office Assets Register/);
});

test("Gate 2: operational surfaces use tables for registers", () => {
  assert.match(ledger, /<table/);
  assert.match(peopleOffice, /<table/);
  assert.match(read("src/routes/command/actuals.tsx"), /<table/);
  assert.match(read("src/routes/command/balance-sheet.tsx"), /<table/);
});

test("Gate 3: governed lifecycle component exists", () => {
  assert.match(lifecycle, /export function GovernedLifecycle/);
  assert.match(read("src/routes/command/decision-inbox.tsx"), /GovernedLifecycle/);
  assert.match(read("src/routes/command/receiving.tsx"), /GovernedLifecycle/);
});

test("Gate 4: production proof is intentionally explicit", () => {
  assert.match(read("docs/LEDGER-OPERATING-SYSTEM-GATES.md"), /requires live deployment evidence/);
});
