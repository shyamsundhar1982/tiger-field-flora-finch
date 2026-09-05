import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCommandRole } from "@/lib/command-access";
import { getSql } from "@/lib/db";

const ventureSchema = z.enum(["carbon", "aluminium"]);
const gateSchema = z.enum([
  "EPR-04",
  "EPR-05",
  "EPR-06",
  "EPR-07",
  "EPR-08",
  "EPR-09",
  "EPR-10",
  "EPR-11",
  "EPR-12",
]);

async function requireOperator() {
  const role = await getCommandRole();
  if (!role) throw new Error("Command access is required for EPR mutations.");
  return role;
}

function id(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

async function audit(
  venture: "carbon" | "aluminium",
  entityType: string,
  entityId: string,
  action: string,
  actor: string,
  payload: Record<string, unknown> = {},
) {
  const sql = await getSql();
  await sql.query(
    `insert into epr_audit_events (id, venture, entity_type, entity_id, action, actor, payload_json)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [id("AUD"), venture, entityType, entityId, action, actor, JSON.stringify(payload)],
  );
}

export const getEprSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  await requireOperator();
  const sql = await getSql();
  const travellers = await sql.query(
    `select id, venture, model_id, model_name, sku, bom_revision, engineering_revision,
            serial_number, supplier, status, created_by, created_at, updated_at
       from epr_travellers order by created_at desc limit 100`,
  );
  const evidence = await sql.query(
    `select id, traveller_id, gate_id, evidence_type, title, reference, disposition, notes,
            recorded_by, recorded_at
       from epr_evidence order by recorded_at desc limit 250`,
  );
  const gateEvents = await sql.query(
    `select id, traveller_id, gate_id, status, reason, actor, created_at
       from epr_gate_events order by created_at desc limit 250`,
  );
  const auditEvents = await sql.query(
    `select id, venture, entity_type, entity_id, action, actor, payload_json, created_at
       from epr_audit_events order by created_at desc limit 100`,
  );
  return {
    travellers,
    evidence,
    gateEvents,
    auditEvents,
  };
});

export const createEprTraveller = createServerFn({ method: "POST" })
  .validator(
    z.object({
      venture: ventureSchema,
      modelId: z.enum(["core", "pro", "apex"]),
      modelName: z.enum(["Longitude", "Latitude", "Altitude"]),
      sku: z.string().min(1).max(120),
      bomRevision: z.string().min(1).max(120),
      engineeringRevision: z.string().min(1).max(120),
      serialNumber: z.string().min(3).max(120),
      supplier: z.string().max(200).default(""),
    }),
  )
  .handler(async ({ data }) => {
    const actor = await requireOperator();
    const sql = await getSql();
    const travellerId = id("TRV");
    await sql.query(
      `insert into epr_travellers
       (id, venture, model_id, model_name, sku, bom_revision, engineering_revision, serial_number, supplier, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [travellerId, data.venture, data.modelId, data.modelName, data.sku, data.bomRevision,
       data.engineeringRevision, data.serialNumber, data.supplier, actor],
    );
    await sql.query(
      `insert into epr_gate_events (id, traveller_id, gate_id, status, actor)
       values ($1,$2,'EPR-04','planned',$3)`,
      [id("GATE"), travellerId, actor],
    );
    await audit(data.venture, "traveller", travellerId, "created", actor, data);
    return { ok: true, travellerId };
  });

export const updateEprGate = createServerFn({ method: "POST" })
  .validator(
    z.object({
      travellerId: z.string().min(1),
      venture: ventureSchema,
      gateId: gateSchema,
      status: z.enum(["planned", "in_progress", "blocked", "passed", "hold", "rework", "rejected"]),
      reason: z.string().max(1000).default(""),
    }),
  )
  .handler(async ({ data }) => {
    const actor = await requireOperator();
    const sql = await getSql();
    const traveller = await sql.query<{ id: string; status: string }>(
      `select id, status from epr_travellers where id = $1`,
      [data.travellerId],
    );
    if (!traveller[0]) throw new Error("Traveller not found.");
    await sql.query(
      `insert into epr_gate_events (id, traveller_id, gate_id, status, reason, actor)
       values ($1,$2,$3,$4,$5,$6)`,
      [id("GATE"), data.travellerId, data.gateId, data.status, data.reason, actor],
    );
    const travellerStatus = data.status === "rejected" ? "rejected" : data.status === "hold" || data.status === "blocked" ? "hold" : data.gateId === "EPR-04" && data.status === "passed" ? "released" : data.gateId === "EPR-05" && data.status === "in_progress" ? "in_build" : traveller[0].status;
    if (travellerStatus !== traveller[0].status) {
      await sql.query(`update epr_travellers set status=$1, updated_at=now() where id=$2`, [travellerStatus, data.travellerId]);
    } else {
      await sql.query(`update epr_travellers set updated_at=now() where id=$1`, [data.travellerId]);
    }
    await audit(data.venture, "traveller", data.travellerId, "gate_status_changed", actor, data);
    return { ok: true };
  });

export const recordEprEvidence = createServerFn({ method: "POST" })
  .validator(
    z.object({
      travellerId: z.string().min(1),
      venture: ventureSchema,
      gateId: gateSchema,
      evidenceType: z.string().min(1).max(100),
      title: z.string().min(1).max(200),
      reference: z.string().max(500).default(""),
      notes: z.string().max(2000).default(""),
    }),
  )
  .handler(async ({ data }) => {
    const actor = await requireOperator();
    const sql = await getSql();
    const found = await sql.query(`select id from epr_travellers where id=$1`, [data.travellerId]);
    if (!found[0]) throw new Error("Traveller not found.");
    const evidenceId = id("EVD");
    await sql.query(
      `insert into epr_evidence
       (id, traveller_id, gate_id, evidence_type, title, reference, notes, recorded_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [evidenceId, data.travellerId, data.gateId, data.evidenceType, data.title, data.reference, data.notes, actor],
    );
    await audit(data.venture, "evidence", evidenceId, "recorded", actor, data);
    return { ok: true, evidenceId };
  });
