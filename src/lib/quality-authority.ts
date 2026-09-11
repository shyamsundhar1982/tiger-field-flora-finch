import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform, type CommandPermission } from "@/lib/page-access";

const stageSchema = z.enum(["incoming", "in_process", "final"]);
const resultSchema = z.enum(["pass", "fail", "conditional"]);
const dispositionSchema = z.enum(["accepted", "quarantine", "rejected", "rework", "concession"]);
const ncrStatusSchema = z.enum(["open", "contained", "under_capa", "closed", "rejected"]);
const capaStatusSchema = z.enum(["open", "implemented", "verified", "closed", "rejected"]);

async function assertSameSiteRequest() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request) return;
  const site = request.headers.get("sec-fetch-site");
  if (!site || site === "same-origin" || site === "none") return;
  const isTopLevelGet = request.headers.get("sec-fetch-mode") === "navigate" && request.method === "GET";
  if (!isTopLevelGet) throw new Error("Forbidden: cross-site request blocked");
}

async function requirePermission(permission: CommandPermission) {
  const role = await getCommandRole();
  if (!role || !canPerform(role, permission)) throw new Error(`Quality ${permission} permission denied.`);
  return role;
}

const actor = (role: string) => `command:${role}`;

type QualityLineage = {
  salesOrderId: string | null;
  jobCardId: string | null;
  travellerId: string | null;
  serialNumber: string | null;
  sku: string | null;
};

async function resolveQualityLineage(
  sql: Awaited<ReturnType<typeof getSql>>,
  input: { travellerId?: string | null; jobCardId?: string | null; goodsReceiptId?: string | null; sku?: string | null },
): Promise<QualityLineage> {
  if (input.travellerId) {
    const rows = await sql<{
      travellerId: string;
      jobCardId: string | null;
      serialNumber: string;
      sku: string | null;
      salesOrderId: string | null;
    }>`
      select
        t.id as "travellerId",
        t.job_card_id as "jobCardId",
        t.serial_number as "serialNumber",
        t.sku,
        c.sales_order_id as "salesOrderId"
      from epr_travellers t
      left join epr_production_job_cards c on c.id=t.job_card_id
      where t.id=${input.travellerId}
      limit 1
    `;
    const row = rows[0];
    if (!row) throw new Error("Quality traveller reference was not found.");
    if (input.jobCardId && row.jobCardId !== input.jobCardId) {
      throw new Error("Quality traveller does not belong to the supplied Job Card.");
    }
    return row;
  }
  if (input.jobCardId) {
    const rows = await sql<{ jobCardId: string; salesOrderId: string }>`
      select id as "jobCardId", sales_order_id as "salesOrderId"
      from epr_production_job_cards
      where id=${input.jobCardId}
      limit 1
    `;
    if (!rows[0]) throw new Error("Quality Job Card reference was not found.");
    return {
      salesOrderId: rows[0].salesOrderId,
      jobCardId: rows[0].jobCardId,
      travellerId: null,
      serialNumber: null,
      sku: input.sku ?? null,
    };
  }
  if (input.goodsReceiptId) {
    const rows = await sql<{ id: string; sku: string | null }>`
      select id, sku from vyndi_goods_receipts where id=${input.goodsReceiptId} limit 1
    `;
    if (!rows[0]) throw new Error("Quality GRN reference was not found.");
    return {
      salesOrderId: null,
      jobCardId: null,
      travellerId: null,
      serialNumber: null,
      sku: rows[0].sku ?? input.sku ?? null,
    };
  }
  return {
    salesOrderId: null,
    jobCardId: null,
    travellerId: null,
    serialNumber: null,
    sku: input.sku ?? null,
  };
}

export const listQualityAuthority = createServerFn({ method: "GET" }).handler(async () => {
  await assertSameSiteRequest();
  await requirePermission("view");
  const sql = await getSql();
  const [inspections, ncrs, capas, releases] = await Promise.all([
    sql`select * from vyndi_quality_inspections order by recorded_at desc limit 500`,
    sql`select * from vyndi_quality_ncrs order by updated_at desc limit 500`,
    sql`select * from vyndi_quality_capas order by updated_at desc limit 500`,
    sql`select * from vyndi_quality_releases where superseded_at is null order by decided_at desc limit 500`,
  ]);
  return {
    inspections: Array.isArray(inspections) ? [...inspections] : [],
    ncrs: Array.isArray(ncrs) ? [...ncrs] : [],
    capas: Array.isArray(capas) ? [...capas] : [],
    releases: Array.isArray(releases) ? [...releases] : [],
  };
});

const inspectionSchema = z.object({
  id: z.string().min(1).max(120),
  inspectionStage: stageSchema,
  inspectionType: z.string().min(1).max(200),
  jobCardId: z.string().min(1).max(120).nullable().optional(),
  travellerId: z.string().min(1).max(120).nullable().optional(),
  goodsReceiptId: z.string().min(1).max(120).nullable().optional(),
  sku: z.string().max(120).nullable().optional(),
  lotNumber: z.string().max(120).nullable().optional(),
  sampleSize: z.number().positive(),
  defectQuantity: z.number().min(0),
  result: resultSchema,
  disposition: dispositionSchema,
  criteriaReference: z.string().min(1).max(500),
  evidenceReference: z.string().min(1).max(500),
  notes: z.string().max(2000).optional(),
});

export const recordQualityInspection = createServerFn({ method: "POST" })
  .validator(inspectionSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const role = await requirePermission("edit");
    if (data.defectQuantity > data.sampleSize) throw new Error("Defect quantity cannot exceed inspection sample size.");
    if (data.inspectionStage !== "incoming" && !data.jobCardId && !data.travellerId) {
      throw new Error("In-process/final inspection must reference a Job Card or Traveller.");
    }
    if (data.inspectionStage === "incoming" && !data.goodsReceiptId && !data.sku) {
      throw new Error("Incoming inspection must reference a GRN or controlled SKU.");
    }
    const sql = await getSql();
    const lineage = await resolveQualityLineage(sql, data);
    await sql`
      insert into vyndi_quality_inspections (
        id,inspection_stage,inspection_type,sales_order_id,job_card_id,traveller_id,goods_receipt_id,
        sku,lot_number,serial_number,sample_size,defect_quantity,result,disposition,
        criteria_ref,evidence_ref,notes,recorded_by,recorded_role
      ) values (
        ${data.id},${data.inspectionStage},${data.inspectionType},${lineage.salesOrderId},${lineage.jobCardId},
        ${lineage.travellerId},${data.goodsReceiptId ?? null},${lineage.sku},${data.lotNumber ?? null},
        ${lineage.serialNumber},${data.sampleSize},${data.defectQuantity},${data.result},${data.disposition},
        ${data.criteriaReference},${data.evidenceReference},${data.notes ?? ""},${actor(role)},${role}
      )
    `;
    await sql`
      insert into vyndi_audit_events (
        id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,
        source_reference,payload_json,correlation_id,gate_id,gate_result,previous_state,new_state,reason
      ) values (
        ${crypto.randomUUID()},'quality_inspection',${data.id},1,'QUALITY_INSPECTION_RECORDED',
        ${actor(role)},${role},${data.evidenceReference},
        ${JSON.stringify({ stage: data.inspectionStage, result: data.result, disposition: data.disposition, jobCardId: lineage.jobCardId, travellerId: lineage.travellerId, goodsReceiptId: data.goodsReceiptId ?? null, sku: lineage.sku })}::jsonb,
        ${lineage.travellerId ? `TRAVELLER|${lineage.travellerId}` : lineage.jobCardId ? `JOB_CARD|${lineage.jobCardId}` : `QUALITY|${data.id}`},
        'G10-QUALITY',${data.result === "pass" ? "pass" : "fail"},null,${data.disposition},${data.notes ?? null}
      )
    `;
    return { ok: true, id: data.id, lineage };
  });

const ncrSchema = z.object({
  id: z.string().min(1).max(120),
  inspectionId: z.string().min(1).max(120),
  severity: z.enum(["minor", "major", "critical"]),
  description: z.string().min(1).max(2000),
  containment: z.string().max(2000).nullable().optional(),
  disposition: z.string().max(1000).nullable().optional(),
  sourceReference: z.string().min(1).max(500),
});

export const createQualityNcr = createServerFn({ method: "POST" })
  .validator(ncrSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const role = await requirePermission("edit");
    const sql = await getSql();
    const rows = await sql<{
      salesOrderId: string | null;
      jobCardId: string | null;
      travellerId: string | null;
      sku: string | null;
      lotNumber: string | null;
      serialNumber: string | null;
    }>`
      select sales_order_id as "salesOrderId",job_card_id as "jobCardId",traveller_id as "travellerId",
             sku,lot_number as "lotNumber",serial_number as "serialNumber"
      from vyndi_quality_inspections where id=${data.inspectionId} limit 1
    `;
    const inspection = rows[0];
    if (!inspection) throw new Error("NCR inspection evidence was not found.");
    await sql`
      insert into vyndi_quality_ncrs (
        id,inspection_id,sales_order_id,job_card_id,traveller_id,sku,lot_number,serial_number,
        severity,description,containment,disposition,status,source_ref,created_by,created_role
      ) values (
        ${data.id},${data.inspectionId},${inspection.salesOrderId},${inspection.jobCardId},${inspection.travellerId},
        ${inspection.sku},${inspection.lotNumber},${inspection.serialNumber},${data.severity},${data.description},
        ${data.containment ?? null},${data.disposition ?? null},'open',${data.sourceReference},${actor(role)},${role}
      )
    `;
    await sql`
      insert into vyndi_audit_events (
        id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,
        payload_json,correlation_id,gate_id,gate_result,previous_state,new_state,reason
      ) values (
        ${crypto.randomUUID()},'quality_ncr',${data.id},1,'QUALITY_NCR_CREATED',${actor(role)},${role},${data.sourceReference},
        ${JSON.stringify({ inspectionId: data.inspectionId, severity: data.severity, jobCardId: inspection.jobCardId, travellerId: inspection.travellerId })}::jsonb,
        ${inspection.travellerId ? `TRAVELLER|${inspection.travellerId}` : `NCR|${data.id}`},'G10-QUALITY','fail',null,'open',${data.description}
      )
    `;
    return { ok: true, id: data.id };
  });

const ncrTransitionSchema = z.object({
  id: z.string().min(1).max(120),
  toStatus: ncrStatusSchema,
  sourceReference: z.string().min(1).max(500),
  note: z.string().min(1).max(2000),
});

export const transitionQualityNcr = createServerFn({ method: "POST" })
  .validator(ncrTransitionSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const role = await requirePermission(data.toStatus === "closed" || data.toStatus === "rejected" ? "approve" : "edit");
    const sql = await getSql();
    const rows = await sql<{ status: string; travellerId: string | null }>`
      select status,traveller_id as "travellerId" from vyndi_quality_ncrs where id=${data.id} limit 1
    `;
    const current = rows[0];
    if (!current) throw new Error("NCR not found.");
    const allowed =
      (current.status === "open" && ["contained", "rejected"].includes(data.toStatus)) ||
      (current.status === "contained" && ["under_capa", "closed"].includes(data.toStatus)) ||
      (current.status === "under_capa" && data.toStatus === "closed");
    if (!allowed) throw new Error(`Invalid NCR transition: ${current.status} → ${data.toStatus}`);
    if (data.toStatus === "closed") {
      const openCapa = await sql<{ count: number }>`
        select count(*)::int as count from vyndi_quality_capas where ncr_id=${data.id} and status not in ('closed','rejected')
      `;
      if (Number(openCapa[0]?.count ?? 0) > 0) throw new Error("NCR cannot close while CAPA remains open.");
    }
    await sql`
      update vyndi_quality_ncrs set status=${data.toStatus},
        closed_by=case when ${data.toStatus} in ('closed','rejected') then ${actor(role)} else closed_by end,
        closed_at=case when ${data.toStatus} in ('closed','rejected') then now() else closed_at end,
        updated_at=now()
      where id=${data.id}
    `;
    await sql`
      insert into vyndi_audit_events (
        id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json,
        correlation_id,gate_id,gate_result,previous_state,new_state,reason
      ) values (
        ${crypto.randomUUID()},'quality_ncr',${data.id},'QUALITY_NCR_STATUS_CHANGED',${actor(role)},${role},${data.sourceReference},'{}'::jsonb,
        ${current.travellerId ? `TRAVELLER|${current.travellerId}` : `NCR|${data.id}`},'G10-QUALITY',
        ${data.toStatus === "closed" || data.toStatus === "rejected" ? "pass" : "fail"},${current.status},${data.toStatus},${data.note}
      )
    `;
    return { ok: true, fromStatus: current.status, toStatus: data.toStatus };
  });

const capaSchema = z.object({
  id: z.string().min(1).max(120),
  ncrId: z.string().min(1).max(120),
  rootCause: z.string().min(1).max(2000),
  correctiveAction: z.string().min(1).max(2000),
  preventiveAction: z.string().min(1).max(2000),
  owner: z.string().min(1).max(200),
  dueOn: z.string().nullable().optional(),
  effectivenessCriteria: z.string().min(1).max(2000),
  sourceReference: z.string().min(1).max(500),
});

export const createQualityCapa = createServerFn({ method: "POST" })
  .validator(capaSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const role = await requirePermission("edit");
    const sql = await getSql();
    const ncrRows = await sql<{ status: string; travellerId: string | null }>`
      select status,traveller_id as "travellerId" from vyndi_quality_ncrs where id=${data.ncrId} limit 1
    `;
    const ncr = ncrRows[0];
    if (!ncr || ["closed", "rejected"].includes(ncr.status)) throw new Error("CAPA requires an active NCR.");
    await sql`
      insert into vyndi_quality_capas (
        id,ncr_id,root_cause,corrective_action,preventive_action,owner,due_on,effectiveness_criteria,
        status,source_ref,created_by,created_role
      ) values (
        ${data.id},${data.ncrId},${data.rootCause},${data.correctiveAction},${data.preventiveAction},${data.owner},
        ${data.dueOn ?? null},${data.effectivenessCriteria},'open',${data.sourceReference},${actor(role)},${role}
      )
    `;
    await sql`update vyndi_quality_ncrs set status='under_capa',updated_at=now() where id=${data.ncrId} and status='contained'`;
    await sql`
      insert into vyndi_audit_events (
        id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json,
        correlation_id,gate_id,gate_result,previous_state,new_state,reason
      ) values (
        ${crypto.randomUUID()},'quality_capa',${data.id},'QUALITY_CAPA_CREATED',${actor(role)},${role},${data.sourceReference},
        ${JSON.stringify({ ncrId: data.ncrId, owner: data.owner, dueOn: data.dueOn ?? null })}::jsonb,
        ${ncr.travellerId ? `TRAVELLER|${ncr.travellerId}` : `NCR|${data.ncrId}`},'G10-QUALITY','fail',null,'open',${data.rootCause}
      )
    `;
    return { ok: true, id: data.id };
  });

const capaTransitionSchema = z.object({
  id: z.string().min(1).max(120),
  toStatus: capaStatusSchema,
  sourceReference: z.string().min(1).max(500),
  effectivenessEvidenceReference: z.string().max(500).nullable().optional(),
  note: z.string().min(1).max(2000),
});

export const transitionQualityCapa = createServerFn({ method: "POST" })
  .validator(capaTransitionSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const approval = data.toStatus === "verified" || data.toStatus === "closed" || data.toStatus === "rejected";
    const role = await requirePermission(approval ? "approve" : "edit");
    const sql = await getSql();
    const rows = await sql<{ status: string; ncrId: string }>`
      select status,ncr_id as "ncrId" from vyndi_quality_capas where id=${data.id} limit 1
    `;
    const current = rows[0];
    if (!current) throw new Error("CAPA not found.");
    const allowed =
      (current.status === "open" && ["implemented", "rejected"].includes(data.toStatus)) ||
      (current.status === "implemented" && data.toStatus === "verified") ||
      (current.status === "verified" && data.toStatus === "closed");
    if (!allowed) throw new Error(`Invalid CAPA transition: ${current.status} → ${data.toStatus}`);
    if (["verified", "closed"].includes(data.toStatus) && !data.effectivenessEvidenceReference) {
      throw new Error("CAPA verification/closure requires effectiveness evidence.");
    }
    await sql`
      update vyndi_quality_capas set status=${data.toStatus},
        effectiveness_evidence_ref=coalesce(${data.effectivenessEvidenceReference ?? null},effectiveness_evidence_ref),
        verified_by=case when ${data.toStatus} in ('verified','closed') then ${actor(role)} else verified_by end,
        verified_at=case when ${data.toStatus} in ('verified','closed') then now() else verified_at end,
        updated_at=now()
      where id=${data.id}
    `;
    await sql`
      insert into vyndi_audit_events (
        id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json,
        correlation_id,gate_id,gate_result,previous_state,new_state,reason
      ) values (
        ${crypto.randomUUID()},'quality_capa',${data.id},'QUALITY_CAPA_STATUS_CHANGED',${actor(role)},${role},${data.sourceReference},
        ${JSON.stringify({ effectivenessEvidenceReference: data.effectivenessEvidenceReference ?? null })}::jsonb,
        ${`NCR|${current.ncrId}`},'G10-QUALITY',${data.toStatus === "closed" || data.toStatus === "rejected" ? "pass" : "fail"},
        ${current.status},${data.toStatus},${data.note}
      )
    `;
    return { ok: true, fromStatus: current.status, toStatus: data.toStatus };
  });

const releaseSchema = z.object({
  id: z.string().min(1).max(120),
  travellerId: z.string().min(1).max(120),
  decision: z.enum(["released", "blocked"]),
  decisionReason: z.string().min(1).max(2000),
  evidenceReference: z.string().min(1).max(500),
});

export const decideQualityRelease = createServerFn({ method: "POST" })
  .validator(releaseSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const role = await requirePermission("approve");
    const sql = await getSql();
    const rows = await sql<{
      jobCardId: string | null;
      serialNumber: string;
      salesOrderId: string | null;
    }>`
      select t.job_card_id as "jobCardId",t.serial_number as "serialNumber",c.sales_order_id as "salesOrderId"
      from epr_travellers t
      left join epr_production_job_cards c on c.id=t.job_card_id
      where t.id=${data.travellerId}
      limit 1
    `;
    const traveller = rows[0];
    if (!traveller?.jobCardId) throw new Error("Quality release requires a production Traveller linked to a Job Card.");
    if (data.decision === "released") {
      const finalPass = await sql<{ count: number }>`
        select count(*)::int as count from vyndi_quality_inspections
        where traveller_id=${data.travellerId} and inspection_stage='final' and result='pass'
      `;
      if (Number(finalPass[0]?.count ?? 0) === 0) throw new Error("Quality release requires at least one passing final inspection.");
      const openNcr = await sql<{ count: number }>`
        select count(*)::int as count from vyndi_quality_ncrs
        where traveller_id=${data.travellerId} and status not in ('closed','rejected')
      `;
      if (Number(openNcr[0]?.count ?? 0) > 0) throw new Error("Quality release is blocked by an open NCR/CAPA chain.");
    }
    await sql`update vyndi_quality_releases set superseded_at=now() where traveller_id=${data.travellerId} and superseded_at is null`;
    await sql`
      insert into vyndi_quality_releases (
        id,traveller_id,job_card_id,sales_order_id,serial_number,decision,decision_reason,evidence_ref,decided_by,decided_role
      ) values (
        ${data.id},${data.travellerId},${traveller.jobCardId},${traveller.salesOrderId},${traveller.serialNumber},
        ${data.decision},${data.decisionReason},${data.evidenceReference},${actor(role)},${role}
      )
    `;
    await sql`
      insert into vyndi_audit_events (
        id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json,
        correlation_id,gate_id,gate_result,previous_state,new_state,reason
      ) values (
        ${crypto.randomUUID()},'quality_release',${data.id},'QUALITY_RELEASE_DECIDED',${actor(role)},${role},${data.evidenceReference},
        ${JSON.stringify({ travellerId: data.travellerId, jobCardId: traveller.jobCardId, salesOrderId: traveller.salesOrderId, serialNumber: traveller.serialNumber })}::jsonb,
        ${`TRAVELLER|${data.travellerId}`},'G10-QUALITY',${data.decision === "released" ? "pass" : "fail"},null,${data.decision},${data.decisionReason}
      )
    `;
    return { ok: true, id: data.id, decision: data.decision };
  });
