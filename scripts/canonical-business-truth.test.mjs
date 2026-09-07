import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pendingMigrations } from "./migration-plan.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");
const releasedGroupsetMappingId = "MAP-CORE-TIAGRA-GROUPSET-TEST";

async function createCanonicalDb() {
  const db = new PGlite();
  await db.waitReady;
  const files = await readdir(migrationsDir);
  for (const migration of pendingMigrations(files, [])) {
    await db.exec(await readFile(join(migrationsDir, migration.path), "utf8"));
  }
  return db;
}

async function saveSalesOrder(db, { id, units, month = 6, status = "confirmed" }) {
  return db.query(
    `select * from save_vyndi_sales_order(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14
    )`,
    [
      id,
      month,
      "aluminium",
      units,
      1.25,
      "direct",
      status,
      "core",
      "core-tiagra",
      "VINDY Longitude Tiagra",
      JSON.stringify({ groupset: "gs-tiagra-4700" }),
      "integration test",
      "test-user",
      "operations",
    ],
  );
}

async function createReleasedCard(db, { orderId, cardId, lineId, quantity }) {
  await db.query(
    `insert into epr_bom_inventory_mappings
      (id,venture,model_id,bom_revision,bom_line_key,sku,quantity,unit,status,
       approved_by,approved_at,created_by,configuration_category,configuration_option_id)
     values ($1,'aluminium','core-tiagra','BOM-TEST-1','option:groupset','TEST-SKU',2,'ea','active',
       'test-admin',now(),'test-admin','groupset','gs-tiagra-4700')
     on conflict (id) do nothing`,
    [releasedGroupsetMappingId],
  );
  await db.query(
    `insert into epr_production_job_cards
      (id,sales_order_id,product_id,product_label,units,bom_tier,due_month,status,production_owner,created_by,
       model_tier,variant_id,configuration,sales_order_revision,bom_revision,released_mapping_set,updated_by)
     values ($1,$2,'aluminium','VINDY Longitude Tiagra',$3,'core',6,'released','operations','test-user',
       'core','core-tiagra',$4::jsonb,1,'BOM-TEST-1',$5::jsonb,'test-user')`,
    [cardId, orderId, quantity / 2, JSON.stringify({ groupset: "gs-tiagra-4700" }), JSON.stringify([releasedGroupsetMappingId])],
  );
  await db.query(
    `insert into epr_production_job_card_lines
      (id,job_card_id,stage_no,stage_code,stage_name,line_type,item,quantity,unit,source_bom_line,issue_status,
       sku,category,available_quantity,shortage_quantity,bom_mapping_id,requirement_revision)
     values ($1,$2,1,'ST-01','Kitting','component','Tiagra groupset',$3,'ea','option:groupset','pending',
       'TEST-SKU','groupset',0,$3,$4,1)`,
    [lineId, cardId, quantity, releasedGroupsetMappingId],
  );
}

test("canonical order → reservation → ATP → FIFO/COGS and stale-order controls stay consistent", async (t) => {
  const db = await createCanonicalDb();
  t.after(() => db.close());

  await db.query(
    `select * from save_vyndi_master_inventory_entry(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::date,$14::date,$15::date,$16,$17,$18,$19
    )`,
    [
      "ITEM-TEST",
      "REC-TEST-1",
      "LED-REC-TEST-1",
      "components",
      "TEST-SKU",
      "Test controlled component",
      "groupset",
      "unit",
      1,
      1,
      5,
      10,
      "2026-01-01",
      null,
      null,
      "PO-TEST-1",
      "canonical integration receipt",
      "test-user",
      "operations",
    ],
  );

  const balance = await db.query(
    `select sku,unit,quantity_balance,inventory_value_inr from vyndi_inventory_balance where sku='TEST-SKU'`,
  );
  assert.equal(balance.rows.length, 1);
  assert.equal(balance.rows[0].unit, "ea", "legacy unit alias must normalize to ea");
  assert.equal(Number(balance.rows[0].quantity_balance), 5);
  assert.equal(Number(balance.rows[0].inventory_value_inr), 50);

  const firstOrder = await saveSalesOrder(db, { id: "SO-TEST-1", units: 2 });
  assert.equal(Number(firstOrder.rows[0].revision), 1);
  await createReleasedCard(db, { orderId: "SO-TEST-1", cardId: "CARD-TEST-1", lineId: "LINE-TEST-1", quantity: 4 });

  const reservation = await db.query(
    `select * from reserve_epr_inventory_for_job_line($1,$2,$3,$4,$5)`,
    ["RES-TEST-1", "CARD-TEST-1", "LINE-TEST-1", "test-user", "operations"],
  );
  assert.equal(Number(reservation.rows[0].required_quantity), 4);
  assert.equal(Number(reservation.rows[0].physical_quantity), 5);
  assert.equal(Number(reservation.rows[0].reserved_quantity), 4);
  assert.equal(Number(reservation.rows[0].shortage_quantity), 0);

  const atp = await db.query(
    `select physical_quantity,reserved_quantity,available_to_promise from vyndi_inventory_available_to_promise where sku='TEST-SKU' and unit='ea'`,
  );
  assert.equal(Number(atp.rows[0].physical_quantity), 5);
  assert.equal(Number(atp.rows[0].reserved_quantity), 4);
  assert.equal(Number(atp.rows[0].available_to_promise), 1);

  await assert.rejects(
    () => db.query(
      `select * from post_vyndi_inventory_issue($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10)`,
      ["ISS-FREE-FAIL", "LED-FREE-FAIL", "TEST-SKU", 2, "ea", "2026-02-01", "FREE-ISSUE", "must respect reservation", "test-user", "operations"],
    ),
    /Insufficient available-to-promise stock/,
  );

  const raisedTraveller = await db.query(
    `select * from raise_epr_traveller_for_job_card($1,$2,$3,$4,$5,$6,$7)`,
    ["TRV-TEST-1", "CARD-TEST-1", "SERIAL-TEST-1", "VEDM-TEST-1", "Test OEM", "test-user", "operations"],
  );
  assert.equal(raisedTraveller.rows[0].job_card_id, "CARD-TEST-1");
  assert.equal(raisedTraveller.rows[0].sales_order_id, "SO-TEST-1");
  assert.equal(raisedTraveller.rows[0].traveller_status, "draft");
  const linkedTraveller = await db.query(
    `select job_card_id,job_card_revision,model_name,bom_revision from epr_travellers where id='TRV-TEST-1'`,
  );
  assert.equal(linkedTraveller.rows[0].job_card_id, "CARD-TEST-1");
  assert.equal(Number(linkedTraveller.rows[0].job_card_revision), 1);
  assert.equal(linkedTraveller.rows[0].model_name, "Longitude");
  assert.equal(linkedTraveller.rows[0].bom_revision, "BOM-TEST-1");
  await db.query(`update epr_travellers set status='released' where id='TRV-TEST-1'`);

  const consumed = await db.query(
    `select * from consume_epr_inventory_reservation($1,$2,$3,$4,$5,$6)`,
    ["RES-TEST-1", "TRV-TEST-1", "MOV-CONSUME-1", "LED-CONSUME-1", "test-user", "operations"],
  );
  assert.equal(Number(consumed.rows[0].resulting_balance), 1);
  assert.equal(Number(consumed.rows[0].cogs_inr), 40);

  const postConsume = await db.query(
    `select b.quantity_balance,
            (select coalesce(sum(quantity_remaining),0) from epr_inventory_fifo_layers where sku='TEST-SKU' and vyndi_canonical_unit(unit)='ea') as fifo_remaining,
            (select status from epr_inventory_reservations where id='RES-TEST-1') as reservation_status,
            (select coalesce(sum(cogs_inr),0) from epr_cogs_entries where traveller_id='TRV-TEST-1') as cogs
       from vyndi_inventory_balance b where b.sku='TEST-SKU' and b.unit='ea'`,
  );
  assert.equal(Number(postConsume.rows[0].quantity_balance), 1);
  assert.equal(Number(postConsume.rows[0].fifo_remaining), 1);
  assert.equal(postConsume.rows[0].reservation_status, "consumed");
  assert.equal(Number(postConsume.rows[0].cogs), 40);

  await db.query(
    `select * from save_vyndi_master_inventory_entry(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::date,$14::date,$15::date,$16,$17,$18,$19
    )`,
    [
      "ITEM-IGNORED",
      "REC-TEST-2",
      "LED-REC-TEST-2",
      "components",
      "TEST-SKU",
      "Test controlled component",
      "groupset",
      "ea",
      1,
      1,
      5,
      12,
      "2026-03-01",
      null,
      null,
      "PO-TEST-2",
      "second FIFO layer",
      "test-user",
      "operations",
    ],
  );

  const secondOrder = await saveSalesOrder(db, { id: "SO-TEST-2", units: 1 });
  assert.equal(Number(secondOrder.rows[0].revision), 1);
  await createReleasedCard(db, { orderId: "SO-TEST-2", cardId: "CARD-TEST-2", lineId: "LINE-TEST-2", quantity: 2 });
  await db.query(
    `select * from reserve_epr_inventory_for_job_line($1,$2,$3,$4,$5)`,
    ["RES-TEST-2", "CARD-TEST-2", "LINE-TEST-2", "test-user", "operations"],
  );
  await assert.rejects(
    () => db.query(
      `select * from consume_epr_inventory_reservation($1,$2,$3,$4,$5,$6)`,
      ["RES-TEST-2", "TRV-TEST-1", "MOV-WRONG-TRAVELLER", "LED-WRONG-TRAVELLER", "test-user", "operations"],
    ),
    /is not linked to reservation job card/,
  );

  const partialOrder = await saveSalesOrder(db, { id: "SO-TEST-PARTIAL", units: 4 });
  assert.equal(Number(partialOrder.rows[0].revision), 1);
  await createReleasedCard(db, { orderId: "SO-TEST-PARTIAL", cardId: "CARD-TEST-PARTIAL", lineId: "LINE-TEST-PARTIAL", quantity: 8 });
  const partialReservation = await db.query(
    `select * from reserve_epr_inventory_for_job_line($1,$2,$3,$4,$5)`,
    ["RES-TEST-PARTIAL", "CARD-TEST-PARTIAL", "LINE-TEST-PARTIAL", "test-user", "operations"],
  );
  assert.equal(Number(partialReservation.rows[0].reserved_quantity), 4);
  assert.equal(Number(partialReservation.rows[0].shortage_quantity), 4);
  await assert.rejects(
    () => db.query(
      `select * from consume_epr_inventory_reservation($1,$2,$3,$4,$5,$6)`,
      ["RES-TEST-PARTIAL", "TRV-TEST-1", "MOV-PARTIAL-FAIL", "LED-PARTIAL-FAIL", "test-user", "operations"],
    ),
    /Partial reservation cannot be posted as a complete material issue/,
  );

  const revised = await saveSalesOrder(db, { id: "SO-TEST-2", units: 2 });
  assert.equal(Number(revised.rows[0].revision), 2);

  const stale = await db.query(
    `select c.status as card_status,r.status as reservation_status
       from epr_production_job_cards c
       join epr_inventory_reservations r on r.job_card_id=c.id
      where c.id='CARD-TEST-2' and r.id='RES-TEST-2'`,
  );
  assert.equal(stale.rows[0].card_status, "hold", "sales revision must hold stale production projection");
  assert.equal(stale.rows[0].reservation_status, "released", "stale sales revision must release inventory commitment");

  const audit = await db.query(
    `select count(*)::int as count from vyndi_audit_events
      where entity_type in ('sales_order','production_job_card','production_traveller','inventory_reservation','inventory_movement')`,
  );
  assert.ok(Number(audit.rows[0].count) >= 7, "canonical flow must leave an auditable event chain");
});

test("zero physical inventory preserves released production demand and exposes the full shortage", async (t) => {
  const db = await createCanonicalDb();
  t.after(() => db.close());

  const order = await saveSalesOrder(db, { id: "SO-ZERO-STOCK", units: 2 });
  assert.equal(Number(order.rows[0].revision), 1);
  await createReleasedCard(db, {
    orderId: "SO-ZERO-STOCK",
    cardId: "CARD-ZERO-STOCK",
    lineId: "LINE-ZERO-STOCK",
    quantity: 4,
  });

  const reservation = await db.query(
    `select * from reserve_epr_inventory_for_job_line($1,$2,$3,$4,$5)`,
    ["RES-ZERO-STOCK", "CARD-ZERO-STOCK", "LINE-ZERO-STOCK", "test-user", "operations"],
  );
  assert.equal(Number(reservation.rows[0].required_quantity), 4);
  assert.equal(Number(reservation.rows[0].physical_quantity), 0);
  assert.equal(Number(reservation.rows[0].reserved_quantity), 0);
  assert.equal(Number(reservation.rows[0].shortage_quantity), 4);
  assert.equal(reservation.rows[0].reservation_id, null, "zero stock must not create a fake reservation");

  const state = await db.query(
    `select c.status as card_status,l.issue_status,l.available_quantity,l.shortage_quantity,
            v.physical_quantity,v.reserved_quantity,v.available_to_promise,v.shortage_quantity as live_shortage
       from epr_production_job_cards c
       join epr_production_job_card_lines l on l.job_card_id=c.id and l.id='LINE-ZERO-STOCK'
       join vyndi_live_job_card_requirements v on v.job_card_line_id=l.id
      where c.id='CARD-ZERO-STOCK'`,
  );
  assert.equal(state.rows.length, 1, "zero stock must not suppress the job card or its requirement");
  assert.equal(state.rows[0].card_status, "released");
  assert.equal(state.rows[0].issue_status, "short");
  assert.equal(Number(state.rows[0].available_quantity), 0);
  assert.equal(Number(state.rows[0].physical_quantity), 0);
  assert.equal(Number(state.rows[0].reserved_quantity), 0);
  assert.equal(Number(state.rows[0].available_to_promise), 0);
  assert.equal(Number(state.rows[0].shortage_quantity), 4);
  assert.equal(Number(state.rows[0].live_shortage), 4);

  const fakeStock = await db.query(
    `select count(*)::int as count from epr_inventory_ledger where sku='TEST-SKU'`,
  );
  assert.equal(Number(fakeStock.rows[0].count), 0, "production demand must never seed physical stock");
});
