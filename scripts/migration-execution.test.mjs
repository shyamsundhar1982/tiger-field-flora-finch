import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pendingMigrations } from "./migration-plan.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");

async function collectSqlFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...(await collectSqlFiles(join(dir, entry.name), `${prefix}${entry.name}/`)));
    } else {
      files.push(`${prefix}${entry.name}`);
    }
  }
  return files;
}

test("every deploy-time migration executes from an empty database in production order", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.waitReady;
  await db.exec(
    "create table _migrations (name text primary key, applied_at timestamptz not null default now())",
  );

  const files = await collectSqlFiles(migrationsDir);
  const migrations = pendingMigrations(files, []);
  assert.ok(migrations.some(({ path }) => path === "0039_erp_suite_report_views.sql"));
  assert.ok(migrations.some(({ path }) => path === "auth/0001_auth.sql"));

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
});
