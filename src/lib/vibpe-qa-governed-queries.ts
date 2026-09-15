import type { Sql } from "@/lib/db";
import { buildModelWithInputs, type FinanceAssumptions, type ScenarioId } from "@/lib/finance/model";

const n = (value: unknown) => Number(value ?? 0);
const text = (value: unknown) => String(value ?? "").trim();
const lakh = (value: unknown) => `₹${n(value).toFixed(2)}L`;

function isCashLedgerQuestion(question: string) {
  const q = question.toLowerCase();
  return /\bcash\b/.test(q) && /ledger|canonical|actual|reconcil|snapshot|stale|current/.test(q);
}

async function cashLedgerAnswer(sql: Sql) {
  const [cash] = await sql.query<{
    plan_month: number | string;
    closing_cash_lakh: number | string;
    source_reference: string | null;
    verified: boolean;
    updated_at: string | null;
  }>(`
    select ca.plan_month,ca.closing_cash_lakh,ca.source_reference,ca.verified,ca.updated_at::text
      from vyndi_cash_authority ca
      join vyndi_monthly_actuals a on a.plan_month=ca.plan_month
     where a.closing_cash is not null and ca.verified=true
     order by ca.plan_month desc,ca.updated_at desc nulls last
     limit 1
  `);
  const [run] = await sql.query<{
    id: string;
    approved_plan_revision: number | string;
    created_at: string;
    input_hash: string;
    cash_json: Array<Record<string, unknown>> | null;
  }>(`
    select id,approved_plan_revision,created_at::text,input_hash,result_json->'cash' as cash_json
      from vyndi_ibpe_runs
     where status='complete'
     order by created_at desc
     limit 1
  `);

  if (!cash) {
    return [
      "Cash ledger reconciliation: UNCONFIRMED — no verified closing-cash actual is available in canonical cash authority.",
      "The governed IBPE liquidity figure is planning truth, not current cash ledger truth, and must not be substituted for a missing verified bank/ledger closing balance.",
      "Evidence: vyndi_cash_authority backed by verified monthly actuals. Controlled next action: post/reconcile the closing-cash actual with bank/ledger evidence in the Finance workspace; VIBPE remains advisory and cannot post it automatically.",
    ].join("\n\n");
  }

  const runCash = Array.isArray(run?.cash_json)
    ? run!.cash_json.find((row) => n(row.period) === n(cash.plan_month))
    : undefined;
  const planningClosing = runCash ? n(runCash.closingCashLakh) : undefined;
  const updatedAt = cash.updated_at ? new Date(cash.updated_at).getTime() : NaN;
  const runAt = run?.created_at ? new Date(run.created_at).getTime() : NaN;
  const stale = Number.isFinite(updatedAt) && Number.isFinite(runAt) && runAt < updatedAt;
  const freshness = !run
    ? "No complete governed IBPE snapshot exists for comparison."
    : stale
      ? `STALE: latest governed IBPE ${run.id} was created before the canonical cash update, so it cannot contain that latest ledger closing-cash actual.`
      : "Timestamp check is current-compatible, but timestamp alone does not prove that the ledger closing-cash actual was consumed by the planning model; inclusion remains unconfirmed unless input lineage records it explicitly.";

  return [
    `Cash ledger reconciliation: canonical cash actual is ${lakh(cash.closing_cash_lakh)} at M${n(cash.plan_month)}${cash.source_reference ? ` from ${cash.source_reference}` : ""}.`,
    run
      ? `Latest governed IBPE snapshot is R${n(run.approved_plan_revision)} · ${run.id} · input ${run.input_hash.slice(0, 8)}. Its M${n(cash.plan_month)} planning closing cash is ${planningClosing == null ? "not available" : lakh(planningClosing)}. Ledger actual and planning liquidity are separate truth classes.`
      : "Latest governed IBPE snapshot: unavailable.",
    `Freshness: ${freshness}`,
    "Evidence: vyndi_cash_authority / verified monthly actual versus latest governed IBPE snapshot. Controlled next action: reconcile any variance or stale snapshot by refreshing the governed IBPE run after Finance actuals are verified. VIBPE is advisory and does not post cash, draw funding, or alter ledger data automatically.",
  ].join("\n\n");
}

function isInventoryCommitmentQuestion(question: string) {
  const q = question.toLowerCase();
  return /inventory|\batp\b|reservation|reserved|sku shortage|open purchase orders?|open po/.test(q)
    && /committed|confirmed|current|mask|shortage|position/.test(q);
}

async function inventoryCommitmentAnswer(sql: Sql) {
  const rows = await sql.query<{
    sku: string;
    physical_qty: number | string;
    committed_reserved_qty: number | string;
    atp_qty: number | string;
    open_po_qty: number | string;
    committed_requirement: number | string;
    net_committed_shortage: number | string;
  }>(`
    with committed as (
      select sku,sum(committed_requirement)::numeric as committed_requirement,
             sum(net_committed_shortage)::numeric as net_committed_shortage
        from vyndi_committed_procurement_requirements
       group by sku
    )
    select r.sku,r.physical_qty,r.committed_reserved_qty,r.atp_qty,r.open_po_qty,
           coalesce(c.committed_requirement,0) as committed_requirement,
           coalesce(c.net_committed_shortage,0) as net_committed_shortage
      from vyndi_report_procurement_net_requirement r
      left join committed c on c.sku=r.sku
     where coalesce(c.committed_requirement,0)>0 or coalesce(r.committed_reserved_qty,0)>0 or coalesce(c.net_committed_shortage,0)>0
     order by coalesce(c.net_committed_shortage,0) desc,r.sku
  `);
  const shortageRows = rows.filter((row) => n(row.net_committed_shortage) > 0);
  const physical = rows.reduce((sum, row) => sum + n(row.physical_qty), 0);
  const reserved = rows.reduce((sum, row) => sum + n(row.committed_reserved_qty), 0);
  const atp = rows.reduce((sum, row) => sum + n(row.atp_qty), 0);
  const openPo = rows.reduce((sum, row) => sum + n(row.open_po_qty), 0);
  const shortage = rows.reduce((sum, row) => sum + n(row.net_committed_shortage), 0);

  return [
    `Inventory commitment position: ${rows.length} committed/reserved SKU${rows.length === 1 ? "" : "s"}; physical ${physical.toFixed(1)}, committed reserved ${reserved.toFixed(1)}, ATP ${atp.toFixed(1)}, net committed shortage ${shortage.toFixed(1)}, open PO ${openPo.toFixed(1)}.`,
    shortageRows.length
      ? `Current committed shortages: ${shortageRows.slice(0, 10).map((row) => `${row.sku}: shortage ${n(row.net_committed_shortage).toFixed(1)}, physical ${n(row.physical_qty).toFixed(1)}, reserved ${n(row.committed_reserved_qty).toFixed(1)}, ATP ${n(row.atp_qty).toFixed(1)}, open PO ${n(row.open_po_qty).toFixed(1)}`).join("; ")}.`
      : "Current committed shortage: no committed SKU shortage is present in the live reconciliation view.",
    "Semantics: physical stock, reservation and ATP are current inventory truth; open PO is expected supply/commitment evidence and is not on-hand stock. A reservation or open PO must not mask a positive net committed shortage.",
    "Evidence: live vyndi_report_procurement_net_requirement plus committed procurement requirements. Controlled next action: reconcile anomalies in Inventory/Procurement and cover exact shortages through authorised replenishment or approved substitution. VIBPE is advisory and does not mutate stock, reservations, or POs automatically.",
  ].join("\n\n");
}

function isJobTravellerQuestion(question: string) {
  const q = question.toLowerCase();
  return /job\s*cards?|job-card/.test(q) && /traveller|traveler|blocked|release/.test(q);
}

async function jobTravellerAnswer(sql: Sql) {
  const rows = await sql.query<{
    sales_order_id: string;
    job_card_id: string;
    job_card_status: string;
    shortage_qty: number | string;
    traveller_count: number | string;
  }>(`
    select o.id as sales_order_id,jc.id as job_card_id,jc.status as job_card_status,
           coalesce(req.shortage_qty,0) as shortage_qty,
           coalesce(tr.traveller_count,0) as traveller_count
      from vyndi_sales_orders o
      join epr_production_job_cards jc
        on jc.sales_order_id=o.id and jc.sales_order_revision=o.revision
      left join lateral (
        select coalesce(sum(r.shortage_quantity) filter (where r.sku is not null and coalesce(r.issue_status,'')<>'issued'),0)::numeric as shortage_qty
          from vyndi_live_job_card_requirements r where r.job_card_id=jc.id
      ) req on true
      left join lateral (
        select count(*) filter (where t.status<>'rejected')::int as traveller_count
          from epr_travellers t where t.job_card_id=jc.id
      ) tr on true
     where o.status='confirmed' and jc.status in ('released','in_progress')
     order by o.plan_month,o.id,jc.id
  `);
  const missingTraveller = rows.filter((row) => n(row.traveller_count) === 0);
  const materialBlocked = rows.filter((row) => n(row.shortage_qty) > 0);
  const details = rows.slice(0, 12).map((row) =>
    `${row.sales_order_id} → ${row.job_card_id} [${row.job_card_status}]: material shortage ${n(row.shortage_qty).toFixed(1)}, Traveller ${n(row.traveller_count) ? `${n(row.traveller_count).toFixed(0)} present` : "MISSING"}`,
  );

  return [
    `Job-card / Traveller status: ${rows.length} active current-revision job card${rows.length === 1 ? "" : "s"} for confirmed orders; ${missingTraveller.length} have no Traveller and ${materialBlocked.length} remain material-blocked.`,
    details.length ? details.join("; ") + "." : "No active confirmed-order job cards are currently recorded.",
    "Semantics: a released/in-progress job card is not production completion, and a Traveller is execution/genealogy evidence rather than a substitute for material or Quality release gates.",
    "Evidence: confirmed sales orders → epr_production_job_cards → live job-card material requirements → epr_travellers. Controlled next action: clear exact material blockers and start/complete the governed Traveller in Production. VIBPE is advisory and cannot release production or fabricate Traveller evidence.",
  ].join("\n\n");
}

function isActualVsPlanQuestion(question: string) {
  const q = question.toLowerCase();
  const actualsSubject = /transaction[-\s]?derived|monthly actuals?|actual (?:units?|revenue|sales|receivables?)|units? and revenue/.test(q);
  const reconciliation = /plan|forecast|reconcil|variance|separate/.test(q);
  return actualsSubject && reconciliation;
}

async function actualVsPlanAnswer(sql: Sql) {
  const [plan] = await sql.query<{
    id: string;
    revision: number | string;
    scenario: ScenarioId;
    draw_standby: boolean;
    finance_json: FinanceAssumptions;
  }>(`
    select id,revision,scenario,draw_standby,finance_json
      from vyndi_plan_revisions
     where status='approved'
     order by revision desc
     limit 1
  `);
  const actuals = await sql.query<{
    plan_month: number | string;
    revenue: number | string;
    units: number | string;
    receivables: number | string;
  }>(`
    select plan_month,revenue,units,receivables
      from vyndi_monthly_transaction_actuals
     where revenue<>0 or units<>0 or receivables<>0
     order by plan_month desc
     limit 6
  `);

  if (!plan) {
    return "Actual-vs-plan reconciliation: BLOCKED — no approved operating plan exists. Transaction-derived actual remains actual truth and must not be relabelled as plan or forecast. VIBPE is advisory.";
  }
  const model = buildModelWithInputs(plan.scenario, Boolean(plan.draw_standby), plan.finance_json);
  const rows = actuals
    .map((actual) => {
      const month = n(actual.plan_month);
      const planned = model.find((row) => row.m === month);
      return {
        month,
        actualUnits: n(actual.units),
        actualRevenue: n(actual.revenue),
        plannedUnits: planned?.units,
        plannedRevenue: planned?.revenue,
      };
    })
    .sort((a, b) => a.month - b.month);

  return [
    `Actual-vs-plan reconciliation: approved plan ${plan.id} R${n(plan.revision)} versus ${rows.length} recent transaction-derived actual month${rows.length === 1 ? "" : "s"}.`,
    rows.length
      ? rows.map((row) => row.plannedUnits == null
        ? `M${row.month}: actual ${row.actualUnits.toFixed(0)} units / ${lakh(row.actualRevenue)} revenue; no plan row available.`
        : `M${row.month}: actual ${row.actualUnits.toFixed(0)} vs plan ${row.plannedUnits.toFixed(0)} units (variance ${(row.actualUnits - row.plannedUnits).toFixed(0)}); actual revenue ${lakh(row.actualRevenue)} vs plan ${lakh(row.plannedRevenue)} (variance ${lakh(row.actualRevenue - Number(row.plannedRevenue ?? 0))}).`).join("; ")
      : "No non-zero transaction-derived monthly actuals are currently available for recent-month comparison.",
    "Truth classes: vyndi_monthly_transaction_actuals is actual transaction truth; the approved operating model is plan truth; forecast/scenario remains separate and must not overwrite either class.",
    "Evidence: current transaction-derived actuals plus the current approved plan model. Controlled next action: review material variances and create an auditable plan revision only if management accepts a changed outlook. VIBPE is advisory and cannot rewrite actuals or approve a plan revision automatically.",
  ].join("\n\n");
}

export async function tryVibpeQaGovernedDataAnswer(sql: Sql, question: string) {
  if (isCashLedgerQuestion(question)) return cashLedgerAnswer(sql);
  if (isInventoryCommitmentQuestion(question)) return inventoryCommitmentAnswer(sql);
  if (isJobTravellerQuestion(question)) return jobTravellerAnswer(sql);
  if (isActualVsPlanQuestion(question)) return actualVsPlanAnswer(sql);
  return undefined;
}