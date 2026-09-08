import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pendingMigrations } from "./migration-plan.mjs";
import { runIntegratedBusinessPlanningEngine } from "../src/lib/integrated-business-planning-engine.ts";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");
const workbookSha256 = "2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7";

async function db() {
  const pg = new PGlite();
  await pg.waitReady;
  const files = await readdir(migrationsDir);
  for (const migration of pendingMigrations(files, [])) {
    await pg.exec(await readFile(join(migrationsDir, migration.path), "utf8"));
  }
  return pg;
}

test("workbook v5 planning authorities reproduce the controlled supply/capacity seed", async (t) => {
  const pg = await db();
  t.after(() => pg.close());

  const supply = await pg.query(`
    select count(*)::int as count,
           count(*) filter (where source_sha256=$1)::int as hashed,
           min(moq)::numeric as min_moq,
           min(order_multiple)::numeric as min_multiple
      from vyndi_supply_planning_parameters
     where planning_status <> 'retired'`, [workbookSha256]);
  assert.equal(Number(supply.rows[0].count), 72);
  assert.equal(Number(supply.rows[0].hashed), 72);
  assert.equal(Number(supply.rows[0].min_moq), 1);
  assert.equal(Number(supply.rows[0].min_multiple), 1);

  const raw = await pg.query(`
    select sku,lead_time_months,payment_lag_months
      from vyndi_supply_planning_parameters
     where sku in ('FRAMESET-AL-OEM','RM-T700-PREPREG','RM-T800-PREPREG','RM-RESIN-BOND','RM-PAINT-CLEAR','PKG-KIT')
     order by sku`);
  assert.equal(raw.rows.length, 6);
  assert.equal(Number(raw.rows.find((r) => r.sku === 'FRAMESET-AL-OEM').lead_time_months), 2);
  for (const row of raw.rows.filter((r) => r.sku !== 'FRAMESET-AL-OEM')) {
    assert.equal(Number(row.lead_time_months), 1);
    assert.equal(Number(row.payment_lag_months), 1);
  }

  const capacity = await pg.query(`
    select count(*)::int as count,
           count(*) filter (where source_sha256=$1)::int as hashed,
           min(sequence)::int as first_sequence,
           max(sequence)::int as last_sequence
      from vyndi_capacity_standards
     where planning_status <> 'retired'`, [workbookSha256]);
  assert.equal(Number(capacity.rows[0].count), 8);
  assert.equal(Number(capacity.rows[0].hashed), 8);
  assert.equal(Number(capacity.rows[0].first_sequence), 10);
  assert.equal(Number(capacity.rows[0].last_sequence), 80);
});

test("IBPE consumes lead time, MOQ/order multiple and explicit capacity without creating transactions", () => {
  const input = {
    demand: [{
      id: "M4-aluminium",
      productId: "aluminium",
      period: 4,
      planQty: 5,
      forecastQty: 5,
      committedQty: 0,
      actualQty: 0,
      confidence: 0.8,
      sourceRef: "WORKBOOK-V5-PARITY-TEST",
    }],
    bom: [{
      id: "BOM-PARITY-1",
      productId: "aluminium",
      revisionId: "BOM-PARITY",
      approved: true,
      sku: "SKU-PARITY",
      quantityPerUnit: 1,
      sourceRef: "BOM-PARITY",
    }],
    inventory: [{
      sku: "SKU-PARITY",
      onHandQty: 0,
      reservedQty: 0,
      safetyStockQty: 0,
      mslQty: 0,
      unitCostLakh: 0.01,
      leadTimeMonths: 2,
      moq: 3,
      orderMultiple: 2,
      sourceRef: "WORKBOOK-V5",
    }],
    reservations: [],
    receipts: [],
    capacity: [{
      id: "WC-030-M4",
      period: 4,
      capacityUnits: 4,
      sourceRef: "WORKBOOK-V5:WC-030",
    }],
    cashFlows: [],
    funding: {
      openingBankCashLakh: 10,
      minimumOperatingReserveLakh: 0,
      restrictedCashLakh: 0,
      fundraisingLeadMonths: 3,
    },
  };

  const result = runIntegratedBusinessPlanningEngine(input, { horizonMonths: 36 });
  const buy = result.supply.find((row) => row.sku === "SKU-PARITY" && row.period === 4);
  assert.ok(buy);
  assert.equal(buy.grossRequirementQty, 5);
  assert.equal(buy.recommendedPurchaseQty, 6, "5 units rounds to the 2-unit order multiple and remains above MOQ 3");
  assert.equal(buy.orderByPeriod, 2, "M4 requirement with 2-month lead time must be ordered in M2");
  assert.equal(result.cash.find((row) => row.period === 2).incrementalProcurementLakh, 0.06);

  const capacity = result.capacity.find((row) => row.id === "WC-030-M4");
  assert.ok(capacity);
  assert.equal(capacity.requiredUnits, 5);
  assert.equal(capacity.availableCapacityUnits, 4);
  assert.equal(capacity.shortfallUnits, 1);
});
