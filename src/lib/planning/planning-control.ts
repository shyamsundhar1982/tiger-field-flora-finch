import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSessionUser } from "@/lib/auth/verify.server";
import { getCommandRole } from "@/lib/command-access";
import { canPerform, type CommandRole } from "@/lib/page-access";
import {
  DEFAULT_APPROVED_OPERATING_PLAN,
  normalizeOperatingPlan,
  type OperatingPlan,
} from "@/lib/planning/operating-plan";

const monthSchema = z.number().int().min(-120).max(36);
const operatingPlanSchema = z.object({
  schemaVersion: z.literal(1),
  horizonStart: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  horizonMonths: z.literal(36),
  milestoneMonths: z.object({
    foundation: monthSchema,
    engineeringBaseline: monthSchema,
    prototypeValidation: monthSchema,
    toolingPilot: monthSchema,
    commercialLaunch: monthSchema,
  }),
  productLaunchMonths: z.object({
    longitude: monthSchema,
    latitude: monthSchema,
    altitude: monthSchema,
  }),
  demandScale: z.number().min(0).max(5),
  fundingTimingOffsetMonths: z.number().int().min(-12).max(24),
  cashFloorLakh: z.number().min(0).max(500),
  note: z.string().max(1000),
});

const draftSchema = z.object({
  plan: operatingPlanSchema,
  changeReason: z.string().min(3).max(1000),
  sourceVersionId: z.string().uuid().nullable().optional(),
});
const updateDraftSchema = draftSchema.extend({ id: z.string().uuid() });
const idSchema = z.object({ id: z.string().uuid() });
const rejectSchema = idSchema.extend({ reason: z.string().min(3).max(1000) });

export type OperatingPlanVersionStatus =
  | "draft"
  | "submitted"
  | "published"
  | "superseded"
  | "rejected";

export type OperatingPlanVersionRecord = {
  id: string;
  revisionNo: number;
  status: OperatingPlanVersionStatus;
  label: string;
  plan: OperatingPlan;
  changeReason: string;
  sourceVersionId: string | null;
  createdBy: string;
  createdRole: string;
  createdAt: string;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  publishedBy: string | null;
  publishedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
};

type DbPlanRow = {
  id: string;
  revision_no: number | string;
  status: OperatingPlanVersionStatus;
  label: string;
  plan: OperatingPlan;
  change_reason: string;
  source_version_id: string | null;
  created_by: string;
  created_role: string;
  created_at: string;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  published_by: string | null;
  published_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
};

function toRecord(row: DbPlanRow): OperatingPlanVersionRecord {
  return {
    id: row.id,
    revisionNo: Number(row.revision_no),
    status: row.status,
    label: row.label,
    plan: normalizeOperatingPlan(row.plan),
    changeReason: row.change_reason,
    sourceVersionId: row.source_version_id,
    createdBy: row.created_by,
    createdRole: row.created_role,
    createdAt: row.created_at,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    publishedBy: row.published_by,
    publishedAt: row.published_at,
    rejectedBy: row.rejected_by,
    rejectedAt: row.rejected_at,
  };
}

async function requirePlanningRole(permission: "view" | "edit") {
  const role = await getCommandRole();
  if (!role || !canPerform(role, permission)) {
    throw new Error(`Operating plan ${permission} access denied.`);
  }
  return role;
}

async function actorForRole(role: CommandRole) {
  const user = await getSessionUser();
  return user ? `user:${user.id}` : `command:${role}`;
}

export const getPublishedOperatingPlan = createServerFn({ method: "GET" }).handler(async () => {
  assertSameSiteRequest();
  await requirePlanningRole("view");
  const sql = await getSql();
  const rows = await sql<DbPlanRow>`
    select id, revision_no, status, label, plan, change_reason, source_version_id,
      created_by, created_role, created_at::text,
      submitted_by, submitted_at::text,
      approved_by, approved_at::text,
      published_by, published_at::text,
      rejected_by, rejected_at::text
    from operating_plan_versions
    where status = 'published'
    order by published_at desc nulls last, created_at desc
    limit 1
  `;
  const record = rows[0] ? toRecord(rows[0]) : null;
  return { record, plan: record?.plan ?? DEFAULT_APPROVED_OPERATING_PLAN };
});

export const listOperatingPlanVersions = createServerFn({ method: "GET" }).handler(async () => {
  assertSameSiteRequest();
  await requirePlanningRole("view");
  const sql = await getSql();
  const rows = await sql<DbPlanRow>`
    select id, revision_no, status, label, plan, change_reason, source_version_id,
      created_by, created_role, created_at::text,
      submitted_by, submitted_at::text,
      approved_by, approved_at::text,
      published_by, published_at::text,
      rejected_by, rejected_at::text
    from operating_plan_versions
    order by revision_no desc
    limit 50
  `;
  return rows.map(toRecord);
});

export const createOperatingPlanDraft = createServerFn({ method: "POST" })
  .validator(draftSchema)
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    const role = await requirePlanningRole("edit");
    const sql = await getSql();
    const id = crypto.randomUUID();
    const actor = await actorForRole(role);
    const plan = normalizeOperatingPlan(data.plan as OperatingPlan);
    const rows = await sql<DbPlanRow>`
      insert into operating_plan_versions
        (id, status, label, plan, change_reason, source_version_id, created_by, created_role)
      values
        (${id}, 'draft', 'Rolling 36-month Operating Plan', ${JSON.stringify(plan)}::jsonb,
         ${data.changeReason.trim()}, ${data.sourceVersionId ?? null}, ${actor}, ${role})
      returning id, revision_no, status, label, plan, change_reason, source_version_id,
        created_by, created_role, created_at::text,
        submitted_by, submitted_at::text,
        approved_by, approved_at::text,
        published_by, published_at::text,
        rejected_by, rejected_at::text
    `;
    return toRecord(rows[0]);
  });

export const updateOperatingPlanDraft = createServerFn({ method: "POST" })
  .validator(updateDraftSchema)
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    const role = await requirePlanningRole("edit");
    const sql = await getSql();
    const actor = await actorForRole(role);
    const plan = normalizeOperatingPlan(data.plan as OperatingPlan);
    const rows = await sql<DbPlanRow>`
      update operating_plan_versions
      set plan = ${JSON.stringify(plan)}::jsonb,
          change_reason = ${data.changeReason.trim()},
          source_version_id = ${data.sourceVersionId ?? null},
          created_by = ${actor},
          created_role = ${role},
          created_at = now()
      where id = ${data.id} and status = 'draft'
      returning id, revision_no, status, label, plan, change_reason, source_version_id,
        created_by, created_role, created_at::text,
        submitted_by, submitted_at::text,
        approved_by, approved_at::text,
        published_by, published_at::text,
        rejected_by, rejected_at::text
    `;
    if (!rows[0]) throw new Error("Only a draft operating plan can be updated.");
    return toRecord(rows[0]);
  });

export const submitOperatingPlan = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    const role = await requirePlanningRole("edit");
    const sql = await getSql();
    const actor = await actorForRole(role);
    const rows = await sql<DbPlanRow>`
      update operating_plan_versions
      set status = 'submitted', submitted_by = ${actor}, submitted_at = now()
      where id = ${data.id} and status = 'draft'
      returning id, revision_no, status, label, plan, change_reason, source_version_id,
        created_by, created_role, created_at::text,
        submitted_by, submitted_at::text,
        approved_by, approved_at::text,
        published_by, published_at::text,
        rejected_by, rejected_at::text
    `;
    if (!rows[0]) throw new Error("Only a draft plan can be submitted.");
    return toRecord(rows[0]);
  });

export const approveAndPublishOperatingPlan = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    const role = await getCommandRole();
    if (role !== "admin") {
      throw new Error("Only an administrator can approve and publish the operating plan.");
    }
    const sql = await getSql();
    const actor = await actorForRole(role);
    const rows = await sql<DbPlanRow>`
      with superseded as (
        update operating_plan_versions
        set status = 'superseded'
        where status = 'published' and id <> ${data.id}
        returning id
      )
      update operating_plan_versions
      set status = 'published',
          approved_by = ${actor}, approved_at = now(),
          published_by = ${actor}, published_at = now()
      where id = ${data.id} and status = 'submitted'
      returning id, revision_no, status, label, plan, change_reason, source_version_id,
        created_by, created_role, created_at::text,
        submitted_by, submitted_at::text,
        approved_by, approved_at::text,
        published_by, published_at::text,
        rejected_by, rejected_at::text
    `;
    if (!rows[0]) throw new Error("Only a submitted plan can be approved and published.");
    return toRecord(rows[0]);
  });

export const rejectOperatingPlan = createServerFn({ method: "POST" })
  .validator(rejectSchema)
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    const role = await getCommandRole();
    if (role !== "admin") throw new Error("Only an administrator can reject a submitted plan.");
    const sql = await getSql();
    const actor = await actorForRole(role);
    const rows = await sql<DbPlanRow>`
      update operating_plan_versions
      set status = 'rejected',
          rejected_by = ${actor},
          rejected_at = now(),
          change_reason = change_reason || E'\nRejected: ' || ${data.reason.trim()}
      where id = ${data.id} and status = 'submitted'
      returning id, revision_no, status, label, plan, change_reason, source_version_id,
        created_by, created_role, created_at::text,
        submitted_by, submitted_at::text,
        approved_by, approved_at::text,
        published_by, published_at::text,
        rejected_by, rejected_at::text
    `;
    if (!rows[0]) throw new Error("Only a submitted plan can be rejected.");
    return toRecord(rows[0]);
  });
