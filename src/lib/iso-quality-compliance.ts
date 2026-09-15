import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform, type CommandPermission } from "@/lib/page-access";

async function assertSameSiteRequest() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request) return;
  const site = request.headers.get("sec-fetch-site");
  if (!site || site === "same-origin" || site === "none") return;
  const topLevelGet = request.headers.get("sec-fetch-mode") === "navigate" && request.method === "GET";
  if (!topLevelGet) throw new Error("Forbidden: cross-site request blocked");
}

async function requirePermission(permission: CommandPermission) {
  const role = await getCommandRole();
  if (!role || !canPerform(role, permission)) throw new Error(`ISO Quality ${permission} permission denied.`);
  return role;
}

const actor = (role: string) => `command:${role}`;

type Sql = Awaited<ReturnType<typeof getSql>>;

async function audit(
  sql: Sql,
  input: {
    entityType: string;
    entityId: string;
    action: string;
    role: string;
    sourceReference?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  await sql`
    insert into vyndi_audit_events
      (id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
    values
      (${crypto.randomUUID()},${input.entityType},${input.entityId},${input.action},${actor(input.role)},${input.role},
       ${input.sourceReference ?? null},${JSON.stringify(input.payload ?? {})}::jsonb)
  `;
}

export const listIsoQualityCompliance = createServerFn({ method: "GET" }).handler(async () => {
  await assertSameSiteRequest();
  await requirePermission("view");
  const sql = await getSql();
  const [standards, requirements, testMethods, itps, equipment, testRuns, releases, releaseStatus] = await Promise.all([
    sql`select * from vyndi_iso_standards order by domain,standard_code,edition`,
    sql`select * from vyndi_iso_requirements where status <> 'superseded' order by criticality desc,id`,
    sql`select * from vyndi_iso_test_methods where active=true order by method_family,id`,
    sql`select * from vyndi_iso_itps order by updated_at desc limit 250`,
    sql`select * from vyndi_iso_measurement_equipment order by equipment_type,id limit 500`,
    sql`select * from vyndi_iso_test_runs order by created_at desc limit 500`,
    sql`select * from vyndi_iso_product_release_decisions where superseded_at is null order by decided_at desc limit 250`,
    sql`select * from vyndi_vibpe_iso_release_status order by family_code,engineering_revision`,
  ]);
  return {
    standards: [...standards],
    requirements: [...requirements],
    testMethods: [...testMethods],
    itps: [...itps],
    equipment: [...equipment],
    testRuns: [...testRuns],
    releases: [...releases],
    releaseStatus: [...releaseStatus],
  };
});

const itpSchema = z.object({
  id: z.string().min(1).max(120),
  familyCode: z.string().min(1).max(120),
  variantId: z.string().min(1).max(120).nullable().optional(),
  engineeringRevision: z.string().min(1).max(120),
  name: z.string().min(1).max(240),
  status: z.enum(["draft", "pending_approval", "approved"]),
  sourceReference: z.string().min(1).max(500),
  items: z.array(z.object({
    id: z.string().min(1).max(120),
    requirementId: z.string().min(1).max(120),
    testMethodId: z.string().min(1).max(120).nullable().optional(),
    sequenceNo: z.number().int().positive(),
    mandatory: z.boolean().default(true),
    acceptanceReference: z.string().min(1).max(500),
    notes: z.string().max(2000).optional(),
  })).min(1),
});

export const createIsoInspectionTestPlan = createServerFn({ method: "POST" })
  .validator(itpSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const permission: CommandPermission = data.status === "approved" ? "approve" : "edit";
    const role = await requirePermission(permission);
    const sql = await getSql();

    const duplicateSequence = new Set<number>();
    for (const item of data.items) {
      if (duplicateSequence.has(item.sequenceNo)) throw new Error("ITP sequence numbers must be unique.");
      duplicateSequence.add(item.sequenceNo);
    }
    if (data.status === "approved" && !data.items.some((item) => item.mandatory)) {
      throw new Error("Approved ISO ITP requires at least one mandatory verification item.");
    }

    const baseline = await sql<{ id: string; status: string }>`
      select id,status from vyndi_engineering_baselines
      where family_code=${data.familyCode}
        and variant_id is not distinct from ${data.variantId ?? null}
        and revision_code=${data.engineeringRevision}
      limit 1
    `;
    if (!baseline[0]) throw new Error("ISO ITP requires an existing controlled Engineering baseline/revision.");

    const existing = await sql<{ id: string }>`select id from vyndi_iso_itps where id=${data.id} limit 1`;
    if (existing[0]) throw new Error("ISO ITP ID already exists; create a new controlled ITP revision instead of overwriting evidence.");

    for (const item of data.items) {
      const requirement = await sql<{ id: string; status: string }>`
        select id,status from vyndi_iso_requirements where id=${item.requirementId} limit 1
      `;
      if (!requirement[0] || requirement[0].status !== "active") throw new Error(`ITP requirement ${item.requirementId} is not active.`);
      if (item.testMethodId) {
        const method = await sql<{ id: string; active: boolean }>`
          select id,active from vyndi_iso_test_methods where id=${item.testMethodId} limit 1
        `;
        if (!method[0]?.active) throw new Error(`ITP test method ${item.testMethodId} is not active.`);
      }
    }

    await sql`
      insert into vyndi_iso_itps
        (id,family_code,variant_id,engineering_revision,name,status,source_ref,prepared_by,approved_by,approved_at)
      values
        (${data.id},${data.familyCode},${data.variantId ?? null},${data.engineeringRevision},${data.name},${data.status},
         ${data.sourceReference},${actor(role)},${data.status === "approved" ? actor(role) : null},
         ${data.status === "approved" ? new Date().toISOString() : null})
    `;
    for (const item of data.items) {
      await sql`
        insert into vyndi_iso_itp_items
          (id,itp_id,requirement_id,test_method_id,sequence_no,mandatory,acceptance_ref,notes)
        values
          (${item.id},${data.id},${item.requirementId},${item.testMethodId ?? null},${item.sequenceNo},${item.mandatory},
           ${item.acceptanceReference},${item.notes ?? ""})
      `;
    }
    await audit(sql, {
      entityType: "iso_itp",
      entityId: data.id,
      action: "ISO_ITP_CREATED",
      role,
      sourceReference: data.sourceReference,
      payload: { familyCode: data.familyCode, variantId: data.variantId ?? null, engineeringRevision: data.engineeringRevision, status: data.status, itemCount: data.items.length },
    });
    return { ok: true, id: data.id, status: data.status };
  });

const equipmentSchema = z.object({
  id: z.string().min(1).max(120),
  equipmentType: z.string().min(1).max(200),
  manufacturer: z.string().max(200).nullable().optional(),
  model: z.string().max(200).nullable().optional(),
  serialNumber: z.string().max(200).nullable().optional(),
  calibrationRequired: z.boolean().default(true),
  calibratedOn: z.string().nullable().optional(),
  calibrationDueOn: z.string().nullable().optional(),
  certificateReference: z.string().max(500).nullable().optional(),
  status: z.enum(["active", "out_of_service", "retired"]).default("active"),
  notes: z.string().max(2000).optional(),
});

export const recordIsoMeasurementEquipment = createServerFn({ method: "POST" })
  .validator(equipmentSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const role = await requirePermission("edit");
    if (data.calibrationRequired && data.status === "active") {
      if (!data.calibratedOn || !data.calibrationDueOn || !data.certificateReference) {
        throw new Error("Active measurement equipment requiring calibration must have calibration dates and certificate evidence.");
      }
      if (data.calibrationDueOn < data.calibratedOn) throw new Error("Calibration due date cannot precede calibration date.");
    }
    const sql = await getSql();
    await sql`
      insert into vyndi_iso_measurement_equipment
        (id,equipment_type,manufacturer,model,serial_number,calibration_required,calibrated_on,calibration_due_on,certificate_ref,status,notes,created_by)
      values
        (${data.id},${data.equipmentType},${data.manufacturer ?? null},${data.model ?? null},${data.serialNumber ?? null},
         ${data.calibrationRequired},${data.calibratedOn ?? null},${data.calibrationDueOn ?? null},${data.certificateReference ?? null},
         ${data.status},${data.notes ?? ""},${actor(role)})
      on conflict (id) do update set
        equipment_type=excluded.equipment_type,manufacturer=excluded.manufacturer,model=excluded.model,
        serial_number=excluded.serial_number,calibration_required=excluded.calibration_required,
        calibrated_on=excluded.calibrated_on,calibration_due_on=excluded.calibration_due_on,
        certificate_ref=excluded.certificate_ref,status=excluded.status,notes=excluded.notes,updated_at=now()
    `;
    await audit(sql, {
      entityType: "iso_measurement_equipment",
      entityId: data.id,
      action: "ISO_MEASUREMENT_EQUIPMENT_RECORDED",
      role,
      sourceReference: data.certificateReference ?? null,
      payload: { calibrationRequired: data.calibrationRequired, calibrationDueOn: data.calibrationDueOn ?? null, status: data.status },
    });
    return { ok: true, id: data.id };
  });

const testRunSchema = z.object({
  id: z.string().min(1).max(120),
  itpId: z.string().min(1).max(120),
  itpItemId: z.string().min(1).max(120),
  specimenReference: z.string().min(1).max(500),
  travellerId: z.string().min(1).max(120).nullable().optional(),
  serialNumber: z.string().max(200).nullable().optional(),
  laboratoryName: z.string().min(1).max(240),
  labIso17025Status: z.enum(["not_claimed", "confirmed", "not_applicable"]).default("not_claimed"),
  result: z.enum(["scheduled", "pass", "fail", "conditional", "invalid"]),
  evidenceReference: z.string().max(500).nullable().optional(),
  analysisReference: z.string().max(500).nullable().optional(),
  deviationReference: z.string().max(500).nullable().optional(),
  ncrId: z.string().min(1).max(120).nullable().optional(),
  retestOf: z.string().min(1).max(120).nullable().optional(),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  equipmentIds: z.array(z.string().min(1).max(120)).default([]),
  notes: z.string().max(4000).optional(),
});

export const recordIsoTestRun = createServerFn({ method: "POST" })
  .validator(testRunSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const role = await requirePermission("edit");
    const sql = await getSql();
    const itemRows = await sql<{
      itemId: string;
      itpId: string;
      testMethodId: string | null;
      familyCode: string;
      variantId: string | null;
      engineeringRevision: string;
      itpStatus: string;
    }>`
      select x.id as "itemId",x.itp_id as "itpId",x.test_method_id as "testMethodId",
             i.family_code as "familyCode",i.variant_id as "variantId",i.engineering_revision as "engineeringRevision",i.status as "itpStatus"
      from vyndi_iso_itp_items x
      join vyndi_iso_itps i on i.id=x.itp_id
      where x.id=${data.itpItemId} and x.itp_id=${data.itpId}
      limit 1
    `;
    const item = itemRows[0];
    if (!item) throw new Error("ISO test run must reference an ITP item belonging to the supplied ITP.");
    if (item.itpStatus !== "approved") throw new Error("ISO test execution is blocked until the ITP is approved.");
    if (data.result !== "scheduled" && !data.evidenceReference) throw new Error("Completed ISO test evidence reference is required.");
    if (data.result === "fail" && !data.ncrId) throw new Error("Failed ISO test must be linked to an NCR.");
    if (item.testMethodId && data.result !== "scheduled" && data.equipmentIds.length === 0) {
      throw new Error("Physical ISO test execution requires measurement/test equipment evidence.");
    }
    if (data.ncrId) {
      const ncr = await sql<{ id: string }>`select id from vyndi_quality_ncrs where id=${data.ncrId} limit 1`;
      if (!ncr[0]) throw new Error("Linked ISO test NCR was not found in canonical Quality authority.");
    }
    const testAt = data.completedAt ?? data.startedAt ?? new Date().toISOString();
    const uniqueEquipment = [...new Set(data.equipmentIds)];
    const equipmentSnapshots: Array<{ id: string; certificateRef: string | null; dueOn: string | null; valid: boolean }> = [];
    for (const id of uniqueEquipment) {
      const rows = await sql<{
        id: string;
        calibrationRequired: boolean;
        dueOn: string | null;
        certificateRef: string | null;
        status: string;
      }>`
        select id,calibration_required as "calibrationRequired",calibration_due_on::text as "dueOn",certificate_ref as "certificateRef",status
        from vyndi_iso_measurement_equipment where id=${id} limit 1
      `;
      const equipment = rows[0];
      if (!equipment) throw new Error(`ISO test equipment ${id} was not found.`);
      if (equipment.status !== "active") throw new Error(`ISO test blocked: equipment ${id} is not active.`);
      const testDate = testAt.slice(0, 10);
      const valid = !equipment.calibrationRequired || Boolean(equipment.dueOn && equipment.certificateRef && equipment.dueOn >= testDate);
      if (!valid) throw new Error(`ISO test blocked: calibration expired or missing for equipment ${id}.`);
      equipmentSnapshots.push({ id, certificateRef: equipment.certificateRef, dueOn: equipment.dueOn, valid });
    }

    await sql`
      insert into vyndi_iso_test_runs
        (id,itp_id,itp_item_id,test_method_id,family_code,variant_id,engineering_revision,specimen_ref,traveller_id,serial_number,
         laboratory_name,lab_iso17025_status,status,result,evidence_ref,analysis_ref,deviation_ref,ncr_id,retest_of,started_at,completed_at,
         notes,recorded_by,recorded_role)
      values
        (${data.id},${data.itpId},${data.itpItemId},${item.testMethodId},${item.familyCode},${item.variantId},${item.engineeringRevision},
         ${data.specimenReference},${data.travellerId ?? null},${data.serialNumber ?? null},${data.laboratoryName},${data.labIso17025Status},
         ${data.result === "scheduled" ? "scheduled" : "completed"},${data.result},${data.evidenceReference ?? null},${data.analysisReference ?? null},
         ${data.deviationReference ?? null},${data.ncrId ?? null},${data.retestOf ?? null},${data.startedAt ?? null},${data.completedAt ?? null},
         ${data.notes ?? ""},${actor(role)},${role})
    `;
    for (const equipment of equipmentSnapshots) {
      await sql`
        insert into vyndi_iso_test_run_equipment
          (test_run_id,equipment_id,certificate_ref_snapshot,calibration_due_on_snapshot,calibration_valid_at_test)
        values
          (${data.id},${equipment.id},${equipment.certificateRef},${equipment.dueOn},${equipment.valid})
      `;
    }
    await audit(sql, {
      entityType: "iso_test_run",
      entityId: data.id,
      action: "ISO_TEST_RUN_RECORDED",
      role,
      sourceReference: data.evidenceReference ?? null,
      payload: { itpId: data.itpId, itpItemId: data.itpItemId, result: data.result, ncrId: data.ncrId ?? null, equipmentIds: uniqueEquipment },
    });
    return { ok: true, id: data.id, result: data.result, calibrationEvidenceCount: equipmentSnapshots.length };
  });

type ReadinessInput = { familyCode: string; variantId?: string | null; engineeringRevision: string };

async function computeProductReleaseReadiness(sql: Sql, input: ReadinessInput) {
  const baselines = await sql<{ id: string; status: string }>`
    select id,status from vyndi_engineering_baselines
    where family_code=${input.familyCode}
      and variant_id is not distinct from ${input.variantId ?? null}
      and revision_code=${input.engineeringRevision}
    order by updated_at desc limit 1
  `;
  const itps = await sql<{ id: string; status: string }>`
    select id,status from vyndi_iso_itps
    where family_code=${input.familyCode}
      and variant_id is not distinct from ${input.variantId ?? null}
      and engineering_revision=${input.engineeringRevision}
      and status='approved'
    order by approved_at desc nulls last,updated_at desc limit 1
  `;
  const itp = itps[0];
  if (!itp) {
    return {
      ready: false,
      engineeringBaselineId: baselines[0]?.id ?? null,
      engineeringReleased: baselines[0]?.status === "released",
      itpId: null,
      itpApproved: false,
      mandatoryTestCount: 0,
      passedTestCount: 0,
      evidenceCompletenessPct: 0,
      openNcrCount: 0,
      openCapaCount: 0,
      invalidCalibrationCount: 0,
      blockers: ["No approved ISO Inspection & Test Plan for this engineering revision."],
    };
  }
  const [counts, quality] = await Promise.all([
    sql<{ mandatory: number; passed: number }>`
      select
        count(*) filter (where x.mandatory)::int as mandatory,
        count(*) filter (where x.mandatory and exists (
          select 1 from vyndi_iso_test_runs r where r.itp_item_id=x.id and r.result='pass'
        ))::int as passed
      from vyndi_iso_itp_items x where x.itp_id=${itp.id}
    `,
    sql<{ openNcr: number; openCapa: number; invalidCalibration: number }>`
      select
        count(distinct n.id) filter (where n.status not in ('closed','rejected'))::int as "openNcr",
        count(distinct c.id) filter (where c.status not in ('closed','rejected'))::int as "openCapa",
        count(distinct eq.test_run_id) filter (where eq.calibration_valid_at_test=false)::int as "invalidCalibration"
      from vyndi_iso_test_runs r
      left join vyndi_quality_ncrs n on n.id=r.ncr_id
      left join vyndi_quality_capas c on c.ncr_id=n.id
      left join vyndi_iso_test_run_equipment eq on eq.test_run_id=r.id
      where r.itp_id=${itp.id}
    `,
  ]);
  const mandatoryTestCount = Number(counts[0]?.mandatory ?? 0);
  const passedTestCount = Number(counts[0]?.passed ?? 0);
  const openNcrCount = Number(quality[0]?.openNcr ?? 0);
  const openCapaCount = Number(quality[0]?.openCapa ?? 0);
  const invalidCalibrationCount = Number(quality[0]?.invalidCalibration ?? 0);
  const engineeringReleased = baselines[0]?.status === "released";
  const evidenceCompletenessPct = mandatoryTestCount > 0 ? Math.round((passedTestCount / mandatoryTestCount) * 10000) / 100 : 0;
  const blockers: string[] = [];
  if (!engineeringReleased) blockers.push("Engineering baseline is not released.");
  if (mandatoryTestCount === 0) blockers.push("Approved ITP has no mandatory verification items.");
  if (passedTestCount !== mandatoryTestCount) blockers.push("Mandatory ISO verification evidence is incomplete.");
  if (openNcrCount > 0) blockers.push("ISO verification has open NCR evidence.");
  if (openCapaCount > 0) blockers.push("ISO verification has open CAPA evidence.");
  if (invalidCalibrationCount > 0) blockers.push("ISO verification contains invalid calibration evidence.");
  return {
    ready: blockers.length === 0,
    engineeringBaselineId: baselines[0]?.id ?? null,
    engineeringReleased,
    itpId: itp.id,
    itpApproved: true,
    mandatoryTestCount,
    passedTestCount,
    evidenceCompletenessPct,
    openNcrCount,
    openCapaCount,
    invalidCalibrationCount,
    blockers,
  };
}

const readinessSchema = z.object({
  familyCode: z.string().min(1).max(120),
  variantId: z.string().min(1).max(120).nullable().optional(),
  engineeringRevision: z.string().min(1).max(120),
});

export const getIsoProductReleaseReadiness = createServerFn({ method: "GET" })
  .validator(readinessSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    await requirePermission("view");
    return computeProductReleaseReadiness(await getSql(), data);
  });

const releaseSchema = readinessSchema.extend({
  id: z.string().min(1).max(120),
  decision: z.enum(["approved", "blocked"]),
  engineeringApprovalReference: z.string().max(500).nullable().optional(),
  qualityApprovalReference: z.string().max(500).nullable().optional(),
  decisionReason: z.string().min(1).max(2000),
  sourceReference: z.string().min(1).max(500),
});

export const decideIsoProductRelease = createServerFn({ method: "POST" })
  .validator(releaseSchema)
  .handler(async ({ data }) => {
    await assertSameSiteRequest();
    const role = await requirePermission("approve");
    const sql = await getSql();
    const readiness = await computeProductReleaseReadiness(sql, data);
    if (!readiness.itpId) throw new Error("ISO product release decision requires an approved ITP.");
    if (data.decision === "approved") {
      if (!readiness.ready) throw new Error(`ISO product release blocked: ${readiness.blockers.join(" ")}`);
      if (!data.engineeringApprovalReference || !data.qualityApprovalReference) {
        throw new Error("ISO product release requires both Engineering and Quality approval references.");
      }
    }
    await sql`
      update vyndi_iso_product_release_decisions set superseded_at=now()
      where family_code=${data.familyCode}
        and variant_id is not distinct from ${data.variantId ?? null}
        and engineering_revision=${data.engineeringRevision}
        and superseded_at is null
    `;
    await sql`
      insert into vyndi_iso_product_release_decisions
        (id,family_code,variant_id,engineering_revision,itp_id,decision,evidence_completeness_pct,mandatory_test_count,
         passed_test_count,open_ncr_count,open_capa_count,invalid_calibration_count,engineering_approval_ref,quality_approval_ref,
         decision_reason,source_ref,decided_by,decided_role)
      values
        (${data.id},${data.familyCode},${data.variantId ?? null},${data.engineeringRevision},${readiness.itpId},${data.decision},
         ${readiness.evidenceCompletenessPct},${readiness.mandatoryTestCount},${readiness.passedTestCount},${readiness.openNcrCount},
         ${readiness.openCapaCount},${readiness.invalidCalibrationCount},${data.engineeringApprovalReference ?? null},
         ${data.qualityApprovalReference ?? null},${data.decisionReason},${data.sourceReference},${actor(role)},${role})
    `;
    await audit(sql, {
      entityType: "iso_product_release",
      entityId: data.id,
      action: "ISO_PRODUCT_RELEASE_DECIDED",
      role,
      sourceReference: data.sourceReference,
      payload: { familyCode: data.familyCode, variantId: data.variantId ?? null, engineeringRevision: data.engineeringRevision, decision: data.decision, readiness },
    });
    return { ok: true, id: data.id, decision: data.decision, readiness };
  });
