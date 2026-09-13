import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pendingMigrations } from "./migration-plan.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");

/**
 * Mirror the production migration applier exactly: `scripts/migrate.mjs` reads
 * only the root migrations directory and does not descend into template/helper
 * folders such as `migrations/auth/`. The auth template becomes deployable only
 * after it is copied to `migrations/0001_auth.sql`.
 */
async function collectDeploySqlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

test("every deploy-time migration executes from an empty database in production order", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.waitReady;
  await db.exec(
    "create table _migrations (name text primary key, applied_at timestamptz not null default now())",
  );

  const files = await collectDeploySqlFiles(migrationsDir);
  const migrations = pendingMigrations(files, []);
  assert.ok(migrations.some(({ path }) => path === "0039_erp_suite_report_views.sql"));
  assert.ok(migrations.some(({ path }) => path === "0001_auth.sql"));
  assert.ok(!migrations.some(({ path }) => path.startsWith("auth/")));

  for (const { name, path } of migrations) {
    const sql = await readFile(join(migrationsDir, path), "utf8");
    try {
      await db.transaction(async (tx) => {
        await tx.exec(sql);
        await tx.query("insert into _migrations (name) values ($1)", [name]);
      });
    } catch (error) {
      throw new Error(
        `Migration ${path} failed: ${error instanceof Error ? error.message : error}`,
        {
          cause: error,
        },
      );
    }
  }

  const applied = await db.query("select name from _migrations order by name");
  assert.equal(applied.rows.length, migrations.length);
  assert.deepEqual(
    pendingMigrations(
      files,
      applied.rows.map(({ name }) => name),
    ),
    [],
  );

  const reportViews = await db.query(
    "select table_name from information_schema.views where table_schema='public' and table_name like 'vyndi_report_%' order by table_name",
  );
  assert.equal(reportViews.rows.length, 14);

  const modelEvidenceColumn = await db.query(
    "select column_name from information_schema.columns where table_schema='public' and table_name='vyndi_advanced_planning_packets' and column_name='model_json'",
  );
  assert.equal(modelEvidenceColumn.rows.length, 1);

  const packetV2Function = await db.query(
    "select proname from pg_proc where proname='persist_vyndi_advanced_planning_packet_v2'",
  );
  assert.equal(packetV2Function.rows.length, 1);

  const packetGuardTrigger = await db.query(
    "select tgname from pg_trigger where tgname='trg_guard_vyndi_advanced_planning_packet' and not tgisinternal",
  );
  assert.equal(packetGuardTrigger.rows.length, 1);

  // VIBPE exact operational-control queries deliberately depend on governed
  // report views and canonical transaction ledgers. Keep a schema smoke gate
  // here so a renamed/dropped column cannot pass TypeScript and then fail only
  // when a founder asks the Co-Pilot an audit question at runtime.
  const operationalAuditSchemaQueries = [
    `select sales_order_id,order_revision,order_status,job_card_id,job_order_revision,job_status,sync_status
       from vyndi_report_order_book_sync limit 0`,
    `select job_card_id,sales_order_id,sales_order_revision,bom_revision,released_mapping_count,compliance
       from vyndi_report_bom_compliance limit 0`,
    `select job_card_id,sales_order_id,gate_status from vyndi_report_production_release_gate limit 0`,
    `select reservation_id,sku,quantity_reserved,physical_quantity,available_to_promise,job_card_id,sales_order_id,health
       from vyndi_report_reservation_health limit 0`,
    `select sku,physical_qty,committed_reserved_qty,atp_qty,open_po_qty
       from vyndi_report_procurement_net_requirement limit 0`,
    `select id,job_card_id,sku,status,quantity_open from vyndi_purchase_order_status limit 0`,
    `select id,job_card_id,sku,status,expected_receipt_on,supplier_id,unit_price_inr
       from vyndi_purchase_orders limit 0`,
    `select id,sku,quantity_delta,movement_id,created_at,reference
       from epr_inventory_ledger limit 0`,
    `select id,sku,movement_type,reference from epr_inventory_movements limit 0`,
    `select id,job_card_id,bom_mapping_id,sku,quantity,unit,line_type
       from epr_production_job_card_lines limit 0`,
    `select id,model_id,bom_revision,sku,quantity,unit,status,approved_at,effective_from,effective_to
       from epr_bom_inventory_mappings limit 0`,
    `select work_centre_id,available_hours_per_month,efficiency,standard_hours_per_unit,planning_status,source_ref
       from vyndi_capacity_standards limit 0`,
    `select id,product_id,revision_code,status,effective_from,effective_to
       from vyndi_routing_revisions limit 0`,
    `select id,sku,supplier_id,status,effective_from,effective_to,lead_time_days
       from vyndi_supplier_lane_revisions limit 0`,
  ];

  for (const statement of operationalAuditSchemaQueries) {
    await db.query(statement);
  }
  assert.equal(operationalAuditSchemaQueries.length, 14);
});