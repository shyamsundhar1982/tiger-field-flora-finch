import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";
import { requireBusinessActor } from "@/lib/business-actor";

async function requireView() {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Finance & Governance authority view permission denied.");
  return role;
}

const rows = (value: unknown) => (Array.isArray(value) ? [...value] : []);

export const listCanonicalCashAuthority = createServerFn({ method: "GET" }).handler(async () => {
  await requireView();
  const sql = await getSql();
  const result = await sql`
    select plan_month,closing_cash_lakh,receivables_lakh,inventory_lakh,payables_lakh,
           transaction_revenue_lakh,transaction_units,source_reference,verified,updated_at
      from vyndi_cash_authority
     order by plan_month
  `;
  return rows(result);
});

export const listCanonicalBalanceSheetAuthority = createServerFn({ method: "GET" }).handler(async () => {
  await requireView();
  const sql = await getSql();
  const result = await sql`
    select *
      from vyndi_balance_sheet_authority
     order by plan_month,revision desc
  `;
  return rows(result);
});

export const listCanonicalRiskAuthority = createServerFn({ method: "GET" }).handler(async () => {
  await requireView();
  const sql = await getSql();
  const result = await sql`
    select *
      from vyndi_risk_register
     order by case likelihood when 'High' then 1 when 'Med' then 2 else 3 end,
              case impact when 'High' then 1 when 'Med' then 2 else 3 end,id
  `;
  return rows(result);
});

export const listCanonicalLegalAuthority = createServerFn({ method: "GET" }).handler(async () => {
  await requireView();
  const sql = await getSql();
  const result = await sql`
    select *
      from vyndi_legal_register
     order by case priority when 'Critical' then 1 when 'High' then 2 when 'Med' then 3 else 4 end,
              register_type,id
  `;
  return rows(result);
});

const statementSchema = z.object({
  id: z.string().trim().min(1).max(120),
  planMonth: z.number().int().min(1).max(36),
  asOfDate: z.string().min(10).max(10),
  cashLakh: z.number().finite(),
  receivablesLakh: z.number().min(0),
  inventoryLakh: z.number().min(0),
  fixedAssetsLakh: z.number().min(0),
  otherAssetsLakh: z.number().min(0).default(0),
  payablesLakh: z.number().min(0),
  debtLakh: z.number().min(0),
  otherLiabilitiesLakh: z.number().min(0).default(0),
  equityLakh: z.number().finite(),
  retainedEarningsLakh: z.number().finite(),
  sourceReference: z.string().trim().min(1).max(500),
});

export const postFinancialStatementSnapshot = createServerFn({ method: "POST" })
  .validator(statementSchema)
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("approve");
    const assets =
      data.cashLakh +
      data.receivablesLakh +
      data.inventoryLakh +
      data.fixedAssetsLakh +
      data.otherAssetsLakh;
    const liabilitiesEquity =
      data.payablesLakh +
      data.debtLakh +
      data.otherLiabilitiesLakh +
      data.equityLakh +
      data.retainedEarningsLakh;
    const balanceError = assets - liabilitiesEquity;
    if (Math.abs(balanceError) > 0.01) {
      throw new Error(`Financial statement is not balanced: assets ${assets.toFixed(2)}L vs liabilities/equity ${liabilitiesEquity.toFixed(2)}L.`);
    }
    const sql = await getSql();
    const current = await sql<{ revision: number | string }>`
      select revision from vyndi_financial_statement_snapshots
       where plan_month=${data.planMonth} and status='posted'
       order by revision desc limit 1
    `;
    const nextRevision = Number(current[0]?.revision ?? 0) + 1;
    await sql`
      update vyndi_financial_statement_snapshots
         set status='superseded',superseded_at=now()
       where plan_month=${data.planMonth} and status='posted'
    `;
    await sql`
      insert into vyndi_financial_statement_snapshots (
        id,plan_month,revision,as_of_date,cash_lakh,receivables_lakh,inventory_lakh,
        fixed_assets_lakh,other_assets_lakh,payables_lakh,debt_lakh,other_liabilities_lakh,
        equity_lakh,retained_earnings_lakh,source_reference,status,created_by,approved_by,approved_at
      ) values (
        ${data.id},${data.planMonth},${nextRevision},${data.asOfDate}::date,${data.cashLakh},
        ${data.receivablesLakh},${data.inventoryLakh},${data.fixedAssetsLakh},${data.otherAssetsLakh},
        ${data.payablesLakh},${data.debtLakh},${data.otherLiabilitiesLakh},${data.equityLakh},
        ${data.retainedEarningsLakh},${data.sourceReference},'posted',${actor.userId},${actor.userId},now()
      )
    `;
    await sql`
      insert into vyndi_audit_events (
        id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,
        source_reference,payload_json,correlation_id,gate_id,gate_result
      ) values (
        ${crypto.randomUUID()},'financial_statement_snapshot',${data.id},${nextRevision},
        'FINANCIAL_STATEMENT_POSTED',${actor.userId},${actor.role},${data.sourceReference},
        ${JSON.stringify({ planMonth: data.planMonth, assets, liabilitiesEquity, balanceError })}::jsonb,
        ${`FINANCE|M${data.planMonth}|R${nextRevision}`},'G13-FINANCE','pass'
      )
    `;
    return { ok: true, id: data.id, revision: nextRevision, balanceError };
  });

export const transitionRiskRegisterItem = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().trim().min(1).max(120),
      status: z.enum(["open", "mitigating", "accepted", "closed"]),
      mitigation: z.string().trim().min(1).max(2000),
      sourceReference: z.string().trim().min(1).max(500),
    }),
  )
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor(data.status === "accepted" || data.status === "closed" ? "approve" : "edit");
    const sql = await getSql();
    const current = await sql<{ status: string; revision: number | string }>`
      select status,record_revision as revision from vyndi_risk_register where id=${data.id} limit 1
    `;
    if (!current[0]) throw new Error("Risk register item not found.");
    const revision = Number(current[0].revision) + 1;
    await sql`
      update vyndi_risk_register
         set status=${data.status},mitigation=${data.mitigation},source_reference=${data.sourceReference},
             record_revision=${revision},updated_by=${actor.userId},updated_at=now()
       where id=${data.id}
    `;
    await sql`
      insert into vyndi_audit_events (
        id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,
        payload_json,correlation_id,previous_state,new_state
      ) values (
        ${crypto.randomUUID()},'risk_register_item',${data.id},${revision},'RISK_STATUS_CHANGED',
        ${actor.userId},${actor.role},${data.sourceReference},
        ${JSON.stringify({ mitigation: data.mitigation })}::jsonb,${`RISK|${data.id}`},
        ${current[0].status},${data.status}
      )
    `;
    return { ok: true, id: data.id, status: data.status, revision };
  });

export const transitionLegalRegisterItem = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().trim().min(1).max(120),
      status: z.enum(["planned", "in_progress", "filed", "executed", "active", "closed", "superseded"]),
      notes: z.string().max(2000).default(""),
      sourceReference: z.string().trim().min(1).max(500),
    }),
  )
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor(["filed", "executed", "active", "closed", "superseded"].includes(data.status) ? "approve" : "edit");
    const sql = await getSql();
    const current = await sql<{ status: string; revision: number | string }>`
      select status,record_revision as revision from vyndi_legal_register where id=${data.id} limit 1
    `;
    if (!current[0]) throw new Error("Legal register item not found.");
    const revision = Number(current[0].revision) + 1;
    await sql`
      update vyndi_legal_register
         set status=${data.status},notes=${data.notes},source_reference=${data.sourceReference},
             record_revision=${revision},updated_by=${actor.userId},updated_at=now()
       where id=${data.id}
    `;
    await sql`
      insert into vyndi_audit_events (
        id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,
        payload_json,correlation_id,previous_state,new_state
      ) values (
        ${crypto.randomUUID()},'legal_register_item',${data.id},${revision},'LEGAL_STATUS_CHANGED',
        ${actor.userId},${actor.role},${data.sourceReference},
        ${JSON.stringify({ notes: data.notes })}::jsonb,${`LEGAL|${data.id}`},
        ${current[0].status},${data.status}
      )
    `;
    return { ok: true, id: data.id, status: data.status, revision };
  });