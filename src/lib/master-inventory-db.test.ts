import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { forecastStock, stockHealth } from "./master-ledger.ts";

const migrationUrl = (name: string) => new URL(`../../migrations/${name}`, import.meta.url);

async function createInventoryDb() {
  const db = new PGlite();
  await db.waitReady;

  // 0021 imports the historical component catalogue after creating the Master
  // Inventory schema. Keep the fixture empty: these tests exercise only the
  // operational Master Inventory functions.
  await db.exec(`
    create table component_inventory (
      id text primary key,
      sku text not null,
      brand text not null,
      model text not null,
      category text not null,
      reorder_level numeric not null default 0,
      stock_qty numeric not null default 0,
      price_inr numeric not null default 0,
      notes text not null default ''
    );
  `);

  await db.exec(await readFile(migrationUrl("0021_master_inventory.sql"), "utf8"));
  await db.exec(await readFile(migrationUrl("0022_master_inventory_global_sku.sql"), "utf8"));
  return db;
}

type Entry = {
  itemId: string;
  lotId: string;
  ledgerId?: "components" | "raw-materials" | "tooling" | "quality" | "stores-tools";
  sku?: string;
  name?: string;
  category?: string;
  msl?: number;
  monthlyUse?: number;
  quantity?: number;
  unitCost?: number;
  receivedOn?: string;
  reference?: string;
};

async function saveEntry(db: PGlite, entry: Entry) {
  return db.query<{ item_id: string; lot_id: string | null }>(
    `select * from save_master_inventory_entry(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13::date,$14::date,$15,$16,$17
    )`,
    [
      entry.itemId,
      entry.lotId,
      entry.ledgerId ?? "components",
      entry.sku ?? "TEST-001",
      entry.name ?? "Test item",
      entry.category ?? "test",
      "ea",
      entry.msl ?? 4,
      entry.monthlyUse ?? 2,
      entry.quantity ?? 0,
      entry.unitCost ?? 0,
      entry.receivedOn ?? "2026-01-01",
      null,
      null,
      entry.reference ?? (entry.quantity ? "TEST-RECEIPT" : ""),
      "integration test",
      "test-operator",
    ],
  );
}

test("one SKU has one owner ledger while repeated receipts append FIFO lots", async (t) => {
  const db = await createInventoryDb();
  t.after(() => db.close());

  const first = await saveEntry(db, {
    itemId: "item-1",
    lotId: "lot-1",
    sku: "shared-001",
    quantity: 3,
    unitCost: 10,
    receivedOn: "2026-01-01",
  });
  assert.equal(first.rows[0]?.item_id, "item-1");
  assert.equal(first.rows[0]?.lot_id, "lot-1");

  const second = await saveEntry(db, {
    itemId: "ignored-new-id",
    lotId: "lot-2",
    sku: "SHARED-001",
    quantity: 4,
    unitCost: 12,
    receivedOn: "2026-02-01",
  });
  assert.equal(second.rows[0]?.item_id, "item-1");
  assert.equal(second.rows[0]?.lot_id, "lot-2");

  const items = await db.query<{ count: number }>(
    "select count(*)::int as count from master_inventory_items where sku = 'SHARED-001'",
  );
  const lots = await db.query<{ count: number; remaining: string }>(
    `select count(*)::int as count, sum(quantity_remaining)::text as remaining
     from master_inventory_lots where item_id = 'item-1'`,
  );
  assert.equal(items.rows[0]?.count, 1);
  assert.equal(lots.rows[0]?.count, 2);
  assert.equal(Number(lots.rows[0]?.remaining), 7);

  await assert.rejects(
    () =>
      saveEntry(db, {
        itemId: "item-wrong-ledger",
        lotId: "lot-wrong-ledger",
        ledgerId: "raw-materials",
        sku: "shared-001",
        name: "Should not duplicate",
      }),
    /SKU SHARED-001 already belongs to Components\. Open that item instead\./,
  );

  const afterReject = await db.query<{ count: number }>(
    "select count(*)::int as count from master_inventory_items where sku = 'SHARED-001'",
  );
  assert.equal(afterReject.rows[0]?.count, 1);
});

test("database FIFO consumes oldest lots, rejects shortages, and feeds MSL forecast state", async (t) => {
  const db = await createInventoryDb();
  t.after(() => db.close());

  await saveEntry(db, {
    itemId: "fifo-item",
    lotId: "fifo-old",
    sku: "FIFO-001",
    msl: 4,
    monthlyUse: 2,
    quantity: 3,
    unitCost: 10,
    receivedOn: "2026-01-01",
  });
  await saveEntry(db, {
    itemId: "fifo-item-new-id",
    lotId: "fifo-new",
    sku: "FIFO-001",
    msl: 4,
    monthlyUse: 2,
    quantity: 4,
    unitCost: 12,
    receivedOn: "2026-02-01",
  });

  const issued = await db.query<{
    issue_id: string;
    quantity_issued: string;
    issue_value_inr: string;
  }>(
    "select * from issue_master_inventory_fifo($1,$2,$3,$4::date,$5,$6,$7)",
    ["issue-1", "fifo-item", 4, "2026-03-01", "JOB-001", "build issue", "test-operator"],
  );
  assert.equal(issued.rows[0]?.issue_id, "issue-1");
  assert.equal(Number(issued.rows[0]?.quantity_issued), 4);
  assert.equal(Number(issued.rows[0]?.issue_value_inr), 42);

  const remaining = await db.query<{ id: string; quantity_remaining: string }>(
    `select id, quantity_remaining::text as quantity_remaining
     from master_inventory_lots where item_id = 'fifo-item' order by received_on, id`,
  );
  assert.deepEqual(
    remaining.rows.map((row) => [row.id, Number(row.quantity_remaining)]),
    [
      ["fifo-old", 0],
      ["fifo-new", 3],
    ],
  );

  const allocations = await db.query<{ lot_id: string; quantity: string }>(
    `select lot_id, quantity::text as quantity
     from master_inventory_fifo_allocations where issue_id = 'issue-1' order by lot_id`,
  );
  assert.deepEqual(
    allocations.rows.map((row) => [row.lot_id, Number(row.quantity)]),
    [
      ["fifo-new", 1],
      ["fifo-old", 3],
    ],
  );

  await assert.rejects(
    () =>
      db.query(
        "select * from issue_master_inventory_fifo($1,$2,$3,$4::date,$5,$6,$7)",
        ["issue-too-large", "fifo-item", 10, "2026-03-02", "JOB-002", "", "test-operator"],
      ),
    /Insufficient stock/,
  );

  const available = remaining.rows.reduce(
    (sum, row) => sum + Number(row.quantity_remaining),
    0,
  );
  assert.equal(available, 3);
  assert.equal(stockHealth(available, 4), "Below MSL");
  const forecast = forecastStock(available, 4, 2);
  assert.equal(forecast.firstReplenishmentMonth, 0);
  assert.equal(forecast.status, "Replenish");
});
