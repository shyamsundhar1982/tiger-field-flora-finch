import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration = await fs.readFile(new URL("../migrations/003_phase6a_authoritative_core.sql", import.meta.url), "utf8");

async function db() {
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec(migration);
  return pg;
}

test("6A schema enforces venture-scoped durable orders and audit events", async () => {
  const pg = await db();
  await pg.query("insert into phase6a_user_roles (user_id,role,assigned_by) values ($1,$2,$1)", ["u1", "founder"]);
  await pg.query("with inserted as (insert into phase6a_sales_orders (id,venture_id,customer,product,units,value_inr,status,month,created_by) values ($1,'carbon','C1','VELOXIS',2,200000,'confirmed',1,'u1') returning *) insert into phase6a_audit_events (id,actor_user_id,actor_role,entity_type,entity_id,action,after_data) select $2,'u1','founder','sales_order',id,'create',to_jsonb(inserted) from inserted", ["SO-1", "AUD-1"]);
  const rows = await pg.query("select venture_id,units from phase6a_sales_orders where id='SO-1'");
  const audit = await pg.query("select actor_user_id,actor_role,entity_type,entity_id from phase6a_audit_events where id='AUD-1'");
  assert.deepEqual(rows.rows[0], { venture_id: "carbon", units: 2 });
  assert.deepEqual(audit.rows[0], { actor_user_id: "u1", actor_role: "founder", entity_type: "sales_order", entity_id: "SO-1" });
  await pg.close();
});

test("6A immutable inventory and audit tables reject updates and deletes", async () => {
  const pg = await db();
  await pg.query("insert into phase6a_inventory_movements (id,venture_id,type,sku,qty,unit_cost_inr,ref_type,ref_id,created_by) values ('IM-1','carbon','receipt','SKU-1',5,100,'po','PO-1','u1')");
  await assert.rejects(() => pg.query("update phase6a_inventory_movements set qty=6 where id='IM-1'"), /append-only/);
  await assert.rejects(() => pg.query("delete from phase6a_inventory_movements where id='IM-1'"), /append-only/);
  await pg.query("insert into phase6a_audit_events (id,actor_user_id,actor_role,entity_type,entity_id,action) values ('A-1','u1','founder','x','1','create')");
  await assert.rejects(() => pg.query("delete from phase6a_audit_events where id='A-1'"), /append-only/);
  await pg.close();
});

test("6A constraints prevent invalid ventures and zero movement quantities", async () => {
  const pg = await db();
  await assert.rejects(() => pg.query("insert into phase6a_sales_orders (id,venture_id,customer,product,units,value_inr,status,month,created_by) values ('SO-X','other','C','P',1,1,'confirmed',1,'u1')"), /check constraint/);
  await assert.rejects(() => pg.query("insert into phase6a_inventory_movements (id,venture_id,type,sku,qty,unit_cost_inr,ref_type,ref_id,created_by) values ('IM-X','carbon','receipt','S',0,1,'x','1','u1')"), /check constraint/);
  await pg.close();
});

test("6A production order cannot reference a different venture", async () => {
  const pg = await db();
  await pg.query("insert into phase6a_sales_orders (id,venture_id,customer,product,units,value_inr,status,month,created_by) values ('SO-C','carbon','C','P',1,1,'confirmed',1,'u1')");
  await assert.rejects(() => pg.query("insert into phase6a_production_orders (id,venture_id,sales_order_id,product,units,status,created_by) values ('MO-A','aluminium','SO-C','P',1,'planned','u1')"), /foreign key/);
  await pg.close();
});
