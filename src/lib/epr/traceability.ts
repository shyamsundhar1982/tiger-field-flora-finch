import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCommandRole } from "@/lib/command-access";
import { getSql } from "@/lib/db";

const venture = z.enum(["carbon", "aluminium"]);
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

type Sql = Awaited<ReturnType<typeof getSql>>;

type TravellerIdentity = {
  id: string;
  venture: "carbon" | "aluminium";
  model_id: "core" | "pro" | "apex";
  model_name: string;
  bom_revision: string;
  serial_number: string;
};

async function admin() {
  const role = await getCommandRole();
  if (!role) throw new Error("Command access is required.");
  if (role !== "admin") throw new Error("Admin Command access is required for EPR mutations.");
  return role;
}

async function traveller(sql: Sql, travellerId: string, v: "carbon" | "aluminium"): Promise<TravellerIdentity> {
  const rows = await sql.query<TravellerIdentity>(
    "select id, venture, model_id, model_name, bom_revision, serial_number from epr_travellers where id=$1",
    [travellerId],
  );
  const record = rows[0];
  if (!record) throw new Error("Traveller not found.");
  if (record.venture !== v) throw new Error("Venture scope mismatch.");
  return record;
}

async function audit(sql: Sql, ventureName: "carbon" | "aluminium", entityType: string, entityId: string, action: string, actor: string, payload: Record<string, unknown> = {}) {
  await sql.query(
    `insert into epr_audit_events (id, venture, entity_type, entity_id, action, actor, payload_json) values ($1,$2,$3,$4,$5,$6,$7)`,
    [id("AUD"), ventureName, entityType, entityId, action, actor, JSON.stringify(payload)],
  );
}

async function validateMappedInventorySku(sql: Sql, identity: TravellerIdentity, sku: string, unit: string) {
  const mappings = await sql.query<{ id: string }>(
    `select id from epr_bom_inventory_mappings
      where venture=$1 and model_id=$2 and bom_revision=$3 and sku=$4 and unit=$5
        and status='active' and effective_from <= now()
        and (effective_to is null or effective_to > now())
      limit 1`,
    [identity.venture, identity.model_id, identity.bom_revision, sku, unit],
  );
  if (!mappings[0]) {
    throw new Error(`Inventory SKU ${sku} is not approved for ${identity.model_name} / BOM ${identity.bom_revision} / unit ${unit}. Add an active BOM-SKU mapping before issue or consume.`);
  }
  return mappings[0].id;
}

export const getEprExecutionChain = createServerFn({ method: "GET" }).handler(async () => {
  await admin();
  const sql = await getSql();
  const [lots, operations, inspections, ncrCapa, movements] = await Promise.all([
    sql.query("select * from epr_material_lots order by created_at desc limit 500"),
    sql.query("select * from epr_process_operations order by created_at desc limit 500"),
    sql.query("select * from epr_inspections order by inspected_at desc limit 500"),
    sql.query("select * from epr_ncr_capa order by created_at desc limit 500"),
    sql.query("select * from epr_inventory_movements order by created_at desc limit 500"),
  ]);
  return { lots, operations, inspections, ncrCapa, movements };
});

export const recordMaterialLot = createServerFn({ method: "POST" }).validator(z.object({
  travellerId: z.string().min(1), venture, materialCode: z.string().min(1).max(120), materialDescription: z.string().min(1).max(300), lotNumber: z.string().min(1).max(120), supplier: z.string().max(200).default(""), certificateReference: z.string().max(300).default(""), quantity: z.number().nonnegative(), unit: z.string().max(30).default("unit"), disposition: z.enum(["quarantine","accepted","rejected","consumed"]).default("quarantine"),
})).handler(async ({ data }) => {
  const actor = await admin(); const sql = await getSql(); await traveller(sql, data.travellerId, data.venture);
  const recordId = id("LOT");
  await sql.query(`insert into epr_material_lots (id,traveller_id,venture,material_code,material_description,lot_number,supplier,certificate_reference,quantity,unit,disposition,recorded_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [recordId,data.travellerId,data.venture,data.materialCode,data.materialDescription,data.lotNumber,data.supplier,data.certificateReference,data.quantity,data.unit,data.disposition,actor]);
  await audit(sql, data.venture, "material_lot", recordId, "recorded", actor, data);
  return { ok: true, recordId };
});

export const recordProcessOperation = createServerFn({ method: "POST" }).validator(z.object({
  travellerId: z.string().min(1), venture, operationCode: z.string().min(1).max(80), operationName: z.string().min(1).max(200), workstation: z.string().max(120).default(""), operatorName: z.string().max(200).default(""), status: z.enum(["planned","in_progress","completed","hold","rework","rejected"]).default("planned"), recordReference: z.string().max(300).default(""), notes: z.string().max(2000).default(""),
})).handler(async ({ data }) => {
  const actor = await admin(); const sql = await getSql(); await traveller(sql, data.travellerId, data.venture);
  const recordId = id("OP");
  await sql.query(`insert into epr_process_operations (id,traveller_id,venture,operation_code,operation_name,workstation,operator_name,status,record_reference,notes,recorded_by,started_at,completed_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,case when $8='in_progress' then now() else null end,case when $8='completed' then now() else null end)`, [recordId,data.travellerId,data.venture,data.operationCode,data.operationName,data.workstation,data.operatorName,data.status,data.recordReference,data.notes,actor]);
  await audit(sql, data.venture, "process_operation", recordId, "recorded", actor, data);
  return { ok: true, recordId };
});

export const recordEprInspection = createServerFn({ method: "POST" }).validator(z.object({
  travellerId: z.string().min(1), venture, inspectionType: z.enum(["dimensional","interface","ndt","cosmetic","structural","iso4210"]), characteristic: z.string().min(1).max(200), nominalValue: z.string().max(120).default(""), measuredValue: z.string().max(120).default(""), acceptanceCriteria: z.string().max(500).default(""), result: z.enum(["pending","pass","fail","conditional"]), evidenceReference: z.string().max(300).default(""), notes: z.string().max(2000).default(""),
})).handler(async ({ data }) => {
  const actor = await admin(); const sql = await getSql(); await traveller(sql, data.travellerId, data.venture);
  const recordId = id("INS");
  await sql.query(`insert into epr_inspections (id,traveller_id,venture,inspection_type,characteristic,nominal_value,measured_value,acceptance_criteria,result,evidence_reference,notes,inspected_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [recordId,data.travellerId,data.venture,data.inspectionType,data.characteristic,data.nominalValue,data.measuredValue,data.acceptanceCriteria,data.result,data.evidenceReference,data.notes,actor]);
  await audit(sql, data.venture, "inspection", recordId, "recorded", actor, data);
  return { ok: true, recordId };
});

export const recordNcrCapa = createServerFn({ method: "POST" }).validator(z.object({
  travellerId: z.string().min(1), venture, recordType: z.enum(["ncr","capa"]), severity: z.enum(["minor","major","critical"]).default("minor"), title: z.string().min(1).max(200), description: z.string().min(1).max(3000), containment: z.string().max(2000).default(""), rootCause: z.string().max(2000).default(""), correctiveAction: z.string().max(2000).default(""), owner: z.string().max(200).default(""), status: z.enum(["open","contained","in_progress","closed","rejected"]).default("open"), closureReference: z.string().max(300).default(""),
})).handler(async ({ data }) => {
  const actor = await admin(); const sql = await getSql(); await traveller(sql, data.travellerId, data.venture);
  const recordId = id(data.recordType.toUpperCase());
  await sql.query(`insert into epr_ncr_capa (id,traveller_id,venture,record_type,severity,title,description,containment,root_cause,corrective_action,owner,status,closure_reference,created_by,closed_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,case when $12='closed' then now() else null end)`, [recordId,data.travellerId,data.venture,data.recordType,data.severity,data.title,data.description,data.containment,data.rootCause,data.correctiveAction,data.owner,data.status,data.closureReference,actor]);
  await audit(sql, data.venture, "ncr_capa", recordId, "recorded", actor, data);
  return { ok: true, recordId };
});

export const recordInventoryMovement = createServerFn({ method: "POST" }).validator(z.object({
  travellerId: z.string().min(1), venture, sku: z.string().min(1).max(120), movementType: z.enum(["reserve","issue","return","consume","adjust"]), quantity: z.number().positive(), unit: z.string().max(30).default("unit"), reference: z.string().max(300).default(""), notes: z.string().max(2000).default(""),
})).handler(async ({ data }) => {
  const actor = await admin();
  const sql = await getSql();
  const identity = await traveller(sql, data.travellerId, data.venture);
  if (data.movementType === "issue" || data.movementType === "consume") {
    await validateMappedInventorySku(sql, identity, data.sku, data.unit);
  }
  const movementId = id("MOV");
  const ledgerId = id("LED");
  const rows = await sql.query<{ movement_id: string; ledger_id: string; resulting_balance: number | string }>(
    `select * from post_epr_inventory_movement($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [movementId, ledgerId, data.travellerId, data.venture, data.sku, data.movementType, data.quantity, data.unit, data.reference, data.notes, actor],
  );
  if (!rows[0]) throw new Error("Inventory movement was not posted.");
  return { ok: true, recordId: movementId, ledgerId: rows[0].ledger_id, resultingBalance: Number(rows[0].resulting_balance) };
});
