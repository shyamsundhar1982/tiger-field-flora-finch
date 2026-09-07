import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";
import { requireBusinessActor } from "@/lib/business-actor";

export type ActualField =
  | "revenue"
  | "units"
  | "cogs"
  | "opex"
  | "closingCash"
  | "inventory"
  | "receivables"
  | "payables";
export type ActualMonth = Partial<Record<ActualField, number | null>> & {
  sourceReference?: string;
  verified?: boolean;
};
export type ActualsMap = Record<number, ActualMonth>;

const actualSchema = z.object({
  month: z.number().int().min(1).max(36),
  actual: z.object({
    revenue: z.number().min(0).nullable().optional(),
    units: z.number().min(0).nullable().optional(),
    cogs: z.number().min(0).nullable().optional(),
    opex: z.number().min(0).nullable().optional(),
    closingCash: z.number().nullable().optional(),
    inventory: z.number().min(0).nullable().optional(),
    receivables: z.number().min(0).nullable().optional(),
    payables: z.number().min(0).nullable().optional(),
    sourceReference: z.string().trim().max(500).default(""),
    verified: z.boolean().default(false),
  }).superRefine((actual, context) => {
    const hasValue = [actual.revenue, actual.units, actual.cogs, actual.opex, actual.closingCash, actual.inventory, actual.receivables, actual.payables]
      .some((value) => value !== null && value !== undefined);
    if (hasValue && !actual.sourceReference.trim()) {
      context.addIssue({ code: "custom", path: ["sourceReference"], message: "Actuals require a source reference (bank/invoice/ledger/evidence)." });
    }
  }),
});

export const listMonthlyActuals = createServerFn({ method: "GET" }).handler(async () => {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Actuals view permission denied.");
  const sql = await getSql();
  const rows = await sql<{
    plan_month: number | string;
    revenue: number | string | null;
    units: number | string | null;
    cogs: number | string | null;
    opex: number | string | null;
    closing_cash: number | string | null;
    inventory: number | string | null;
    receivables: number | string | null;
    payables: number | string | null;
    source_reference: string;
    verified: boolean;
  }>`select plan_month,revenue,units,cogs,opex,closing_cash,inventory,receivables,payables,source_reference,verified
       from vyndi_monthly_actuals order by plan_month`;
  const actuals: ActualsMap = {};
  const num = (value: number | string | null) => (value == null ? null : Number(value));
  for (const row of rows) {
    actuals[Number(row.plan_month)] = {
      revenue: num(row.revenue),
      units: num(row.units),
      cogs: num(row.cogs),
      opex: num(row.opex),
      closingCash: num(row.closing_cash),
      inventory: num(row.inventory),
      receivables: num(row.receivables),
      payables: num(row.payables),
      sourceReference: row.source_reference,
      verified: Boolean(row.verified),
    };
  }
  return actuals;
});

export const saveMonthlyActual = createServerFn({ method: "POST" })
  .validator(actualSchema)
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();
    const a = data.actual;
    await sql.query(
      `select save_vyndi_monthly_actual($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [data.month,a.revenue ?? null,a.units ?? null,a.cogs ?? null,a.opex ?? null,a.closingCash ?? null,
       a.inventory ?? null,a.receivables ?? null,a.payables ?? null,a.sourceReference ?? "",a.verified ?? false,
       actor.userId,actor.role],
    );
    return { ok: true, month: data.month };
  });

export const clearMonthlyActual = createServerFn({ method: "POST" })
  .validator(z.object({ month: z.number().int().min(1).max(36) }))
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();
    const rows = await sql.query<{ revision: number | string }>(
      `select clear_vyndi_monthly_actual($1,$2,$3) as revision`,
      [data.month, actor.userId, actor.role],
    );
    return { ok: true, month: data.month, revision: Number(rows[0]?.revision ?? 0) };
  });
