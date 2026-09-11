import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pendingMigrations } from "./migration-plan.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");

async function canonicalDb() {
  const db = new PGlite();
  await db.waitReady;
  const files = await readdir(migrationsDir);
  for (const migration of pendingMigrations(files, [])) {
    await db.exec(await readFile(join(migrationsDir, migration.path), "utf8"));
  }
  return db;
}

test("FIFO-issued Production material stays fulfilled and leaves outstanding procurement", async (t) => {
  const db = await canonicalDb();
  t.after(() => db.close());

  await db.query(
    `select * from save_vyndi_master_inventory_entry(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::date,$14::date,$15::date,$16,$17,$18,$19
    )`,
    [
      "ITEM-ISSUE-SEMANTICS","REC-ISSUE-SEMANTICS","LED-ISSUE-SEMANTICS","components",
      "ISSUE-SKU-TEST","Issue semantics component","handlebar","ea",0,0,1,1500,
      "2026-09-11",null,null,"GRN-ISSUE-SEMANTICS","controlled test receipt","test-user","operations",
    ],
  );

  await db.query(
    `select * from save_vyndi_sales_order(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14
    )`,
    [
      "SO-ISSUE-SEMANTICS",6,"aluminium",1,1.25,"direct","confirmed","core","core-tiagra",
      "VYNDI Longitude Tiagra",JSON.stringify({ groupset: "gs-tiagra-4700" }),
      "issued material semantics test","test-user","operations",
    ],
  );

  await db.query(
    `insert into epr_bom_inventory_mappings
      (id,venture,model_id,bom_revision,bom_line_key,sku,quantity,unit,status,approved_by,approved_at,created_by,configuration_category,configuration_option_id)
     values
      ('MAP-ISSUE-SEMANTICS','aluminium','core-tiagra','BOM-ISSUE-SEMANTICS','option:groupset',
       'ISSUE-SKU-TEST',1,'ea','active','test-admin',now(),'test-admin','groupset','gs-tiagra-4700')`,
  );

  await db.query(
    `insert into epr_production_job_cards
      (id,sales_order_id,product_id,product_label,units,bom_tier,due_month,status,production_owner,created_by,
       model_tier,variant_id,configuration,sales_order_revision,bom_revision,released_mapping_set,updated_by)
     values
      ('CARD-ISSUE-SEMANTICS','SO-ISSUE-SEMANTICS','aluminium','VYNDI Longitude Tiagra',1,'core',6,'released',
       'operations','test-user','core','core-tiagra',$1::jsonb,1,'BOM-ISSUE-SEMANTICS',$2::jsonb,'test-user')`,
    [JSON.stringify({ groupset: "gs-tiagra-4700" }),JSON.stringify(["MAP-ISSUE-SEMANTICS"])],
  );

  await db.query(
    `insert into epr_production_job_card_lines
      (id,job_card_id,stage_no,stage_code,stage_name,line_type,item,quantity,unit,source_bom_line,issue_status,
       sku,category,available_quantity,shortage_quantity,bom_mapping_id,requirement_revision)
     values
      ('LINE-ISSUE-SEMANTICS','CARD-ISSUE-SEMANTICS',1,'ST-01','Kitting','component','Issue semantics component',
       1,'ea','option:groupset','pending','ISSUE-SKU-TEST','handlebar',0,1,'MAP-ISSUE-SEMANTICS',1)`,
  );

  const reservation = await db.query(
    `select * from reserve_epr_inventory_for_job_line($1,$2,$3,$4,$5)`,
    ["RES-ISSUE-SEMANTICS","CARD-ISSUE-SEMANTICS","LINE-ISSUE-SEMANTICS","test-user","operations"],
  );
  assert.equal(Number(reservation.rows[0].reserved_quantity),1);
  assert.equal(Number(reservation.rows[0].shortage_quantity),0);

  await db.query(
    `select * from raise_epr_traveller_for_job_card($1,$2,$3,$4,$5,$6,$7)`,
    ["TRV-ISSUE-SEMANTICS","CARD-ISSUE-SEMANTICS","SERIAL-ISSUE-SEMANTICS","VEDM-ISSUE-SEMANTICS","Test OEM","test-user","operations"],
  );
  await db.query(`update epr_travellers set status='released' where id='TRV-ISSUE-SEMANTICS'`);

  const issued = await db.query(
    `select * from consume_epr_inventory_reservation($1,$2,$3,$4,$5,$6)`,
    ["RES-ISSUE-SEMANTICS","TRV-ISSUE-SEMANTICS","MOV-ISSUE-SEMANTICS","LED-CONSUME-ISSUE-SEMANTICS","test-user","operations"],
  );
  assert.equal(Number(issued.rows[0].resulting_balance),0);
  assert.equal(Number(issued.rows[0].cogs_inr),1500);

  const live = await db.query(
    `select required_quantity,reserved_quantity,shortage_quantity,physical_quantity,available_to_promise,issue_status
       from vyndi_live_job_card_requirements
      where job_card_line_id='LINE-ISSUE-SEMANTICS'`,
  );
  assert.equal(live.rows.length,1);
  assert.equal(Number(live.rows[0].required_quantity),1);
  assert.equal(Number(live.rows[0].reserved_quantity),0);
  assert.equal(Number(live.rows[0].physical_quantity),0);
  assert.equal(Number(live.rows[0].available_to_promise),0);
  assert.equal(Number(live.rows[0].shortage_quantity),0, "issued material must not become a shortage again");
  assert.equal(live.rows[0].issue_status,"issued");

  const baseLine = await db.query(
    `select shortage_quantity,issue_status from epr_production_job_card_lines where id='LINE-ISSUE-SEMANTICS'`,
  );
  assert.equal(Number(baseLine.rows[0].shortage_quantity),0);
  assert.equal(baseLine.rows[0].issue_status,"issued");

  const committed = await db.query(
    `select count(*)::int as count
       from vyndi_committed_procurement_requirements
      where sku='ISSUE-SKU-TEST' and requirement_month=6`,
  );
  assert.equal(Number(committed.rows[0].count),0, "fully issued material must leave outstanding committed procurement");
});
