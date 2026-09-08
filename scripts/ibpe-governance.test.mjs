import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pendingMigrations } from "./migration-plan.mjs";
import { runRuntimeIbpe } from "../src/lib/ibpe-runtime-parity.ts";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");
async function db() {
  const pg = new PGlite(); await pg.waitReady;
  const files = await readdir(migrationsDir);
  for (const migration of pendingMigrations(files, [])) await pg.exec(await readFile(join(migrationsDir, migration.path), "utf8"));
  return pg;
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)]));
  return value;
}
function hash(value){return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");}

const input = {
  demand:[{id:"M1-aluminium",productId:"aluminium",period:1,planQty:3,forecastQty:3,committedQty:1,actualQty:0,confidence:0.8,sourceRef:"PLAN-TEST-R1"}],
  bom:[{id:"BOM-1",productId:"aluminium",revisionId:"BOM-R1",approved:true,sku:"SKU-1",quantityPerUnit:2,sourceRef:"BOM-R1"}],
  inventory:[{sku:"SKU-1",onHandQty:10,reservedQty:2,safetyStockQty:2,mslQty:2,unitCostLakh:0.01,leadTimeMonths:1,moq:1,orderMultiple:1,sourceRef:"ATP"}],
  reservations:[{id:"RES-1",sku:"SKU-1",period:1,quantity:2,status:"active",sourceRef:"RES"}],
  receipts:[],cashFlows:[{id:"CF-1",businessKey:"opex-M1",period:1,direction:"outflow",amountLakh:2,truth:"plan",category:"opex",sourceRef:"PLAN-TEST-R1"}],
  funding:{openingBankCashLakh:15,minimumOperatingReserveLakh:5,restrictedCashLakh:0,fundraisingLeadMonths:3},
  runtimeControls:{paymentLagBySku:{"SKU-1":1}},
};

test("Stage 2 IBPE is deterministic and governed run persistence is idempotent/advisory", async (t) => {
  const pg=await db(); t.after(()=>pg.close());
  const first=runRuntimeIbpe(input,{horizonMonths:36});
  const second=runRuntimeIbpe(input,{horizonMonths:36});
  assert.deepEqual(second,first,"same governed Stage 2 input must reproduce the same IBPE output");
  assert.equal(first.runtimeParity.paymentLagApplied,true);
  const inputHash=hash(input); assert.match(inputHash,/^[a-f0-9]{64}$/);

  await pg.query(`insert into vyndi_plan_revisions
    (id,revision,status,horizon_months,scenario,draw_standby,finance_json,accounting_json,change_reason,created_by,approved_by,approved_at)
    values ('PLAN-TEST',1,'approved',36,'base',true,'{}'::jsonb,'{}'::jsonb,'test','tester','approver',now())`);
  const salesBefore=await pg.query(`select count(*)::int as count from vyndi_sales_orders`);
  const args=["IBPE-TEST-1","VYNDI-IBPE-1.1.0","abcdef0123456789",inputHash,"PLAN-TEST",1,"base",new Date("2026-09-08T00:00:00Z").toISOString(),JSON.stringify(input),JSON.stringify(first),JSON.stringify({gate:"stage-2-test",paymentLagRuntimeParity:"applied-stage-2"}),"tester","operations"];
  const stored=await pg.query(`select persist_vyndi_ibpe_run($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13) as id`,args);
  assert.equal(stored.rows[0].id,"IBPE-TEST-1");
  const duplicate=await pg.query(`select persist_vyndi_ibpe_run($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13) as id`,[...args.slice(0,0),"IBPE-TEST-DUP",...args.slice(1)]);
  assert.equal(duplicate.rows[0].id,"IBPE-TEST-1","same engine/SHA/hash/plan revision must resolve to original run");
  const runRows=await pg.query(`select engine_version,input_hash,approved_plan_revision,status,input_json,validation_json from vyndi_ibpe_runs`);
  assert.equal(runRows.rows.length,1);
  assert.equal(runRows.rows[0].engine_version,"VYNDI-IBPE-1.1.0");
  assert.equal(runRows.rows[0].input_hash,inputHash);
  assert.equal(Number(runRows.rows[0].approved_plan_revision),1);
  assert.equal(runRows.rows[0].status,"complete");
  assert.equal(Number(runRows.rows[0].input_json.runtimeControls.paymentLagBySku["SKU-1"]),1,"payment-lag control must persist inside the hashed governed snapshot");
  assert.equal(runRows.rows[0].validation_json.paymentLagRuntimeParity,"applied-stage-2");
  const audit=await pg.query(`select count(*)::int as count from vyndi_audit_events where entity_type='ibpe_run' and entity_id='IBPE-TEST-1'`);
  assert.equal(Number(audit.rows[0].count),1);
  const salesAfter=await pg.query(`select count(*)::int as count from vyndi_sales_orders`);
  assert.equal(Number(salesAfter.rows[0].count),Number(salesBefore.rows[0].count),"persisting Stage 2 IBPE output must not write transaction truth");
});

test("IBPE persistence rejects a non-approved plan revision", async (t) => {
  const pg=await db(); t.after(()=>pg.close());
  await pg.query(`insert into vyndi_plan_revisions
    (id,revision,status,horizon_months,scenario,draw_standby,finance_json,accounting_json,change_reason,created_by)
    values ('PLAN-DRAFT',1,'draft',36,'base',true,'{}'::jsonb,'{}'::jsonb,'test','tester')`);
  await assert.rejects(() => pg.query(
    `select persist_vyndi_ibpe_run($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13)`,
    ["IBPE-DRAFT","VYNDI-IBPE-1.1.0","abcdef0123456789",hash(input),"PLAN-DRAFT",1,"base",new Date().toISOString(),JSON.stringify(input),JSON.stringify({}),JSON.stringify({paymentLagRuntimeParity:"applied-stage-2"}),"tester","operations"],
  ),/exact approved operating-plan revision/);
});
