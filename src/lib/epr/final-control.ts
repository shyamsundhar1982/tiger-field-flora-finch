import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCommandRole } from "@/lib/command-access";
import { getSql } from "@/lib/db";

const venture = z.enum(["carbon", "aluminium"]);
const modelId = z.enum(["core", "pro", "apex"]);
const gateIds = ["EPR-04","EPR-05","EPR-06","EPR-07","EPR-08","EPR-09","EPR-10","EPR-11","EPR-12"] as const;
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

async function admin() {
  const role = await getCommandRole();
  if (!role) throw new Error("Command access is required.");
  if (role !== "admin") throw new Error("Admin Command access is required for EPR control mutations.");
  return role;
}

async function audit(sql: Awaited<ReturnType<typeof getSql>>, v: "carbon" | "aluminium", entityType: string, entityId: string, action: string, actor: string, payload: Record<string, unknown> = {}) {
  await sql.query(
    `insert into epr_audit_events (id,venture,entity_type,entity_id,action,actor,payload_json) values ($1,$2,$3,$4,$5,$6,$7)`,
    [makeId("AUD"), v, entityType, entityId, action, actor, JSON.stringify(payload)],
  );
}

export const listEprMappings = createServerFn({ method: "GET" }).handler(async () => {
  await admin();
  const sql = await getSql();
  return sql.query(`select * from epr_bom_inventory_mappings order by venture,model_id,bom_revision,bom_line_key,created_at desc limit 2000`);
});

export const createEprMapping = createServerFn({ method: "POST" }).validator(z.object({
  venture, modelId, bomRevision: z.string().min(1).max(120), bomLineKey: z.string().min(1).max(160), sku: z.string().min(1).max(120), quantity: z.number().positive(), unit: z.string().min(1).max(30), notes: z.string().max(2000).default(""),
})).handler(async ({ data }) => {
  const actor = await admin();
  const sql = await getSql();
  const master = await sql.query<{ id: string; status: string; code: string }[]>(
    `select id,status,code from master_data_records where domain='inventory' and code=$1 and status='approved' order by revision desc limit 1`,
    [data.sku],
  );
  if (!master[0]) throw new Error(`SKU ${data.sku} is not an approved Inventory Master record. Approve the SKU before mapping it to a BOM.`);
  const mappingId = makeId("MAP");
  await sql.query(`insert into epr_bom_inventory_mappings (id,venture,model_id,bom_revision,bom_line_key,sku,quantity,unit,status,notes,created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10)`, [mappingId,data.venture,data.modelId,data.bomRevision,data.bomLineKey,data.sku,data.quantity,data.unit,data.notes,actor]);
  await audit(sql,data.venture,"bom_inventory_mapping",mappingId,"draft_created",actor,{...data,inventoryMasterId:master[0].id});
  return { ok:true, mappingId };
});

export const approveEprMapping = createServerFn({ method: "POST" }).validator(z.object({ mappingId: z.string().min(1) })).handler(async ({ data }) => {
  const actor = await admin();
  const sql = await getSql();
  const rows = await sql.query<{id:string;venture:"carbon"|"aluminium";model_id:string;bom_revision:string;bom_line_key:string;sku:string;unit:string;status:string}>(`select id,venture,model_id,bom_revision,bom_line_key,sku,unit,status from epr_bom_inventory_mappings where id=$1`,[data.mappingId]);
  const m = rows[0];
  if (!m) throw new Error("BOM-SKU mapping not found.");
  if (m.status !== "draft") throw new Error(`Only draft mappings can be approved; current status is ${m.status}.`);
  const master = await sql.query<{id:string}[]>(`select id from master_data_records where domain='inventory' and code=$1 and status='approved' order by revision desc limit 1`,[m.sku]);
  if (!master[0]) throw new Error(`SKU ${m.sku} is no longer approved in Inventory Master.`);
  await sql.query(`update epr_bom_inventory_mappings set status='superseded',effective_to=now(),updated_at=now() where venture=$1 and model_id=$2 and bom_revision=$3 and bom_line_key=$4 and sku=$5 and status='active' and effective_to is null`,[m.venture,m.model_id,m.bom_revision,m.bom_line_key,m.sku]);
  await sql.query(`update epr_bom_inventory_mappings set status='active',approved_by=$1,approved_at=now(),effective_from=now(),effective_to=null,updated_at=now() where id=$2`,[actor,m.id]);
  await audit(sql,m.venture,"bom_inventory_mapping",m.id,"approved",actor,m);
  return { ok:true };
});

export const retireEprMapping = createServerFn({ method: "POST" }).validator(z.object({ mappingId: z.string().min(1), reason: z.string().min(1).max(1000) })).handler(async ({ data }) => {
  const actor = await admin();
  const sql = await getSql();
  const rows = await sql.query<{id:string;venture:"carbon"|"aluminium";status:string}>(`select id,venture,status from epr_bom_inventory_mappings where id=$1`,[data.mappingId]);
  const m=rows[0];
  if (!m) throw new Error("BOM-SKU mapping not found.");
  if (m.status !== "active") throw new Error("Only active mappings can be retired.");
  await sql.query(`update epr_bom_inventory_mappings set status='superseded',effective_to=now(),updated_at=now(),notes=case when notes='' then $1 else notes || E'\\n' || $1 end where id=$2`,[`Retired: ${data.reason}`,m.id]);
  await audit(sql,m.venture,"bom_inventory_mapping",m.id,"retired",actor,data);
  return { ok:true };
});

export const createInventoryOpeningBalance = createServerFn({ method: "POST" }).validator(z.object({
  venture, sku: z.string().min(1).max(120), unit: z.string().min(1).max(30), quantity: z.number().positive(), unitCostInr: z.number().nonnegative(), reference: z.string().min(1).max(300), notes: z.string().max(2000).default(""),
})).handler(async ({ data }) => {
  const actor=await admin(); const sql=await getSql(); const id=makeId("OPEN");
  const mapped=await sql.query(`select id from epr_bom_inventory_mappings where venture=$1 and sku=$2 and unit=$3 and status='active' and effective_from<=now() and (effective_to is null or effective_to>now()) limit 1`,[data.venture,data.sku,data.unit]);
  if(!mapped[0]) throw new Error("Opening balance requires an active BOM-SKU mapping for the same venture, SKU and unit.");
  await sql.query(`insert into epr_inventory_opening_balances (id,venture,sku,unit,quantity,unit_cost_inr,reference,notes,created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,data.venture,data.sku,data.unit,data.quantity,data.unitCostInr,data.reference,data.notes,actor]);
  await audit(sql,data.venture,"inventory_opening_balance",id,"draft_created",actor,data);
  return {ok:true,openingId:id};
});

export const approveInventoryOpeningBalance = createServerFn({ method: "POST" }).validator(z.object({ openingId:z.string().min(1) })).handler(async ({data})=>{
  const actor=await admin(); const sql=await getSql();
  const rows=await sql.query<{id:string;venture:"carbon"|"aluminium";sku:string;unit:string;status:string}>(`select id,venture,sku,unit,status from epr_inventory_opening_balances where id=$1`,[data.openingId]);
  const row=rows[0];
  if(!row) throw new Error("Opening balance not found.");
  if(row.status!=="draft") throw new Error("Only draft opening balances can be approved.");
  const mapped=await sql.query<{id:string}[]>(`select m.id from epr_bom_inventory_mappings m join master_data_records md on md.domain='inventory' and md.code=m.sku and md.status='approved' where m.venture=$1 and m.sku=$2 and m.unit=$3 and m.status='active' and m.effective_from<=now() and (m.effective_to is null or m.effective_to>now()) order by md.revision desc limit 1`,[row.venture,row.sku,row.unit]);
  if(!mapped[0]) throw new Error("Opening balance approval requires an active BOM-SKU mapping and an approved Inventory Master SKU.");
  await sql.query(`update epr_inventory_opening_balances set status='approved',approved_by=$1,approved_at=now() where id=$2`,[actor,row.id]);
  await audit(sql,row.venture,"inventory_opening_balance",row.id,"approved",actor,{mappingId:mapped[0].id,sku:row.sku,unit:row.unit});
  return {ok:true};
});

export const postInventoryOpeningBalance = createServerFn({ method: "POST" }).validator(z.object({ openingId:z.string().min(1) })).handler(async ({data})=>{
  const actor=await admin(); const sql=await getSql();
  const movementId=makeId("MOV"); const ledgerId=makeId("LED"); const costLedgerId=makeId("COST");
  const rows=await sql.query<{movement_id:string;ledger_id:string;resulting_balance:number|string}>(`select * from post_epr_inventory_opening_balance($1,$2,$3,$4,$5)`,[data.openingId,movementId,ledgerId,costLedgerId,actor]);
  if(!rows[0]) throw new Error("Opening balance was not posted.");
  return {ok:true,movementId:rows[0].movement_id,ledgerId:rows[0].ledger_id,resultingBalance:Number(rows[0].resulting_balance)};
});

export const getAuthoritativeInventoryControl = createServerFn({ method: "GET" }).handler(async ()=>{
  await admin(); const sql=await getSql();
  const [balances,openings,cogs]=await Promise.all([
    sql.query(`select venture,sku,unit,quantity_balance,inventory_value_inr,weighted_average_cost_inr from epr_authoritative_inventory_balance order by venture,sku,unit`),
    sql.query(`select * from epr_inventory_opening_balances order by created_at desc limit 500`),
    sql.query(`select * from epr_cogs_entries order by created_at desc limit 1000`),
  ]);
  return {balances,openings,cogs};
});

export const acceptEprEvidence = createServerFn({ method: "POST" }).validator(z.object({ evidenceId:z.string().min(1), disposition:z.enum(["accepted","rejected"]), notes:z.string().max(2000).default("") })).handler(async ({data})=>{
  const actor=await admin(); const sql=await getSql();
  const rows=await sql.query<{id:string;traveller_id:string;venture:"carbon"|"aluminium";disposition:string}>(`select e.id,e.traveller_id,t.venture,e.disposition from epr_evidence e join epr_travellers t on t.id=e.traveller_id where e.id=$1`,[data.evidenceId]);
  const row=rows[0]; if(!row) throw new Error("Evidence record not found.");
  await sql.query(`update epr_evidence set disposition=$1,notes=case when $2='' then notes else notes || E'\\n' || $2 end where id=$3`,[data.disposition,data.notes,row.id]);
  await audit(sql,row.venture,"evidence",row.id,`disposition_${data.disposition}`,actor,data);
  return {ok:true};
});

export const getEprReleaseReadiness = createServerFn({ method: "GET" }).validator(z.object({ travellerId:z.string().min(1) })).handler(async ({data})=>{
  await admin(); const sql=await getSql();
  const traveller=await sql.query<{id:string;venture:"carbon"|"aluminium";status:string;model_id:string;model_name:string;serial_number:string;bom_revision:string}>(`select id,venture,status,model_id,model_name,serial_number,bom_revision from epr_travellers where id=$1`,[data.travellerId]);
  if(!traveller[0]) throw new Error("Traveller not found.");
  const [gates,evidence,failedInspections,openNcr,balances,cogs,containmentBlocks]=await Promise.all([
    sql.query<{gate_id:string;status:string}>(`select distinct on (gate_id) gate_id,status from epr_gate_events where traveller_id=$1 order by gate_id,created_at desc`,[data.travellerId]),
    sql.query<{gate_id:string;count:number;accepted:number}>(`select gate_id,count(*)::int,count(*) filter(where disposition='accepted')::int as accepted from epr_evidence where traveller_id=$1 group by gate_id`,[data.travellerId]),
    sql.query(`select id,inspection_type,characteristic,result from epr_inspections where traveller_id=$1 and result in ('fail','conditional')`,[data.travellerId]),
    sql.query(`select id,record_type,severity,title,status from epr_ncr_capa where traveller_id=$1 and status not in ('closed','rejected')`,[data.travellerId]),
    sql.query(`select * from epr_authoritative_inventory_balance where venture=$1`,[traveller[0].venture]),
    sql.query(`select coalesce(sum(cogs_inr),0) as total_cogs_inr from epr_cogs_entries where traveller_id=$1`,[data.travellerId]),
    sql.query(`select b.case_id as containment_case_id,c.source_type as case_type,c.severity,c.reason,t.action as disposition from epr_release_blocks b join epr_containment_cases c on c.id=b.case_id join epr_containment_targets t on t.case_id=b.case_id and t.traveller_id=b.traveller_id where b.traveller_id=$1 and b.active=true and t.status='active'`,[data.travellerId]),
  ]);
  const gateMap=new Map(gates.map(g=>[g.gate_id,g.status]));
  const evidenceMap=new Map(evidence.map(e=>[e.gate_id,e]));
  const blockers:string[]=[];
  for(const gate of gateIds){ if(gateMap.get(gate)!=="passed") blockers.push(`${gate} is not passed.`); const ev=evidenceMap.get(gate); if(!ev || ev.accepted<1) blockers.push(`${gate} has no accepted evidence.`); }
  if(failedInspections.length) blockers.push(`${failedInspections.length} inspection/test result(s) are fail or conditional.`);
  if(openNcr.length) blockers.push(`${openNcr.length} NCR/CAPA record(s) remain open.`);
  if(containmentBlocks.length) blockers.push(`${containmentBlocks.length} active containment/recall block(s) prevent release.`);
  return {ready:blockers.length===0,blockers,traveller:traveller[0],gates,evidence,failedInspections,openNcr,containmentBlocks,inventoryBalances:balances,cogsTotalInr:Number(cogs[0]?.total_cogs_inr ?? 0)};
});

export const releaseEprTraveller = createServerFn({ method: "POST" }).validator(z.object({ travellerId:z.string().min(1) })).handler(async ({data})=>{
  const actor=await admin(); const sql=await getSql();
  const readiness=await getEprReleaseReadiness({data});
  if(!readiness.ready) throw new Error(`EPR release blocked: ${readiness.blockers.join(" ")}`);
  await sql.query(`update epr_travellers set status='completed',updated_at=now() where id=$1`,[data.travellerId]);
  await audit(sql,readiness.traveller.venture,"traveller",data.travellerId,"software_release_closed",actor,{serialNumber:readiness.traveller.serial_number,cogsTotalInr:readiness.cogsTotalInr});
  return {ok:true,travellerId:data.travellerId,status:"completed"};
});
