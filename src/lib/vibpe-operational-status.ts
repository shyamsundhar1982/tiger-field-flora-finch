import { createServerFn } from "@tanstack/react-start";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";
import { requireBusinessActor } from "@/lib/business-actor";
import { getSql } from "@/lib/db";
import { canAccessRoute, type CommandRole } from "@/lib/page-access";

type OperationalStatusIntent =
  | "customer_orders"
  | "purchase_orders"
  | "supplier_purchase_orders"
  | "job_cards"
  | "grn_pending"
  | "dispatch_pending"
  | "invoice_pending";

type OperationalInterpretation = {
  recognized: boolean;
  intent?: OperationalStatusIntent;
};

type SupplierRow = {
  id: string;
  name: string;
};

type PurchaseOrderRow = {
  id: string;
  sku: string;
  quantity: string | number;
  unit_price_inr: string | number;
  status: string;
  expected_receipt_on: string | null;
  job_card_id: string | null;
  supplier_name?: string | null;
};

const OPEN_PO_STATUSES = new Set([
  "draft",
  "pending_approval",
  "approved",
  "issued",
  "sent",
  "acknowledged",
  "part_received",
  "partially_received",
  "open",
  "ordered",
]);

const CLOSED_ORDER_STATUSES = new Set(["delivered", "closed", "cancelled", "canceled", "void"]);
const CLOSED_JOB_STATUSES = new Set(["completed", "complete", "closed", "cancelled", "canceled", "void"]);

const ROUTE_BY_INTENT: Record<OperationalStatusIntent, string> = {
  customer_orders: "/command/sales",
  purchase_orders: "/command/purchase-execution",
  supplier_purchase_orders: "/command/purchase-execution",
  job_cards: "/command/production",
  grn_pending: "/command/receiving",
  dispatch_pending: "/command/operations",
  invoice_pending: "/command/receivables",
};

const INTENT_LABEL: Record<OperationalStatusIntent, string> = {
  customer_orders: "Pending customer orders",
  purchase_orders: "Pending purchase orders",
  supplier_purchase_orders: "Supplier pending purchase orders",
  job_cards: "Job Cards",
  grn_pending: "Pending receipt / GRN",
  dispatch_pending: "Pending dispatch",
  invoice_pending: "Pending invoice",
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function hasExplicitTraceReference(question: string) {
  return /\b(?:so|jbc|po|grn|mr|batch|vyndi|autopo|vibpe-autopo)[-_][a-z0-9][a-z0-9-]*\b/i.test(question);
}

function addIntent(intents: OperationalStatusIntent[], intent: OperationalStatusIntent) {
  if (!intents.includes(intent)) intents.push(intent);
}

export function interpretOperationalStatusQueries(question: string): OperationalStatusIntent[] {
  if (hasExplicitTraceReference(question)) return [];

  const q = normalize(question);
  const intents: OperationalStatusIntent[] = [];
  const supplierish = /\bsupplier\b|\bsupplies\b|\bsupply\b|\boda\b|\bfrom\b/.test(q);

  const customerOrders =
    /\b(?:pending|open|outstanding|waiting)\s+(?:(?:customer|sales|commercial)\s+)?orders?\b/.test(q) ||
    /\b(?:(?:customer|sales|commercial)\s+)?orders?\s+(?:pending|open|outstanding|waiting)\b/.test(q);
  const purchaseOrders =
    /\b(?:pending|open|outstanding|waiting)\s+(?:purchase\s+orders?|pos?)\b/.test(q) ||
    /\b(?:purchase\s+orders?|pos?)\s+(?:pending|open|outstanding|waiting)\b/.test(q);
  const jobCards =
    /\b(?:jbc|job\s*cards?)\b[^?.]{0,80}\b(?:raised|created|open|pending|current|status)\b/.test(q) ||
    /\b(?:raised|created|open|pending|current|status)\b[^?.]{0,80}\b(?:jbc|job\s*cards?)\b/.test(q);
  const receipts =
    /\b(?:pending|open|outstanding|waiting)\s+(?:grns?|goods\s+receipts?|receipts?|receiving)\b/.test(q) ||
    /\b(?:grns?|goods\s+receipts?|receipts?|receiving)\s+(?:pending|open|outstanding|waiting)\b/.test(q);
  const dispatches =
    /\b(?:pending|open|outstanding|waiting)\s+(?:dispatch(?:es)?|shipments?|shipping)\b/.test(q) ||
    /\b(?:dispatch(?:es)?|shipments?|shipping)\s+(?:pending|open|outstanding|waiting)\b/.test(q);
  const invoices =
    /\b(?:pending|open|outstanding|waiting)\s+(?:invoices?|receivables?|billing)\b/.test(q) ||
    /\b(?:invoices?|receivables?|billing)\s+(?:pending|open|outstanding|waiting)\b/.test(q);

  if (customerOrders) addIntent(intents, "customer_orders");
  if (jobCards) addIntent(intents, "job_cards");
  if (purchaseOrders) addIntent(intents, supplierish ? "supplier_purchase_orders" : "purchase_orders");
  if (receipts) addIntent(intents, "grn_pending");
  if (dispatches) addIntent(intents, "dispatch_pending");
  if (invoices) addIntent(intents, "invoice_pending");

  return intents;
}

export function interpretOperationalStatusQuery(question: string): OperationalInterpretation {
  const [intent] = interpretOperationalStatusQueries(question);
  return intent ? { recognized: true, intent } : { recognized: false };
}

function supplierMatchScore(question: string, supplierName: string) {
  const q = ` ${normalize(question)} `;
  const tokens = normalize(supplierName)
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !["test", "supplier", "suppliers", "cycles", "cycle"].includes(token));
  return tokens.reduce((score, token) => score + (q.includes(` ${token} `) ? 1 : 0), 0);
}

function openPo(status: string) {
  return OPEN_PO_STATUSES.has(normalize(status).replace(/\s+/g, "_"));
}

function fmtPo(order: PurchaseOrderRow) {
  const value = Number(order.quantity ?? 0) * Number(order.unit_price_inr ?? 0);
  return `${order.id} · ${order.sku} · qty ${Number(order.quantity ?? 0).toFixed(1)} · ₹${value.toFixed(0)} · ${clean(order.status)}${order.expected_receipt_on ? ` · ETA ${order.expected_receipt_on}` : ""}${order.job_card_id ? ` · ${order.job_card_id}` : ""}`;
}

async function supplierPendingPoAnswer(sql: Awaited<ReturnType<typeof getSql>>, question: string) {
  const suppliers = await sql.query<SupplierRow>(`
    select id,name
      from vyndi_suppliers
     order by active desc,name
  `);
  const ranked = suppliers
    .map((supplier) => ({ supplier, score: supplierMatchScore(question, supplier.name) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    return "Pending supplier POs: I could not identify the supplier from that wording. Give the supplier name or a partial supplier name.";
  }

  const supplier = ranked[0].supplier;
  const orders = await sql.query<PurchaseOrderRow>(`
    select p.id,p.sku,p.quantity,p.unit_price_inr,p.status,p.expected_receipt_on,p.job_card_id
      from vyndi_purchase_orders p
     where p.supplier_id=$1
     order by p.created_at desc,p.id
     limit 50
  `, [supplier.id]);
  const pending = orders.filter((order) => openPo(order.status));

  if (!pending.length) {
    const received = orders.filter((order) => !openPo(order.status)).slice(0, 5);
    return [
      `${supplier.name} — pending purchase orders: 0.`,
      received.length
        ? `Recent non-open PO evidence: ${received.map((order) => `${order.id} · ${order.sku} qty ${Number(order.quantity ?? 0).toFixed(1)} · ${clean(order.status)}`).join("; ")}.`
        : "No purchase-order records are currently recorded for this supplier.",
      "Only open procurement states are counted as pending; received/closed/cancelled/void records are excluded.",
    ].join("\n\n");
  }

  return [
    `${supplier.name} — pending purchase orders: ${pending.length}.`,
    pending.slice(0, 12).map(fmtPo).join("\n"),
    pending.length > 12 ? `${pending.length - 12} more open PO(s) are available in Purchase Execution.` : "",
  ].filter(Boolean).join("\n\n");
}

async function purchaseOrdersAnswer(sql: Awaited<ReturnType<typeof getSql>>) {
  const rows = await sql.query<PurchaseOrderRow>(`
    select p.id,p.sku,p.quantity,p.unit_price_inr,p.status,p.expected_receipt_on,p.job_card_id,
           coalesce(s.name,p.supplier_id,'Supplier not assigned') as supplier_name
      from vyndi_purchase_orders p
      left join vyndi_suppliers s on s.id=p.supplier_id
     order by p.created_at desc,p.id
     limit 100
  `);
  const pending = rows.filter((row) => openPo(row.status));
  if (!pending.length) return "Pending purchase orders: 0. No open procurement PO is currently recorded.";
  return [
    `Pending purchase orders: ${pending.length}.`,
    pending.slice(0, 15).map((row) => `${row.supplier_name ?? "Supplier not assigned"} · ${fmtPo(row)}`).join("\n"),
    pending.length > 15 ? `${pending.length - 15} more open PO(s) are available in Purchase Execution.` : "",
  ].filter(Boolean).join("\n\n");
}

async function customerOrdersAnswer(sql: Awaited<ReturnType<typeof getSql>>) {
  const rows = await sql.query<Record<string, unknown>>(`
    with latest as (
      select distinct on (id)
             id,revision,plan_month,units,variant_id,variant_name,status
        from vyndi_sales_orders
       order by id,revision desc
    )
    select * from latest
     order by plan_month,id
  `);
  const open = rows.filter((row) => !CLOSED_ORDER_STATUSES.has(normalize(clean(row.status)).replace(/\s+/g, "_")));
  if (!open.length) return "Pending customer orders: 0. No open commercial order is currently recorded.";
  return [
    `Pending customer orders: ${open.length}.`,
    open.slice(0, 15).map((row) => `${clean(row.id)} R${Number(row.revision ?? 0)} · ${clean(row.variant_name || row.variant_id)} · ${Number(row.units ?? 0)} unit(s) · ${clean(row.status)} · M${Number(row.plan_month ?? 0)}`).join("\n"),
    open.length > 15 ? `${open.length - 15} more open order(s) are available in Commercial.` : "",
  ].filter(Boolean).join("\n\n");
}

async function jobCardsAnswer(sql: Awaited<ReturnType<typeof getSql>>) {
  const rows = await sql.query<Record<string, unknown>>(`
    select id,sales_order_id,sales_order_revision,batch_code,bom_revision,status,created_at::text
      from epr_production_job_cards
     order by created_at desc,id
     limit 80
  `);
  const open = rows.filter((row) => !CLOSED_JOB_STATUSES.has(normalize(clean(row.status)).replace(/\s+/g, "_")));
  const selected = open.length ? open : rows.slice(0, 20);
  if (!selected.length) return "Job Cards raised: 0. No production job card is currently recorded.";
  return [
    `${open.length ? "Open Job Cards" : "Recent Job Cards"}: ${selected.length}.`,
    selected.slice(0, 15).map((row) => `${clean(row.id)} · ${clean(row.sales_order_id)} R${Number(row.sales_order_revision ?? 0)} · ${clean(row.status)}${clean(row.batch_code) ? ` · ${clean(row.batch_code)}` : ""}`).join("\n"),
    selected.length > 15 ? `${selected.length - 15} more Job Card(s) are available in Production.` : "",
  ].filter(Boolean).join("\n\n");
}

async function pendingGrnAnswer(sql: Awaited<ReturnType<typeof getSql>>) {
  const rows = await sql.query<Record<string, unknown>>(`
    select p.id as po_id,p.sku,p.quantity,p.status,coalesce(s.name,p.supplier_id,'Supplier not assigned') as supplier_name,
           coalesce(sum(g.quantity_received),0) as received_qty
      from vyndi_purchase_orders p
      left join vyndi_suppliers s on s.id=p.supplier_id
      left join vyndi_goods_receipts g on g.purchase_order_id=p.id
     group by p.id,p.sku,p.quantity,p.status,s.name,p.supplier_id,p.created_at
     order by p.created_at desc,p.id
  `);
  const pending = rows.filter((row) => openPo(clean(row.status)) && Number(row.received_qty ?? 0) < Number(row.quantity ?? 0));
  if (!pending.length) return "Pending GRN / receiving: 0. No open PO currently has an unreceived quantity.";
  return [
    `Pending GRN / receiving: ${pending.length} PO(s).`,
    pending.slice(0, 15).map((row) => `${clean(row.po_id)} · ${clean(row.supplier_name)} · ${clean(row.sku)} · received ${Number(row.received_qty ?? 0).toFixed(1)} / ${Number(row.quantity ?? 0).toFixed(1)}`).join("\n"),
  ].join("\n\n");
}

async function pendingDispatchAnswer(sql: Awaited<ReturnType<typeof getSql>>) {
  const rows = await sql.query<Record<string, unknown>>(`
    with latest as (
      select distinct on (id) id,revision,plan_month,units,variant_name,variant_id,status
        from vyndi_sales_orders
       order by id,revision desc
    )
    select o.*
      from latest o
     where lower(coalesce(o.status,'')) not in ('delivered','closed','cancelled','canceled','void')
       and not exists (select 1 from vyndi_shipments s where s.sales_order_id=o.id)
     order by o.plan_month,o.id
  `);
  if (!rows.length) return "Pending dispatch: 0. Every currently open commercial order has shipment evidence.";
  return [
    `Pending dispatch: ${rows.length} open order(s) without shipment evidence.`,
    rows.slice(0, 15).map((row) => `${clean(row.id)} R${Number(row.revision ?? 0)} · ${clean(row.variant_name || row.variant_id)} · ${Number(row.units ?? 0)} unit(s) · ${clean(row.status)}`).join("\n"),
  ].join("\n\n");
}

async function pendingInvoiceAnswer(sql: Awaited<ReturnType<typeof getSql>>) {
  const rows = await sql.query<Record<string, unknown>>(`
    select s.id as shipment_id,s.sales_order_id,s.status,s.plan_month
      from vyndi_shipments s
     where not exists (select 1 from vyndi_invoices i where i.shipment_id=s.id)
     order by s.plan_month,s.id
  `);
  if (!rows.length) return "Pending invoices: 0. Every recorded shipment has invoice evidence.";
  return [
    `Pending invoices: ${rows.length} shipment(s) without invoice evidence.`,
    rows.slice(0, 15).map((row) => `${clean(row.shipment_id)} · ${clean(row.sales_order_id)} · ${clean(row.status)} · M${Number(row.plan_month ?? 0)}`).join("\n"),
  ].join("\n\n");
}

async function answerIntent(sql: Awaited<ReturnType<typeof getSql>>, intent: OperationalStatusIntent, question: string) {
  if (intent === "supplier_purchase_orders") return supplierPendingPoAnswer(sql, question);
  if (intent === "purchase_orders") return purchaseOrdersAnswer(sql);
  if (intent === "customer_orders") return customerOrdersAnswer(sql);
  if (intent === "job_cards") return jobCardsAnswer(sql);
  if (intent === "grn_pending") return pendingGrnAnswer(sql);
  if (intent === "dispatch_pending") return pendingDispatchAnswer(sql);
  return pendingInvoiceAnswer(sql);
}

function canView(role: CommandRole, intent: OperationalStatusIntent) {
  return canAccessRoute(role, ROUTE_BY_INTENT[intent]);
}

export const askVibpeOperationalStatus = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((input: { question: string }) => ({ question: clean(input.question).slice(0, 500) }))
  .handler(async ({ data, context }) => {
    const intents = interpretOperationalStatusQueries(data.question);
    if (!intents.length) return { handled: false as const };

    const actor = await requireBusinessActor("view", context.userId ? { userId: context.userId, email: context.userEmail } : undefined);
    const sql = await getSql();
    const answers: string[] = [];

    for (const intent of intents) {
      if (!canView(actor.role, intent)) {
        answers.push(`${INTENT_LABEL[intent]}\nNot authorised to view the controlling workspace for this record type.`);
        continue;
      }
      const answer = await answerIntent(sql, intent, data.question);
      answers.push(intents.length > 1 ? `${INTENT_LABEL[intent]}\n${answer}` : answer);
    }

    return {
      handled: true as const,
      answer: answers.join("\n\n---\n\n"),
      intent: intents[0],
      intents,
    };
  });