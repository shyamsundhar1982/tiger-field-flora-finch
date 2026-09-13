import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pendingMigrations } from "./migration-plan.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");

async function database() {
  const db = new PGlite();
  await db.waitReady;
  const entries = await readdir(migrationsDir);
  for (const migration of pendingMigrations(entries, [])) {
    await db.exec(await readFile(join(migrationsDir, migration.path), "utf8"));
  }
  return db;
}

function saveOrder(db, id, units, actor = "stage-d-operator") {
  return db.query(
    `select * from save_vyndi_sales_order(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14
    )`,
    [
      id,
      6,
      "aluminium",
      units,
      1.25,
      "direct",
      "confirmed",
      "core",
      "core-tiagra",
      "VINDY Longitude Tiagra",
      JSON.stringify({ groupset: "gs-tiagra-4700" }),
      "Stage D burst acceptance",
      actor,
      "operations",
    ],
  );
}

test("Stage D burst writes preserve revisions, uniqueness and actor audit lineage", async (t) => {
  const db = await database();
  t.after(() => db.close());

  const orderCount = 120;
  const ids = Array.from({ length: orderCount }, (_, index) => `SO-STAGE-D-${String(index + 1).padStart(3, "0")}`);

  // Submit a request burst rather than a hand-paced loop. PGlite serializes the
  // physical writes internally, but this still exercises the application SQL
  // contracts under overlapping callers and catches uniqueness/revision races.
  const created = await Promise.all(ids.map((id, index) => saveOrder(db, id, (index % 4) + 1)));
  assert.equal(created.length, orderCount);
  for (const result of created) {
    assert.equal(Number(result.rows[0]?.revision), 1);
  }

  const revisedIds = ids.slice(0, 60);
  const revised = await Promise.all(revisedIds.map((id, index) => saveOrder(db, id, (index % 5) + 2)));
  for (const result of revised) {
    assert.equal(Number(result.rows[0]?.revision), 2);
  }

  const orders = await db.query(
    `select count(*)::int as rows, count(distinct id)::int as unique_ids
       from vyndi_sales_orders where id like 'SO-STAGE-D-%'`,
  );
  assert.equal(Number(orders.rows[0].rows), orderCount);
  assert.equal(Number(orders.rows[0].unique_ids), orderCount);

  const revisions = await db.query(
    `select count(*)::int as rows,
            count(*) filter (where revision=1)::int as r1,
            count(*) filter (where revision=2)::int as r2
       from vyndi_sales_order_revisions where sales_order_id like 'SO-STAGE-D-%'`,
  );
  assert.equal(Number(revisions.rows[0].rows), 180);
  assert.equal(Number(revisions.rows[0].r1), 120);
  assert.equal(Number(revisions.rows[0].r2), 60);

  const audit = await db.query(
    `select count(*)::int as events,
            count(*) filter (where actor_user_id='stage-d-operator')::int as attributed,
            count(*) filter (where created_at is not null)::int as timestamped
       from vyndi_audit_events
      where entity_type='sales_order' and entity_id like 'SO-STAGE-D-%'`,
  );
  assert.ok(Number(audit.rows[0].events) >= 180);
  assert.equal(Number(audit.rows[0].attributed), Number(audit.rows[0].events));
  assert.equal(Number(audit.rows[0].timestamped), Number(audit.rows[0].events));
});
