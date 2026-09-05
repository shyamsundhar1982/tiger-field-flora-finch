import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCommandRole } from "@/lib/command-access";
import { getSql } from "@/lib/db";

const ventureSchema = z.enum(["carbon", "aluminium"]);
const gateSchema = z.enum(["EPR-04","EPR-05","EPR-06","EPR-07","EPR-08","EPR-09","EPR-10","EPR-11","EPR-12"]);
const modelSchema = z.enum(["core", "pro", "apex"]);
const modelNameSchema = z.enum(["Longitude", "Latitude", "Altitude"]);
const modelNameForId: Record<z.infer<typeof modelSchema>, z.infer<typeof modelNameSchema>> = {
  core: "Longitude",
  pro: "Latitude",
  apex: "Altitude",
};

async function requireCommand(write = false) {
  const role = await getCommandRole();
  if (!role) throw new Error("Command access is required for EPR access.");
  if (write && role !== "admin") throw new Error("Admin Command access is required for EPR mutations.");
  return role;
}

function id(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

async function audit(sql: Awaited<ReturnType<typeof getSql>>, venture: "carbon" | "aluminium", entityType: string, entityId: string, action: string, actor: string, payload: Record<string, unknown> = {}) {
  await sql.query(
    `insert into epr_audit_events (id, venture, entity_type, entity_id, action, actor, payload_json) values ($1,$2,$3,$4,$5,$6,$7)`,
    [id("AUD"), venture, entityType, entityId, action, actor, JSON.stringify(payload)],
  );
}

async function getTraveller(sql: Awaited<ReturnType<typeof getSql>>, travellerId: string) {
  const rows = await sql.query<{
    id: string;
    status: string;
    venture: "carbon" | "aluminium";
    model_id: string;
    model_name: string;
    serial_number: string;
  }>(`select id, status, venture, model_id, model_name, serial_number from epr_travellers where id = $1`, [travellerId]);
  if (!rows[0]) throw new Error("Traveller not found.");
  return rows[0];
}

async function assertGateOrder(sql: Awaited<ReturnType<typeof getSql>>, travellerId: string, gateId: string, status: string) {
  if (status !== "passed") return;
  const gateNumber = Number(gateId.slice(4));
  if (!Number.isInteger(gateNumber)) throw new Error("Invalid EPR gate.");
  if (gateNumber <= 4) return;
  const prerequisite = `EPR-${String(gateNumber - 1).padStart(2, "0")}`;
  const rows = await sql.query<{ status: string }>(
    `select status from epr_gate_events where traveller_id=$1 and gate_id=$2 order by created_at desc limit 1`,
    [travellerId, prerequisite],
  );
  if (rows[0]?.status !== "passed") {
    throw new Error(`${prerequisite} must be passed before ${gateId} can be passed.`);
  }
}

export const getEprSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  await requireCommand();
  const sql = await getSql();
  const travellers = await sql.query(`select id, venture, model_id, model_name, sku, bom_revision, engineering_revision, serial_number, supplier, status, created_by, created_at, updated_at from epr_travellers order by created_at desc limit 100`);
  const evidence = await sql.query(`select id, traveller_id, gate_id, evidence_type, title, reference, disposition, notes, recorded_by, recorded_at from epr_evidence order by recorded_at desc limit 250`);
  const gateEvents = await sql.query(`select id, traveller_id, gate_id, status, reason, actor, created_at from epr_gate_events order by created_at desc limit 250`);
  const auditEvents = await sql.query(`select id, venture, entity_type, entity_id, action, actor, payload_json, created_at from epr_audit_events order by created_at desc limit 100`);
  return { travellers, evidence, gateEvents, auditEvents };
});

export const createEprTraveller = createServerFn({ method: "POST" })
  .validator(z.object({
    venture: ventureSchema,
    modelId: modelSchema,
    modelName: modelNameSchema,
    sku: z.string().min(1).max(120),
    bomRevision: z.string().min(1).max(120),
    engineeringRevision: z.string().min(1).max(120),
    serialNumber: z.string().min(3).max(120),
    supplier: z.string().max(200).default(""),
  }))
  .handler(async ({ data }) => {
    const actor = await requireCommand(true);
    const sql = await getSql();
    if (modelNameForId[data.modelId] !== data.modelName) {
      throw new Error(`Model identity mismatch: ${data.modelId} maps to ${modelNameForId[data.modelId]}.`);
    }
    const travellerId = id("TRV");
    try {
      await sql.query(
        `insert into epr_travellers (id, venture, model_id, model_name, sku, bom_revision, engineering_revision, serial_number, supplier, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [travellerId, data.venture, data.modelId, data.modelName, data.sku, data.bomRevision, data.engineeringRevision, data.serialNumber.trim(), data.supplier.trim(), actor],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("serial_number") || message.toLowerCase().includes("duplicate key")) {
        throw new Error("Serial number already exists. Each EPR traveller must have a unique serial number.");
      }
      throw error;
    }
    await sql.query(`insert into epr_gate_events (id, traveller_id, gate_id, status, actor) values ($1,$2,'EPR-04','planned',$3)`, [id("GATE"), travellerId, actor]);
    await audit(sql, data.venture, "traveller", travellerId, "created", actor, { ...data, serialNumber: data.serialNumber.trim() });
    return { ok: true, travellerId };
  });

export const updateEprGate = createServerFn({ method: "POST" })
  .validator(z.object({
    travellerId: z.string().min(1),
    venture: ventureSchema,
    gateId: gateSchema,
    status: z.enum(["planned", "in_progress", "blocked", "passed", "hold", "rework", "rejected"]),
    reason: z.string().max(1000).default(""),
  }))
  .handler(async ({ data }) => {
    const actor = await requireCommand(true);
    const sql = await getSql();
    const traveller = await getTraveller(sql, data.travellerId);
    if (traveller.venture !== data.venture) throw new Error("Venture scope mismatch.");
    await assertGateOrder(sql, data.travellerId, data.gateId, data.status);
    await sql.query(`insert into epr_gate_events (id, traveller_id, gate_id, status, reason, actor) values ($1,$2,$3,$4,$5,$6)`, [id("GATE"), data.travellerId, data.gateId, data.status, data.reason]);
    const travellerStatus = data.status === "rejected" ? "rejected" : data.status === "hold" || data.status === "blocked" ? "hold" : data.gateId === "EPR-04" && data.status === "passed" ? "released" : data.gateId === "EPR-05" && data.status === "in_progress" ? "in_build" : traveller.status;
    await sql.query(`update epr_travellers set status=$1, updated_at=now() where id=$2`, [travellerStatus, data.travellerId]);
    await audit(sql, data.venture, "traveller", data.travellerId, "gate_status_changed", actor, data);
    return { ok: true };
  });

export const recordEprEvidence = createServerFn({ method: "POST" })
  .validator(z.object({
    travellerId: z.string().min(1),
    venture: ventureSchema,
    gateId: gateSchema,
    evidenceType: z.string().min(1).max(100),
    title: z.string().min(1).max(200),
    reference: z.string().max(500).default(""),
    notes: z.string().max(2000).default(""),
  }))
  .handler(async ({ data }) => {
    const actor = await requireCommand(true);
    const sql = await getSql();
    const found = await getTraveller(sql, data.travellerId);
    if (found.venture !== data.venture) throw new Error("Venture scope mismatch.");
    const evidenceId = id("EVD");
    await sql.query(`insert into epr_evidence (id, traveller_id, gate_id, evidence_type, title, reference, notes, recorded_by) values ($1,$2,$3,$4,$5,$6,$7,$8)`, [evidenceId, data.travellerId, data.gateId, data.evidenceType, data.title, data.reference, data.notes, actor]);
    await audit(sql, data.venture, "evidence", evidenceId, "recorded", actor, data);
    return { ok: true, evidenceId };
  });
