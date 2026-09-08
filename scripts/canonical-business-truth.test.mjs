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
    [id,month,"aluminium",units,1.25,"direct",status,"core","core-tiagra","VINDY Longitude Tiagra",JSON.stringify({ groupset: "gs-tiagra-4700" }),"integration test","test-user","operations"],
  );
}

async function createReleasedCard(db, { orderId, cardId, lineId, quantity }) {
  await db.query(
    `insert into epr_bom_inventory_mappings
      (id,venture,model_id,bom_revision,bom_line_key,sku,quantity,unit,status,approved_by,approved_at,created_by,configuration_category,configuration_option_id)
     values ($1,'aluminium','core-tiagra','BOM-TEST-1','option:groupset','TEST-SKU',2,'ea','active','test-admin',now(),'test-admin','groupset','gs-tiagra-4700')
     on conflict (id) do nothing`,[releasedGroupsetMappingId],
  );
  await db.query(
    `insert into epr_production_job_cards
      (id,sales_order_id,product_id,product_label,units,bom_tier,due_month,status,production_owner,created_by,model_tier,variant_id,configuration,sales_order_revision,bom_revision,released_mapping_set,updated_by)
     values ($1,$2,'aluminium','VINDY Longitude Tiagra',$3,'core',6,'released','operations','test-user','core','core-tiagra',$4::jsonb,1,'BOM-TEST-1',$5::jsonb,'test-user')`,
    [cardId,orderId,quantity/2,JSON.stringify({ groupset:"gs-tiagra-4700" }),JSON.stringify([releasedGroupsetMappingId])],
  );
  await db.query(
    `insert into epr_production_job_card_lines
      (id,job_card_id,stage_no,stage_code,stage_name,line_type,item,quantity,unit,source_bom_line,issue_status,sku,category,available_quantity,shortage_quantity,bom_mapping_id,requirement_revision)
     values ($1,$2,1,'ST-01','Kitting','component','Tiagra groupset',$3,'ea','option:groupset','pending','TEST-SKU','groupset',0,$3,$4,1)`,
    [lineId,cardId,quantity,releasedGroupsetMappingId],
  );
}

test("canonical order → reservation → ATP → FIFO/COGS and stale-order controls stay consistent", async (t) => {
  const db = await createCanonicalDb(); t.after(()=>db.close());
  await db.query(`select * from save_vyndi_master_inventory_entry($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::date,$14::date,$15::date,$16,$17,$18,$19)`,[
    "ITEM-TEST","REC-TEST-1","LED-REC-TEST-1","components","TEST-SKU","Test controlled component","groupset","unit",1,1,5,10,"2026-01-01",null,null,"PO-TEST-1","canonical integration receipt","test-user","operations",
  ]);
  const balance=await db.query(`select sku,unit,quantity_balance,inventory_value_inr from vyndi_inventory_balance where sku='TEST-SKU'`);
  assert.equal(balance.rows.length,1); assert.equal(balance.rows[0].unit,"ea"); assert.equal(Number(balance.rows[0].quantity_balance),5); assert.equal(Number(balance.rows[0].inventory_value_inr),50);
  const firstOrder=await saveSalesOrder(db,{id:"SO-TEST-1",units:2}); assert.equal(Number(firstOrder.rows[0].revision),1);
  await createReleasedCard(db,{orderId:"SO-TEST-1",cardId:"CARD-TEST-1",lineId:"LINE-TEST-1",quantity:4});
  const reservation=await db.query(`select * from reserve_epr_inventory_for_job_line($1,$2,$3,$4,$5)`,["RES-TEST-1","CARD-TEST-1","LINE-TEST-1","test-user","operations"]);
  assert.equal(Number(reservation.rows[0].required_quantity),4); assert.equal(Number(reservation.rows[0].physical_quantity),5); assert.equal(Number(reservation.rows[0].reserved_quantity),4); assert.equal(Number(reservation.rows[0].shortage_quantity),0);
  const atp=await db.query(`select physical_quantity,reserved_quantity,available_to_promise from vyndi_inventory_available_to_promise where sku='TEST-SKU' and unit='ea'`);
  assert.equal(Number(atp.rows[0].physical_quantity),5); assert.equal(Number(atp.rows[0].reserved_quantity),4); assert.equal(Number(atp.rows[0].available_to_promise),1);
  await assert.rejects(()=>db.query(`select * from post_vyndi_inventory_issue($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10)`,["ISS-FREE-FAIL","LED-FREE-FAIL","TEST-SKU",2,"ea","2026-02-01","FREE-ISSUE","must respect reservation","test-user","operations"]),/Insufficient available-to-promise stock/);
  const raisedTraveller=await db.query(`select * from raise_epr_traveller_for_job_card($1,$2,$3,$4,$5,$6,$7)`,["TRV-TEST-1","CARD-TEST-1","SERIAL-TEST-1","VEDM-TEST-1","Test OEM","test-user","operations"]);
  assert.equal(raisedTraveller.rows[0].job_card_id,"CARD-TEST-1"); assert.equal(raisedTraveller.rows[0].sales_order_id,"SO-TEST-1"); assert.equal(raisedTraveller.rows[0].traveller_status,"draft");
  await db.query(`update epr_travellers set status='released' where id='TRV-TEST-1'`);
  const consumed=await db.query(`select * from consume_epr_inventory_reservation($1,$2,$3,$4,$5,$6)`,["RES-TEST-1","TRV-TEST-1","MOV-CONSUME-1","LED-CONSUME-1","test-user","operations"]);
  assert.equal(Number(consumed.rows[0].resulting_balance),1); assert.equal(Number(consumed.rows[0].cogs_inr),40);
  await db.query(`select * from save_vyndi_master_inventory_entry($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::date,$14::date,$15::date,$16,$17,$18,$19)`,[
    "ITEM-IGNORED","REC-TEST-2","LED-REC-TEST-2","components","TEST-SKU","Test controlled component","groupset","ea",1,1,5,12,"2026-03-01",null,null,"PO-TEST-2","second FIFO layer","test-user","operations",
  ]);
  const secondOrder=await saveSalesOrder(db,{id:"SO-TEST-2",units:1}); assert.equal(Number(secondOrder.rows[0].revision),1);
  await createReleasedCard(db,{orderId:"SO-TEST-2",cardId:"CARD-TEST-2",lineId:"LINE-TEST-2",quantity:2});
  await db.query(`select * from reserve_epr_inventory_for_job_line($1,$2,$3,$4,$5)`,["RES-TEST-2","CARD-TEST-2","LINE-TEST-2","test-user","operations"]);
  await assert.rejects(()=>db.query(`select * from consume_epr_inventory_reservation($1,$2,$3,$4,$5,$6)`,["RES-TEST-2","TRV-TEST-1","MOV-WRONG-TRAVELLER","LED-WRONG-TRAVELLER","test-user","operations"]),/is not linked to reservation job card/);
  const partialOrder=await saveSalesOrder(db,{id:"SO-TEST-PARTIAL",units:4}); assert.equal(Number(partialOrder.rows[0].revision),1);
  await createReleasedCard(db,{orderId:"SO-TEST-PARTIAL",cardId:"CARD-TEST-PARTIAL",lineId:"LINE-TEST-PARTIAL",quantity:8});
  const partialReservation=await db.query(`select * from reserve_epr_inventory_for_job_line($1,$2,$3,$4,$5)`,["RES-TEST-PARTIAL","CARD-TEST-PARTIAL","LINE-TEST-PARTIAL","test-user","operations"]);
  assert.equal(Number(partialReservation.rows[0].reserved_quantity),4); assert.equal(Number(partialReservation.rows[0].shortage_quantity),4);
  await assert.rejects(()=>db.query(`select * from consume_epr_inventory_reservation($1,$2,$3,$4,$5,$6)`,["RES-TEST-PARTIAL","TRV-TEST-1","MOV-PARTIAL-FAIL","LED-PARTIAL-FAIL","test-user","operations"]),/Partial reservation cannot be posted as a complete material issue/);
  const revised=await saveSalesOrder(db,{id:"SO-TEST-2",units:2}); assert.equal(Number(revised.rows[0].revision),2);
  const stale=await db.query(`select c.status as card_status,r.status as reservation_status from epr_production_job_cards c join epr_inventory_reservations r on r.job_card_id=c.id where c.id='CARD-TEST-2' and r.id='RES-TEST-2'`);
  assert.equal(stale.rows[0].card_status,"hold"); assert.equal(stale.rows[0].reservation_status,"released");
  const audit=await db.query(`select count(*)::int as count from vyndi_audit_events where entity_type in ('sales_order','production_job_card','production_traveller','inventory_reservation','inventory_movement')`);
  assert.ok(Number(audit.rows[0].count)>=7);
});

test("zero physical inventory preserves released production demand and exposes the full shortage", async (t) => {
  const db=await createCanonicalDb(); t.after(()=>db.close());
  const order=await saveSalesOrder(db,{id:"SO-ZERO-STOCK",units:2}); assert.equal(Number(order.rows[0].revision),1);
  await createReleasedCard(db,{orderId:"SO-ZERO-STOCK",cardId:"CARD-ZERO-STOCK",lineId:"LINE-ZERO-STOCK",quantity:4});
  const reservation=await db.query(`select * from reserve_epr_inventory_for_job_line($1,$2,$3,$4,$5)`,["RES-ZERO-STOCK","CARD-ZERO-STOCK","LINE-ZERO-STOCK","test-user","operations"]);
  assert.equal(Number(reservation.rows[0].required_quantity),4); assert.equal(Number(reservation.rows[0].physical_quantity),0); assert.equal(Number(reservation.rows[0].reserved_quantity),0); assert.equal(Number(reservation.rows[0].shortage_quantity),4); assert.equal(reservation.rows[0].reservation_id,null);
  const state=await db.query(`select c.status as card_status,l.issue_status,l.available_quantity,l.shortage_quantity,v.physical_quantity,v.reserved_quantity,v.available_to_promise,v.shortage_quantity as live_shortage from epr_production_job_cards c join epr_production_job_card_lines l on l.job_card_id=c.id and l.id='LINE-ZERO-STOCK' join vyndi_live_job_card_requirements v on v.job_card_line_id=l.id where c.id='CARD-ZERO-STOCK'`);
  assert.equal(state.rows.length,1); assert.equal(state.rows[0].card_status,"released"); assert.equal(state.rows[0].issue_status,"short"); assert.equal(Number(state.rows[0].available_quantity),0); assert.equal(Number(state.rows[0].physical_quantity),0); assert.equal(Number(state.rows[0].reserved_quantity),0); assert.equal(Number(state.rows[0].available_to_promise),0); assert.equal(Number(state.rows[0].shortage_quantity),4); assert.equal(Number(state.rows[0].live_shortage),4);
  const fakeStock=await db.query(`select count(*)::int as count from epr_inventory_ledger where sku='TEST-SKU'`); assert.equal(Number(fakeStock.rows[0].count),0);
});

test("Stage 2 order → shipment → invoice → receivable → collection gate is controlled, idempotent and reversible", async (t) => {
  const db=await createCanonicalDb(); t.after(()=>db.close());
  await saveSalesOrder(db,{id:"SO-STAGE2",units:2,month:6,status:"confirmed"});
  await createReleasedCard(db,{orderId:"SO-STAGE2",cardId:"CARD-STAGE2",lineId:"LINE-STAGE2",quantity:4});

  await assert.rejects(
    ()=>db.query(`select post_vyndi_shipment($1,$2,$3,$4,$5,$6,$7)`,["SHIP-STAGE2","SO-STAGE2",6,2,"DISPATCH-001","test-user","operations"]),
    /requires the linked production job card to be complete/,
  );
  await db.query(`update epr_production_job_cards set status='complete' where id='CARD-STAGE2'`);

  const shipment=await db.query(`select post_vyndi_shipment($1,$2,$3,$4,$5,$6,$7) as id`,["SHIP-STAGE2","SO-STAGE2",6,2,"DISPATCH-001","test-user","operations"]);
  assert.equal(shipment.rows[0].id,"SHIP-STAGE2");
  const shipmentAgain=await db.query(`select post_vyndi_shipment($1,$2,$3,$4,$5,$6,$7) as id`,["SHIP-STAGE2","SO-STAGE2",6,2,"DISPATCH-001","test-user","operations"]);
  assert.equal(shipmentAgain.rows[0].id,"SHIP-STAGE2","same shipment command must be idempotent");
  await assert.rejects(()=>db.query(`select post_vyndi_shipment($1,$2,$3,$4,$5,$6,$7)`,["SHIP-OVER","SO-STAGE2",6,1,"DISPATCH-OVER","test-user","operations"]),/exceeds remaining confirmed order quantity/);

  const invoice=await db.query(`select * from issue_vyndi_invoice($1,$2,$3,$4,$5)`,["INV-STAGE2","SHIP-STAGE2","INVREF-001","test-user","finance"]);
  assert.equal(Number(invoice.rows[0].amount_lakh),2.5,"invoice amount must derive from shipped units × controlled order ASP");
  const invoiceAgain=await db.query(`select * from issue_vyndi_invoice($1,$2,$3,$4,$5)`,["INV-STAGE2","SHIP-STAGE2","INVREF-001","test-user","finance"]);
  assert.equal(Number(invoiceAgain.rows[0].amount_lakh),2.5,"same invoice command must be idempotent");

  const m6=await db.query(`select revenue,units,receivables from vyndi_monthly_transaction_actuals where plan_month=6`);
  assert.equal(Number(m6.rows[0].revenue),2.5); assert.equal(Number(m6.rows[0].units),2); assert.equal(Number(m6.rows[0].receivables),2.5);

  await db.query(`select post_vyndi_collection($1,$2,$3,$4,$5,$6,$7)`,["COL-STAGE2","INV-STAGE2",7,1,"BANK-001","test-user","finance"]);
  const collectionAgain=await db.query(`select post_vyndi_collection($1,$2,$3,$4,$5,$6,$7) as id`,["COL-STAGE2","INV-STAGE2",7,1,"BANK-001","test-user","finance"]);
  assert.equal(collectionAgain.rows[0].id,"COL-STAGE2","same collection command must be idempotent");
  const m7=await db.query(`select receivables from vyndi_monthly_transaction_actuals where plan_month=7`);
  assert.equal(Number(m7.rows[0].receivables),1.5);
  await assert.rejects(()=>db.query(`select post_vyndi_collection($1,$2,$3,$4,$5,$6,$7)`,["COL-OVER","INV-STAGE2",7,2,"BANK-OVER","test-user","finance"]),/exceeds open invoice receivable/);
  await assert.rejects(()=>db.query(`select void_vyndi_invoice($1,$2,$3,$4)`,["INV-STAGE2","wrong order","test-user","finance"]),/Reverse posted collections before voiding invoice/);

  await db.query(`select reverse_vyndi_collection($1,$2,$3,$4)`,["COL-STAGE2","bank reversal","test-user","finance"]);
  await db.query(`select void_vyndi_invoice($1,$2,$3,$4)`,["INV-STAGE2","credit and reissue","test-user","finance"]);
  const afterVoid=await db.query(`select revenue,units,receivables from vyndi_monthly_transaction_actuals where plan_month=6`);
  assert.equal(Number(afterVoid.rows[0].revenue),0); assert.equal(Number(afterVoid.rows[0].units),0); assert.equal(Number(afterVoid.rows[0].receivables),0);
  await db.query(`select reverse_vyndi_shipment($1,$2,$3,$4)`,["SHIP-STAGE2","dispatch cancelled","test-user","operations"]);

  const audit=await db.query(`select action from vyndi_audit_events where entity_id in ('SHIP-STAGE2','INV-STAGE2','COL-STAGE2') order by created_at`);
  assert.deepEqual(audit.rows.map((row)=>row.action).sort(),["issued","posted","posted","reversed","reversed","voided"].sort());
});

test("recommendation → PO approval → GRN/FIFO → three-way match → payment is controlled", async (t) => {
  const db=await createCanonicalDb(); t.after(()=>db.close());
  await db.query(`insert into master_inventory_items
    (id,ledger_id,sku,name,category,unit,minimum_stock_level,planned_monthly_use,created_by,updated_by)
    values ('ITEM-P2P','components','P2P-SKU','Controlled P2P item','test','ea',1,1,'test','test')`);
  await db.query(`select upsert_vyndi_supplier($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    ['SUP-P2P','Controlled Supplier','INR',30,30,'approved',95,94,'QUAL-P2P','approver','operations','AUD-SUP-P2P']);
  const supplierAudit=await db.query(`select action from vyndi_audit_events where id='AUD-SUP-P2P'`);
  assert.equal(supplierAudit.rows[0].action,'upserted');

  const po=await db.query(`select create_vyndi_purchase_order($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10::date,$11,$12,$13,$14,$15) as id`,
    ['PO-P2P','SUP-P2P','',4,'P2P-SKU','ea',10,100,'2026-01-01','2026-02-01',30,'QUOTE-P2P','test order','buyer-1','operations']);
  assert.equal(po.rows[0].id,'PO-P2P');
  await assert.rejects(()=>db.query(`select transition_vyndi_purchase_order($1,$2,$3,$4,$5)`,['PO-P2P','approved','APP-P2P','buyer-1','operations']),/different authorised user/);
  await db.query(`select transition_vyndi_purchase_order($1,$2,$3,$4,$5)`,['PO-P2P','approved','APP-P2P','approver-2','operations']);
  await db.query(`select transition_vyndi_purchase_order($1,$2,$3,$4,$5)`,['PO-P2P','issued','ISSUE-P2P','buyer-1','operations']);

  await db.query(`select post_vyndi_goods_receipt($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11)`,
    ['GRN-P2P-Q','PO-P2P','2026-01-31',2,0,0,'quarantine','DN-P2P-Q','awaiting disposition','receiver-1','operations']);
  const quarantined=await db.query(`select quantity_quarantined,inventory_movement_id from vyndi_goods_receipts where id='GRN-P2P-Q'`);
  assert.equal(Number(quarantined.rows[0].quantity_quarantined),2); assert.equal(quarantined.rows[0].inventory_movement_id,null);
  await db.query(`select resolve_vyndi_goods_receipt($1,$2,$3::date,$4,$5,$6)`,
    ['GRN-P2P-Q','rejected','2026-02-01','NCR-P2P-Q','qa-user','operations']);
  const disposition=await db.query(`select inspection_status,quantity_quarantined,quantity_rejected from vyndi_goods_receipts where id='GRN-P2P-Q'`);
  assert.equal(disposition.rows[0].inspection_status,'rejected'); assert.equal(Number(disposition.rows[0].quantity_quarantined),0); assert.equal(Number(disposition.rows[0].quantity_rejected),2);

  await db.query(`select post_vyndi_goods_receipt($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11)`,
    ['GRN-P2P','PO-P2P','2026-02-01',5,5,0,'accepted','DN-P2P','accepted batch','receiver-1','operations']);
  const stock=await db.query(`select physical_quantity,available_to_promise from vyndi_inventory_available_to_promise where sku='P2P-SKU' and unit='ea'`);
  assert.equal(Number(stock.rows[0].physical_quantity),5); assert.equal(Number(stock.rows[0].available_to_promise),5);
  const openPo=await db.query(`select open_po_quantity from vyndi_open_purchase_orders where sku='P2P-SKU' and unit='ea'`);
  assert.equal(Number(openPo.rows[0].open_po_quantity),5);

  const invoice=await db.query(`select * from post_vyndi_supplier_invoice($1,$2,$3,$4::date,$5,$6,$7,$8,$9,$10)`,
    ['AP-P2P','PO-P2P','SUPINV-P2P','2026-02-02',5,500,90,'INVFILE-P2P','ap-user-1','finance']);
  assert.equal(invoice.rows[0].match_status,'matched');
  await assert.rejects(()=>db.query(`select approve_vyndi_supplier_invoice($1,$2,$3)`,['AP-P2P','ap-user-1','finance']),/different authorised user/);
  await db.query(`select approve_vyndi_supplier_invoice($1,$2,$3)`,['AP-P2P','ap-approver-2','finance']);
  await db.query(`select post_vyndi_supplier_payment($1,$2,$3::date,$4,$5,$6,$7)`,['PAY-P2P','AP-P2P','2026-03-04',590,'BANK-P2P','ap-user-1','finance']);
  const payable=await db.query(`select status,amount_open_inr from vyndi_accounts_payable where id='AP-P2P'`);
  assert.equal(payable.rows[0].status,'paid'); assert.equal(Number(payable.rows[0].amount_open_inr),0);

  await db.query(`select post_vyndi_goods_receipt($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11)`,
    ['GRN-P2P-MIXED','PO-P2P','2026-02-03',6,5,1,'accepted','DN-P2P-MIXED','replacement plus rejection','receiver-1','operations']);
  const completedPo=await db.query(`select status,quantity_accepted,quantity_received from vyndi_purchase_order_status where id='PO-P2P'`);
  assert.equal(completedPo.rows[0].status,'received'); assert.equal(Number(completedPo.rows[0].quantity_accepted),10); assert.equal(Number(completedPo.rows[0].quantity_received),13);

  const blocked=await db.query(`select * from post_vyndi_supplier_invoice($1,$2,$3,$4::date,$5,$6,$7,$8,$9,$10)`,
    ['AP-P2P-BLOCK','PO-P2P','SUPINV-P2P-BLOCK','2026-02-02',6,600,108,'INVFILE-P2P-BLOCK','ap-user-1','finance']);
  assert.equal(blocked.rows[0].match_status,'blocked');
  await assert.rejects(()=>db.query(`select approve_vyndi_supplier_invoice($1,$2,$3)`,['AP-P2P-BLOCK','ap-approver-2','finance']),/three-way-matched/);
});
