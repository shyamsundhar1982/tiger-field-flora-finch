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
  transactionDerived?: boolean;
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
    verified: z.boolean().optional(),
  }),
});

const nearlyEqual = (a: number, b: number) => Math.abs(a - b) < 0.0001;

export const listMonthlyActuals = createServerFn({ method: "GET" }).handler(async () => {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Actuals view permission denied.");
  const sql = await getSql();
  const rows = await sql.query<{
    plan_month: number | string;
    revenue: number | string;
    units: number | string;
    cogs: number | string | null;
    opex: number | string | null;
    closing_cash: number | string | null;
    inventory: number | string | null;
    receivables: number | string;
    payables: number | string | null;
    source_reference: string | null;
    stored_verified: boolean | null;
    has_transaction: boolean;
    has_stored: boolean;
  }>(`
    select t.plan_month,t.revenue,t.units,a.cogs,a.opex,a.closing_cash,a.inventory,t.receivables,a.payables,
           a.source_reference,a.verified as stored_verified,
           (t.revenue<>0 or t.units<>0 or t.receivables<>0) as has_transaction,
           (a.plan_month is not null) as has_stored
      from vyndi_monthly_transaction_actuals t
      left join vyndi_monthly_actuals a on a.plan_month=t.plan_month
     where a.plan_month is not null or t.revenue<>0 or t.units<>0 or t.receivables<>0
     order by t.plan_month
  `);
  const actuals: ActualsMap = {};
  const num = (value: number | string | null) => (value == null ? null : Number(value));
  for (const row of rows) {
    const transactionDerived = Boolean(row.has_transaction);
    actuals[Number(row.plan_month)] = {
      revenue: Number(row.revenue),
      units: Number(row.units),
      cogs: num(row.cogs),
      opex: num(row.opex),
      closingCash: num(row.closing_cash),
      inventory: num(row.inventory),
      receivables: Number(row.receivables),
      payables: num(row.payables),
      sourceReference: row.source_reference || (transactionDerived ? `transaction-ledger:M${row.plan_month}` : ""),
      verified: transactionDerived || Boolean(row.stored_verified),
      transactionDerived,
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
    const rows = await sql.query<{ revenue:number|string; units:number|string; receivables:number|string }>(
      `select revenue,units,receivables from vyndi_monthly_transaction_actuals where plan_month=$1`,
      [data.month],
    );
    const truth = rows[0];
    if (!truth) throw new Error("Transaction-derived monthly truth is unavailable. Apply Stage 2 migration before posting actuals.");
    const revenue = Number(truth.revenue);
    const units = Number(truth.units);
    const receivables = Number(truth.receivables);

    const protectedInputs: Array<[string, number | null | undefined, number]> = [
      ["Revenue", a.revenue, revenue],
      ["Units", a.units, units],
      ["Receivables", a.receivables, receivables],
    ];
    for (const [label, supplied, canonical] of protectedInputs) {
      if (supplied != null && !nearlyEqual(supplied, canonical)) {
        throw new Error(`${label} is transaction-controlled. Posted value ${supplied} does not reconcile to canonical ${canonical}.`);
      }
    }

    const hasManualValue = [a.cogs,a.opex,a.closingCash,a.inventory,a.payables].some((value) => value != null);
    if (hasManualValue && !a.sourceReference?.trim()) {
      throw new Error("Manual management actuals require a bank/ledger/evidence source reference.");
    }
    const source = [
      `transaction-ledger:M${data.month}`,
      a.sourceReference?.trim() || "",
    ].filter(Boolean).join("; ");

    await sql.query(
      `select save_vyndi_monthly_actual($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [data.month,revenue,units,a.cogs ?? null,a.opex ?? null,a.closingCash ?? null,
       a.inventory ?? null,receivables,a.payables ?? null,source,true,
       actor.userId,actor.role],
    );
    return { ok:true, month:data.month, revenue, units, receivables, verified:true, transactionDerived:true };
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
    return { ok: true, month: data.month, revision: Number(rows[0]?.revision ?? 0), note:"Transaction-derived revenue, units and receivables remain authoritative." };
  });
