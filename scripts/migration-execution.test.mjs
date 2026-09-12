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
});