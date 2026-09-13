import { createServerFn } from "@tanstack/react-start";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";
import { requireBusinessActor } from "@/lib/business-actor";
import { getSql } from "@/lib/db";
import { tryGovernanceDataAnswer } from "@/lib/vibpe-governance-queries";
import { tryVibpeLiveSpecialistAnswer } from "@/lib/vibpe-live-specialist-queries";
import { answerGovernedOptimizerExecutionRequest } from "@/lib/vibpe-optimizer-copilot";

function normalizeSpecialistQuestion(question: string) {
  return question.replaceAll("\u2019", "'").replaceAll("\u2018", "'");
}

function normalized(question: string) {
  return normalizeSpecialistQuestion(question).toLowerCase().replace(/\s+/g, " ").trim();
}

function isConfirmedOrderCountQuestion(question: string) {
  const q = normalized(question);
  return /\bhow many\b/.test(q)
    && /\b(customer\s+)?orders?\b/.test(q)
    && /\bconfirmed\b/.test(q)
    && /\bunits?\b/.test(q);
}

function isConfirmedOrderMissingJobCardQuestion(question: string) {
  const q = normalized(question);
  return /\bconfirmed\b[^.?!]{0,40}\borders?\b|\borders?\b[^.?!]{0,40}\bconfirmed\b/.test(q)
    && /\b(no|without|missing)\b[^.?!]{0,50}\b(job\s*card|production\s+job\s*card)\b/.test(q);
}

function isExactCommittedShortageQuestion(question: string) {
  const q = normalized(question);
  return /\bconfirmed[- ]order\b|\bconfirmed\s+orders?\b|\bcommitted\b/.test(q)
    && /\bshortage|shortages|short\b/.test(q)
    && /\bprocure|procurement|purchase|need|now\b/.test(q);
}

function isDraftPoLineageQuestion(question: string) {
  const q = normalized(question);
  return /\bdraft\s+(?:purchase\s+orders?|pos?)\b/.test(q)
    && /\bhow many|which\b/.test(q)
    && /\b(job\s*card|confirmed\s+order|generated|originat|linked)\b/.test(q);
}

function isDraftPoMissingSupplierQuestion(question: string) {
  const q = normalized(question);
  return /\bdraft\s+(?:purchase\s+orders?|pos?)\b/.test(q)
    && /\b(no|without|missing|unassigned)\b[^.?!]{0,40}\bsupplier\b/.test(q);
}

function isSupplierRatingGapQuestion(question: string) {
  const q = normalized(question);
  return /\bsuppliers?\b/.test(q)
    && /\b(lack|lacks|missing|without|no)\b/.test(q)
    && /\b(quality|delivery)\s+ratings?\b/.test(q);
}

function isBomToJobCardAuditQuestion(question: string) {
  const q = normalized(question);
  return /\bbom\b/.test(q)
    && /\bjob[- ]?card\b/.test(q)
    && /\b(match|matches|explosion|released|component|components|complete|consistent)\b/.test(q);
}

function isExactOperationalControlQuestion(question: string) {
  const q = normalized(question);
  const governedObject = /\b(job[- ]?cards?|sales\s+orders?|confirmed\s+orders?|bom|skus?|stock|inventory|reservations?|atp|purchase\s+orders?|draft\s+pos?|suppliers?|grn|goods\s+receipts?|quality\s+ratings?|delivery\s+ratings?|routing|work\s+centres?|capacity\s+standards?|capable[- ]to[- ]promise|ctp)\b/.test(q);
  const exactControl = /\b(which|what|how many|are any|does every|do all|can every|is current|exact|missing|without|no\b|duplicate|duplicated|approved|unapproved|reconcile|match|linked|trace|greater|negative|zero|obsolete|cancelled|superseded|receipt|due|rating|authority|overloaded|loaded|persisted|provisional|sufficient|lifecycle|physical|reserved)\b/.test(q);
  return governedObject && exactControl;
}

function exactControlFallback(question: string) {
  return [
    "Exact operational-control answer: NOT VERIFIED — specialist reconciliation is required.",
    `The question “${question}” asks for an exact governed-record control check. No exact specialist handler matched, so VIBPE will not substitute a planning summary, traceability lookup, knowledge-pack excerpt, or generic recommendation.`,
    "Controlled next action: run the check against the owning live ledger(s) and return PASS/FAIL/UNKNOWN with the exact exception rows and source authority. Until that handler is implemented, this result must not be treated as evidence that the control passed.",
  ].join("\n\n");
}

async function confirmedOrderCountAnswer(sql: Awaited<ReturnType<typeof getSql>>) {
  const [row] = await sql.query<{ order_count: string | number; unit_count: string | number }>(`
    select count(*)::int as order_count,
           coalesce(sum(units),0)::numeric as unit_count
      from vyndi_sales_orders
     where status='confirmed'
  `);
  const orders = Number(row?.order_count ?? 0);
  const units = Number(row?.unit_count ?? 0);
  return `Confirmed customer demand: ${orders} confirmed order${orders === 1 ? "" : "s"}, representing ${units.toFixed(0)} unit${units === 1 ? "" : "s"}. Evidence: live vyndi_sales_orders rows with status=confirmed.`;
}

async function confirmedOrderMissingJobCardAnswer(sql: Awaited<ReturnType<typeof getSql>>) {
  const rows = await sql.query<{
    sales_order_id: string;
    sales_order_revision: string | number;
    variant_name: string | null;
    job_card_id: string | null;
  }>(`
    select o.id as sales_order_id,
           o.revision as sales_order_revision,
           coalesce(o.variant_name,o.variant_id,o.product_id) as variant_name,
           jc.id as job_card_id
      from vyndi_sales_orders o
      left join lateral (
        select c.id
          from epr_production_job_cards c
         where c.sales_order_id=o.id
           and c.sales_order_revision=o.revision
         order by c.updated_at desc,c.created_at desc,c.id desc
         limit 1
      ) jc on true
     where o.status='confirmed'
     order by o.plan_month,o.id
  `);
  const missing = rows.filter((row) => !row.job_card_id);
  if (!missing.length) {
    return `Confirmed-order job-card coverage: PASS — 0 of ${rows.length} confirmed orders lack a production job card. Every current confirmed sales-order revision resolves to a job card.`;
  }
  return [
    `Confirmed-order job-card coverage: FAIL — ${missing.length} of ${rows.length} confirmed orders have no production job card.`,
    `Missing: ${missing.map((row) => `${row.sales_order_id} R${Number(row.sales_order_revision)}${row.variant_name ? ` · ${row.variant_name}` : ""}`).join("; ")}.`,
    "Controlled next action: create or restore the governed production job-card linkage before treating these orders as released to production.",
  ].join("\n\n");
}

async function exactCommittedShortageAnswer(sql: Awaited<ReturnType<typeof getSql>>) {
  const rows = await sql.query<{
    sales_order_id: string;
    job_card_id: string;
    sku: string;
    shortage_quantity: string | number;
  }>(`
    select o.id as sales_order_id,
           c.id as job_card_id,
           r.sku,
           r.shortage_quantity
      from vyndi_sales_orders o
      join epr_production_job_cards c
        on c.sales_order_id=o.id
       and c.sales_order_revision=o.revision
      join vyndi_live_job_card_requirements r on r.job_card_id=c.id
     where o.status='confirmed'
       and r.sku is not null
       and coalesce(r.issue_status,'') <> 'issued'
       and coalesce(r.shortage_quantity,0) > 0
     order by o.plan_month,o.id,c.id,r.sku
  `);
  if (!rows.length) return "Exact confirmed-order shortage check: PASS — no uncovered job-card material shortage is recorded for current confirmed orders.";
  const total = rows.reduce((sum, row) => sum + Number(row.shortage_quantity ?? 0), 0);
  return [
    `Exact confirmed-order shortage check: BLOCKED — ${total.toFixed(1)} component units across ${rows.length} order/job-card/SKU shortage rows require coverage.`,
    rows.map((row) => `${row.sales_order_id} · ${row.job_card_id} · ${row.sku}: ${Number(row.shortage_quantity).toFixed(1)} short`).join("; "),
    "Controlled next action: cover each exact shortage with governed stock/reservation, an approved substitute, or an authorised supplier receipt before production release.",
  ].join("\n\n");
}

async function draftPoLineageAnswer(sql: Awaited<ReturnType<typeof getSql>>) {
  const rows = await sql.query<{
    po_id: string;
    job_card_id: string | null;
    sales_order_id: string | null;
    sku: string | null;
    quantity: string | number;
  }>(`
    select p.id as po_id,
           p.job_card_id,
           c.sales_order_id,
           p.sku,
           p.quantity
      from vyndi_purchase_orders p
      left join epr_production_job_cards c on c.id=p.job_card_id
     where p.status='draft'
     order by p.created_at,p.id
  `);
  if (!rows.length) return "Draft-PO lineage: PASS — 0 draft purchase orders exist.";
  return [
    `Draft-PO lineage: ${rows.length} draft purchase order${rows.length === 1 ? "" : "s"}.`,
    rows.map((row) => `${row.po_id} → order ${row.sales_order_id ?? "UNLINKED"} → job card ${row.job_card_id ?? "UNLINKED"} → ${row.sku ?? "SKU MISSING"} × ${Number(row.quantity ?? 0).toFixed(1)}`).join("; "),
    "Governance: draft POs are sourcing intent only; they are not authorised supplier commitments.",
  ].join("\n\n");
}

async function draftPoMissingSupplierAnswer(sql: Awaited<ReturnType<typeof getSql>>) {
  const rows = await sql.query<{
    po_id: string;
    job_card_id: string | null;
    sku: string | null;
    quantity: string | number;
  }>(`
    select id as po_id,job_card_id,sku,quantity
      from vyndi_purchase_orders
     where status='draft'
       and supplier_id is null
     order by created_at,id
  `);
  if (!rows.length) return "Draft-PO supplier assignment: PASS — no draft purchase order is supplier-unassigned.";
  return [
    `Draft-PO supplier assignment: FAIL — ${rows.length} draft PO${rows.length === 1 ? "" : "s"} have no supplier assigned.`,
    rows.map((row) => `${row.po_id} · ${row.job_card_id ?? "job card UNLINKED"} · ${row.sku ?? "SKU MISSING"} × ${Number(row.quantity ?? 0).toFixed(1)}`).join("; "),
    "Controlled next action: assign an approved supplier and validate source/lead-time authority before PO approval or issue.",
  ].join("\n\n");
}

async function supplierRatingGapAnswer(sql: Awaited<ReturnType<typeof getSql>>, question: string) {
  const q = normalized(question);
  const field = /\bquality\s+ratings?\b/.test(q) ? "quality_rating" : "delivery_rating";
  const label = field === "quality_rating" ? "quality" : "delivery";
  const rows = await sql.query<{ id: string; name: string | null }>(`
    select id,name
      from vyndi_suppliers
     where active
       and ${field} is null
     order by coalesce(name,id),id
  `);
  if (!rows.length) return `Supplier ${label}-rating completeness: PASS — every active supplier has a governed ${label} rating.`;
  return [
    `Supplier ${label}-rating completeness: FAIL — ${rows.length} active supplier${rows.length === 1 ? "" : "s"} lack a ${label} rating.`,
    `Missing: ${rows.map((row) => `${row.name ?? row.id} (${row.id})`).join("; ")}.`,
    `Controlled next action: populate governed ${label}-performance evidence before using supplier ranking as decision-grade sourcing authority.`,
  ].join("\n\n");
}

export const askVibpeGovernanceCopilot = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((input: { question: string }) => ({ question: String(input.question ?? "").trim().slice(0, 1800) }))
  .handler(async ({ data, context }) => {
    if (!data.question) return { handled: false as const };
    await requireBusinessActor(
      "view",
      context.userId ? { userId: context.userId, email: context.userEmail } : undefined,
    );
    const sql = await getSql();

    if (isConfirmedOrderCountQuestion(data.question)) {
      return { handled: true as const, answer: await confirmedOrderCountAnswer(sql) };
    }
    if (isConfirmedOrderMissingJobCardQuestion(data.question)) {
      return { handled: true as const, answer: await confirmedOrderMissingJobCardAnswer(sql) };
    }
    if (isExactCommittedShortageQuestion(data.question)) {
      return { handled: true as const, answer: await exactCommittedShortageAnswer(sql) };
    }
    if (isDraftPoLineageQuestion(data.question)) {
      return { handled: true as const, answer: await draftPoLineageAnswer(sql) };
    }
    if (isDraftPoMissingSupplierQuestion(data.question)) {
      return { handled: true as const, answer: await draftPoMissingSupplierAnswer(sql) };
    }
    if (isSupplierRatingGapQuestion(data.question)) {
      return { handled: true as const, answer: await supplierRatingGapAnswer(sql, data.question) };
    }
    if (isBomToJobCardAuditQuestion(data.question)) {
      return { handled: true as const, answer: exactControlFallback(data.question) };
    }

    const optimizerAnswer = await answerGovernedOptimizerExecutionRequest(sql, data.question);
    if (optimizerAnswer) return { handled: true as const, answer: optimizerAnswer };
    const specialistAnswer = await tryVibpeLiveSpecialistAnswer(sql, normalizeSpecialistQuestion(data.question));
    if (specialistAnswer) return { handled: true as const, answer: specialistAnswer };
    const answer = await tryGovernanceDataAnswer(sql, data.question);
    if (answer) return { handled: true as const, answer };

    if (isExactOperationalControlQuestion(data.question)) {
      return { handled: true as const, answer: exactControlFallback(data.question) };
    }
    return { handled: false as const };
  });
