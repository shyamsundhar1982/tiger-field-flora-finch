import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";
import { requireBusinessActor } from "@/lib/business-actor";
import { requireUserId } from "@/lib/auth/verify.server";
import type { FinanceAssumptions, ScenarioId } from "@/lib/finance/model";
import type { AccountingAssumptions } from "@/lib/finance/accounting";

export type OperatingPlanSnapshot = {
  id: string;
  revision: number;
  status: "draft" | "pending_approval" | "approved" | "superseded" | "rejected";
  horizonMonths: 36;
  scenario: ScenarioId;
  drawStandby: boolean;
  finance: FinanceAssumptions;
  accounting: AccountingAssumptions;
  changeReason: string;
  createdBy: string;
  createdAt: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
};

type PlanRow = {
  id: string;
  revision: number | string;
  status: OperatingPlanSnapshot["status"];
  horizon_months: number | string;
  scenario: ScenarioId;
  draw_standby: boolean;
  finance_json: FinanceAssumptions;
  accounting_json: AccountingAssumptions;
  change_reason: string;
  created_by: string;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
};

function snapshot(row: PlanRow): OperatingPlanSnapshot {
  return {
    id: row.id,
    revision: Number(row.revision),
    status: row.status,
    horizonMonths: 36,
    scenario: row.scenario,
    drawStandby: Boolean(row.draw_standby),
    finance: row.finance_json,
    accounting: row.accounting_json,
    changeReason: row.change_reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
  };
}

const planPayload = z.object({
  scenario: z.enum(["base", "delayed", "stress"]),
  drawStandby: z.boolean(),
  horizonMonths: z.literal(36).default(36),
  finance: z.record(z.string(), z.unknown()),
  accounting: z.record(z.string(), z.unknown()),
  changeReason: z.string().trim().max(1000).default(""),
});

const selectPlan = `select id,revision,status,horizon_months,scenario,draw_standby,finance_json,accounting_json,
  change_reason,created_by,created_at::text,approved_by,approved_at::text from vyndi_plan_revisions`;

export const getOperatingPlanState = createServerFn({ method: "GET" }).handler(async () => {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Operating plan view permission denied.");
  const sql = await getSql();
  const userId = await requireUserId().catch(() => null);
  const [approvedRows, draftRows, pendingRows] = await Promise.all([
    sql.query<PlanRow>(`${selectPlan} where status='approved' order by revision desc limit 1`),
    userId
      ? sql.query<PlanRow>(`${selectPlan} where status='draft' and created_by=$1 order by revision desc limit 1`, [userId])
      : Promise.resolve([] as PlanRow[]),
    canPerform(role, "approve")
      ? sql.query<PlanRow>(`${selectPlan} where status='pending_approval' order by revision desc,created_at desc limit 20`)
      : Promise.resolve([] as PlanRow[]),
  ]);
  return {
    approved: approvedRows[0] ? snapshot(approvedRows[0]) : null,
    draft: draftRows[0] ? snapshot(draftRows[0]) : null,
    pending: pendingRows.map(snapshot),
  };
});

export const saveOperatingPlanDraft = createServerFn({ method: "POST" })
  .validator(planPayload)
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();
    const rows = await sql.query<{ plan_id: string; revision: number | string }>(
      `select * from save_vyndi_plan_draft($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)`,
      [
        `PLAN-${crypto.randomUUID()}`,
        data.scenario,
        data.drawStandby,
        36,
        JSON.stringify(data.finance),
        JSON.stringify(data.accounting),
        data.changeReason,
        actor.userId,
        actor.role,
      ],
    );
    const row = rows[0];
    if (!row) throw new Error("Plan draft save did not return a revision.");
    return { id: row.plan_id, revision: Number(row.revision) };
  });

export const submitOperatingPlan = createServerFn({ method: "POST" })
  .validator(z.object({ planId: z.string().min(1).max(120) }))
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();
    const rows = await sql.query<{ revision: number | string }>(
      `select submit_vyndi_plan_for_approval($1,$2,$3) as revision`,
      [data.planId, actor.userId, actor.role],
    );
    return { ok: true, revision: Number(rows[0]?.revision ?? 0) };
  });

export const approveOperatingPlan = createServerFn({ method: "POST" })
  .validator(z.object({ planId: z.string().min(1).max(120), decisionNote: z.string().trim().max(1000).default("") }))
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("approve");
    const sql = await getSql();
    const rows = await sql.query<{ revision: number | string }>(
      `select approve_vyndi_plan_revision($1,$2,$3,$4) as revision`,
      [data.planId, data.decisionNote, actor.userId, actor.role],
    );
    return { ok: true, revision: Number(rows[0]?.revision ?? 0) };
  });
