import { createServerFn } from "@tanstack/react-start";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";
import { requireBusinessActor } from "@/lib/business-actor";
import { getSql } from "@/lib/db";
import { canAccessRoute, type CommandRole } from "@/lib/page-access";

export type TraceabilityDocumentType =
  | "commercial_order"
  | "job_card"
  | "material_requisition"
  | "traveller"
  | "purchase_order"
  | "grn"
  | "quality_release"
  | "dispatch"
  | "invoice"
  | "collection";

export type TraceabilityDocumentRef = {
  type: TraceabilityDocumentType;
  id: string;
  status: string;
  route: string;
  label: string;
};

export type TraceabilitySearchHit = {
  salesOrderId: string;
  salesOrderRevision: number;
  planMonth: number;
  units: number;
  variantId: string;
  variantName: string;
  orderStatus: string;
  jobCardId: string;
  jobCardStatus: string;
  batchCode: string;
  bomRevision: string;
  materialRequisitionId: string;
  requirementSkus: string[];
  travellerIds: string[];
  serialNumbers: string[];
  purchaseOrderIds: string[];
  goodsReceiptIds: string[];
  qualityReleaseIds: string[];
  shipmentIds: string[];
  invoiceIds: string[];
  collectionIds: string[];
  supplierNames: string[];
  score: number;
  matchedFields: string[];
  documents: TraceabilityDocumentRef[];
};

export type TraceabilityInterpretation = {
  recognized: boolean;
  normalizedQuery: string;
  searchTerms: string[];
  documentTypes: TraceabilityDocumentType[];
  wantsPrint: boolean;
  pendingOnly: boolean;
};

export type TraceabilitySearchResponse = {
  query: string;
  interpretation: TraceabilityInterpretation;
  hits: TraceabilitySearchHit[];
  total: number;
  limited: boolean;
};

type SearchRow = Record<string, unknown>;

type TraceabilityPrintRecord = {
  title: string;
  recordType: string;
  status?: string;
  authority: string;
  sourceReference?: string;
  orientation?: "portrait" | "landscape";
  fields: Array<{ label: string; value: string | number | null | undefined }>;
  lineage?: Array<{ label: string; value: string | number | null | undefined }>;
  sections?: Array<{
    title: string;
    text?: string;
    fields?: Array<{ label: string; value: string | number | null | undefined }>;
    table?: { columns: string[]; rows: Array<Array<string | number | null | undefined>> };
  }>;
};

const ROUTE_BY_TYPE: Record<TraceabilityDocumentType, string> = {
  commercial_order: "/command/sales",
  job_card: "/command/production",
  material_requisition: "/command/production",
  traveller: "/command/production",
  purchase_order: "/command/purchase-execution",
  grn: "/command/receiving",
  quality_release: "/command/quality",
  dispatch: "/command/operations",
  invoice: "/command/receivables",
  collection: "/command/receivables",
};

const STOP_WORDS = new Set([
  "a","an","and","are","all","any","about","for","from","in","is","it","me","of","on","or","please","related","show","search","find","the","this","that","to","with","what","which","where","who","print","pdf","paper","papers","document","documents","doc","docs","record","records","form","forms","oda","ku","kku","la","le","enna","enga","irukka","irukku","panniyacha","panniya","kaatu","kattu","thedu","venum","vendum",
]);

const VERNACULAR_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bwork\s*order\b|\bjob\s*sheet\b|\bproduction\s*card\b/gi, "job card"],
  [/\bmaterial\s*(?:request|slip|issue\s*slip)\b/gi, "material requisition"],
  [/\bgoods\s*receipt\b|\bincoming\s*receipt\b/gi, "grn"],
  [/\bpurchase\s*order\b/gi, "po"],
  [/\bquality\s*(?:approval|release)\b|\bqa\s*release\b|\bqc\s*release\b/gi, "quality release"],
  [/\bframe\s*number\b|\bbike\s*number\b/gi, "serial"],
  [/\bshipping\b/gi, "dispatch"],
  [/\bbill\b/gi, "invoice"],
  [/\bintha\b|\bindha\b/gi, "this"],
  [/\bdispatch\s+panniyacha\b/gi, "dispatch status"],
  [/\bquality\s+release\s+done\s+ah\b/gi, "quality release status"],
];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function splitPipe(value: unknown) {
  return clean(value).split("|").map((item) => item.trim()).filter(Boolean);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function sanitizeSearchText(value: string) {
  return value.toLowerCase().replace(/[%_]/g, " ").replace(/[^a-z0-9@.+\-_/\s]/g, " ").replace(/\s+/g, " ").trim();
}

function documentTypesFromText(q: string): TraceabilityDocumentType[] {
  const types = new Set<TraceabilityDocumentType>();
  const tests: Array<[TraceabilityDocumentType, RegExp]> = [
    ["commercial_order", /\bdemand\b|\bcommercial\s*order\b|\bsales\s*order\b|\border\b/],
    ["job_card", /\bjob\s*card\b|\bwork\s*order\b|\bjob\s*sheet\b/],
    ["material_requisition", /\bmaterial\s*requisition\b|\bmr\b/],
    ["traveller", /\btravell?er\b|\bserial\b|\bgenealogy\b/],
    ["purchase_order", /\bpo\b|\bpurchase\s*order\b/],
    ["grn", /\bgrn\b|\bgoods\s*receipt\b|\breceiving\b/],
    ["quality_release", /\bquality\b|\bqa\b|\bqc\b/],
    ["dispatch", /\bdispatch\b|\bshipment\b|\bshipping\b/],
    ["invoice", /\binvoice\b|\breceivable\b|\bbill\b/],
    ["collection", /\bcollection\b|\breceipt\s*of\s*payment\b|\bpayment\b/],
  ];
  for (const [type, test] of tests) if (test.test(q)) types.add(type);
  return [...types];
}

export function interpretTraceabilityQuery(input: string): TraceabilityInterpretation {
  const raw = clean(input).slice(0, 500);
  let normalized = raw.toLowerCase();
  for (const [pattern, replacement] of VERNACULAR_REPLACEMENTS) normalized = normalized.replace(pattern, replacement);
  normalized = sanitizeSearchText(normalized);

  const documentTypes = documentTypesFromText(normalized);
  const wantsPrint = /\bprint\b|\bpdf\b|\bpaper\b|\bform\b/.test(raw.toLowerCase());
  const pendingOnly = /\bpending\b|\bwaiting\b|\bopen\b|\bnot\s+done\b|\bdone\s+ah\b|\bpanniyacha\b/.test(raw.toLowerCase());
  const identifierLike = normalized.split(/\s+/).some((token) => /\d/.test(token) && token.length >= 4);
  const traceVerb = /\bfind\b|\bshow\b|\bsearch\b|\btrace\b|\brelated\b|\bwhich\b|\bwhere\b|\bwhat\b|\bstatus\b|\benga\b|\benna\b|\bkaatu\b|\bthedu\b/.test(raw.toLowerCase());
  const recognized = identifierLike || (documentTypes.length > 0 && (traceVerb || wantsPrint || pendingOnly));

  const semanticWords = new Set(["order","demand","commercial","sales","job","card","work","material","requisition","mr","traveller","traveler","serial","genealogy","po","purchase","grn","goods","receipt","receiving","quality","qa","qc","release","dispatch","shipment","invoice","receivable","collection","payment","status","pending","waiting","open"]);
  const searchTerms = unique(
    normalized
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !STOP_WORDS.has(token) && !semanticWords.has(token)),
  ).slice(0, 12);

  return { recognized, normalizedQuery: normalized, searchTerms, documentTypes, wantsPrint, pendingOnly };
}

function canSee(role: CommandRole, type: TraceabilityDocumentType) {
  return canAccessRoute(role, ROUTE_BY_TYPE[type]);
}

function addDocument(
  docs: TraceabilityDocumentRef[],
  role: CommandRole,
  type: TraceabilityDocumentType,
  id: string,
  status: string,
  label: string,
) {
  if (!id || !canSee(role, type)) return;
  docs.push({ type, id, status, label, route: ROUTE_BY_TYPE[type] });
}

function rowToHit(row: SearchRow, role: CommandRole, terms: string[]) {
  const salesOrderId = clean(row.sales_order_id);
  const salesOrderRevision = Number(row.sales_order_revision ?? 0);
  const jobCardId = clean(row.job_card_id);
  const batchCode = clean(row.batch_code);
  const materialRequisitionId = batchCode ? `MR-${batchCode.replace(/^BATCH-/i, "")}` : "";
  const travellerIds = splitPipe(row.traveller_ids);
  const travellerStatuses = splitPipe(row.traveller_statuses);
  const serialNumbers = splitPipe(row.serial_numbers);
  const purchaseOrderIds = splitPipe(row.po_ids);
  const purchaseOrderStatuses = splitPipe(row.po_statuses);
  const goodsReceiptIds = splitPipe(row.grn_ids);
  const goodsReceiptStatuses = splitPipe(row.grn_statuses);
  const qualityReleaseIds = splitPipe(row.quality_ids);
  const qualityStatuses = splitPipe(row.quality_statuses);
  const shipmentIds = splitPipe(row.shipment_ids);
  const shipmentStatuses = splitPipe(row.shipment_statuses);
  const invoiceIds = splitPipe(row.invoice_ids);
  const invoiceStatuses = splitPipe(row.invoice_statuses);
  const collectionIds = splitPipe(row.collection_ids);
  const collectionStatuses = splitPipe(row.collection_statuses);
  const supplierNames = splitPipe(row.supplier_names);
  const requirementSkus = splitPipe(row.requirement_skus);

  const docs: TraceabilityDocumentRef[] = [];
  addDocument(docs, role, "commercial_order", salesOrderId, clean(row.order_status), `Commercial Order ${salesOrderId}`);
  addDocument(docs, role, "job_card", jobCardId, clean(row.job_card_status), `Job Card ${jobCardId}`);
  addDocument(docs, role, "material_requisition", materialRequisitionId, clean(row.job_card_status), `Material Requisition ${materialRequisitionId}`);
  travellerIds.forEach((id, index) => addDocument(docs, role, "traveller", id, travellerStatuses[index] ?? "", serialNumbers[index] ? `${serialNumbers[index]} · ${id}` : id));
  purchaseOrderIds.forEach((id, index) => addDocument(docs, role, "purchase_order", id, purchaseOrderStatuses[index] ?? "", id));
  goodsReceiptIds.forEach((id, index) => addDocument(docs, role, "grn", id, goodsReceiptStatuses[index] ?? "", id));
  qualityReleaseIds.forEach((id, index) => addDocument(docs, role, "quality_release", id, qualityStatuses[index] ?? "", id));
  shipmentIds.forEach((id, index) => addDocument(docs, role, "dispatch", id, shipmentStatuses[index] ?? "", id));
  invoiceIds.forEach((id, index) => addDocument(docs, role, "invoice", id, invoiceStatuses[index] ?? "", id));
  collectionIds.forEach((id, index) => addDocument(docs, role, "collection", id, collectionStatuses[index] ?? "", id));

  const searchable: Array<[string, string, TraceabilityDocumentType]> = [
    ["Commercial Order", salesOrderId, "commercial_order"],
    ["Variant", `${clean(row.variant_id)} ${clean(row.variant_name)}`, "commercial_order"],
    ["Job Card", jobCardId, "job_card"],
    ["Batch", batchCode, "job_card"],
    ["Material Requisition", materialRequisitionId, "material_requisition"],
    ["Material / SKU", requirementSkus.join(" "), "material_requisition"],
    ["Traveller", travellerIds.join(" "), "traveller"],
    ["Serial", serialNumbers.join(" "), "traveller"],
    ["Purchase Order", purchaseOrderIds.join(" "), "purchase_order"],
    ["Supplier", supplierNames.join(" "), "purchase_order"],
    ["GRN", goodsReceiptIds.join(" "), "grn"],
    ["Quality Release", qualityReleaseIds.join(" "), "quality_release"],
    ["Dispatch", shipmentIds.join(" "), "dispatch"],
    ["Invoice", invoiceIds.join(" "), "invoice"],
    ["Collection", collectionIds.join(" "), "collection"],
  ].filter(([, , type]) => canSee(role, type));

  let score = 0;
  const matchedFields: string[] = [];
  for (const term of terms) {
    const lower = term.toLowerCase();
    for (const [label, value] of searchable) {
      if (value.toLowerCase().includes(lower)) {
        score += value.toLowerCase() === lower ? 6 : value.toLowerCase().startsWith(lower) ? 4 : 2;
        matchedFields.push(label);
      }
    }
  }

  return {
    salesOrderId,
    salesOrderRevision,
    planMonth: Number(row.plan_month ?? 0),
    units: Number(row.units ?? 0),
    variantId: clean(row.variant_id),
    variantName: clean(row.variant_name),
    orderStatus: clean(row.order_status),
    jobCardId,
    jobCardStatus: clean(row.job_card_status),
    batchCode,
    bomRevision: clean(row.bom_revision),
    materialRequisitionId,
    requirementSkus,
    travellerIds,
    serialNumbers,
    purchaseOrderIds,
    goodsReceiptIds,
    qualityReleaseIds,
    shipmentIds,
    invoiceIds,
    collectionIds,
    supplierNames,
    score,
    matchedFields: unique(matchedFields),
    documents: docs,
  } satisfies TraceabilitySearchHit;
}

async function searchRows(sql: Awaited<ReturnType<typeof getSql>>, interpretation: TraceabilityInterpretation, limit: number) {
  const patterns = interpretation.searchTerms.length ? interpretation.searchTerms.map((term) => `%${term}%`) : ["%"];
  return sql.query<SearchRow>(`
    select
      o.id as sales_order_id,
      o.revision as sales_order_revision,
      o.plan_month,
      o.units,
      o.variant_id,
      o.variant_name,
      o.status as order_status,
      c.id as job_card_id,
      c.status as job_card_status,
      c.batch_code,
      c.bom_revision,
      coalesce(req.skus,'') as requirement_skus,
      coalesce(tr.ids,'') as traveller_ids,
      coalesce(tr.serials,'') as serial_numbers,
      coalesce(tr.statuses,'') as traveller_statuses,
      coalesce(po.ids,'') as po_ids,
      coalesce(po.statuses,'') as po_statuses,
      coalesce(po.suppliers,'') as supplier_names,
      coalesce(grn.ids,'') as grn_ids,
      coalesce(grn.statuses,'') as grn_statuses,
      coalesce(qr.ids,'') as quality_ids,
      coalesce(qr.statuses,'') as quality_statuses,
      coalesce(sh.ids,'') as shipment_ids,
      coalesce(sh.statuses,'') as shipment_statuses,
      coalesce(inv.ids,'') as invoice_ids,
      coalesce(inv.statuses,'') as invoice_statuses,
      coalesce(col.ids,'') as collection_ids,
      coalesce(col.statuses,'') as collection_statuses
    from vyndi_sales_orders o
    left join lateral (
      select jc.* from epr_production_job_cards jc
      where jc.sales_order_id=o.id and jc.sales_order_revision=o.revision
      order by jc.updated_at desc,jc.created_at desc,jc.id desc limit 1
    ) c on true
    left join lateral (
      select string_agg(distinct r.sku,'|' order by r.sku) filter (where r.sku is not null) as skus
      from vyndi_live_job_card_requirements r where r.job_card_id=c.id
    ) req on true
    left join lateral (
      select string_agg(t.id,'|' order by t.created_at,t.id) filter (where t.status<>'rejected') as ids,
             string_agg(t.serial_number,'|' order by t.created_at,t.id) filter (where t.status<>'rejected') as serials,
             string_agg(t.status,'|' order by t.created_at,t.id) filter (where t.status<>'rejected') as statuses
      from epr_travellers t where t.job_card_id=c.id
    ) tr on true
    left join lateral (
      select string_agg(p.id,'|' order by p.created_at,p.id) filter (where p.status<>'cancelled') as ids,
             string_agg(p.status,'|' order by p.created_at,p.id) filter (where p.status<>'cancelled') as statuses,
             string_agg(coalesce(p.supplier_name,p.supplier_id),'|' order by p.created_at,p.id) filter (where p.status<>'cancelled') as suppliers
      from vyndi_purchase_orders p where p.job_card_id=c.id
    ) po on true
    left join lateral (
      select string_agg(g.id,'|' order by g.created_at,g.id) as ids,
             string_agg(g.inspection_status,'|' order by g.created_at,g.id) as statuses
      from vyndi_goods_receipts g join vyndi_purchase_orders p on p.id=g.purchase_order_id
      where p.job_card_id=c.id and p.status<>'cancelled'
    ) grn on true
    left join lateral (
      select string_agg(q.id,'|' order by q.decided_at,q.id) filter (where q.superseded_at is null) as ids,
             string_agg(q.decision,'|' order by q.decided_at,q.id) filter (where q.superseded_at is null) as statuses
      from vyndi_quality_releases q
      where q.sales_order_id=o.id and (c.id is null or q.job_card_id=c.id)
    ) qr on true
    left join lateral (
      select string_agg(s.id,'|' order by s.plan_month,s.id) as ids,
             string_agg(s.status,'|' order by s.plan_month,s.id) as statuses
      from vyndi_shipments s where s.sales_order_id=o.id
    ) sh on true
    left join lateral (
      select string_agg(i.id,'|' order by i.plan_month,i.id) as ids,
             string_agg(i.status,'|' order by i.plan_month,i.id) as statuses
      from vyndi_invoices i where i.sales_order_id=o.id
    ) inv on true
    left join lateral (
      select string_agg(c2.id,'|' order by c2.plan_month,c2.id) as ids,
             string_agg(c2.status,'|' order by c2.plan_month,c2.id) as statuses
      from vyndi_collections c2 join vyndi_invoices i2 on i2.id=c2.invoice_id
      where i2.sales_order_id=o.id
    ) col on true
    where concat_ws(' ',o.id,o.variant_id,o.variant_name,c.id,c.batch_code,coalesce(req.skus,''),coalesce(tr.ids,''),coalesce(tr.serials,''),coalesce(po.ids,''),coalesce(po.suppliers,''),coalesce(grn.ids,''),coalesce(qr.ids,''),coalesce(sh.ids,''),coalesce(inv.ids,''),coalesce(col.ids,'')) ilike any($1::text[])
    order by o.plan_month desc,o.id,o.revision desc
    limit $2
  `, [patterns, Math.max(limit * 8, 120)]);
}

async function searchTraceabilityInternal(query: string, role: CommandRole, limit = 30): Promise<TraceabilitySearchResponse> {
  const interpretation = interpretTraceabilityQuery(query);
  if (!interpretation.recognized) return { query, interpretation, hits: [], total: 0, limited: false };
  const sql = await getSql();
  const rows = await searchRows(sql, interpretation, limit);
  let hits = rows.map((row) => rowToHit(row, role, interpretation.searchTerms));

  if (interpretation.documentTypes.length) {
    hits = hits.filter((hit) => interpretation.documentTypes.some((type) => hit.documents.some((doc) => doc.type === type)) || interpretation.pendingOnly);
  }
  if (interpretation.pendingOnly && interpretation.documentTypes.includes("quality_release")) {
    hits = hits.filter((hit) => hit.qualityReleaseIds.length === 0);
  } else if (interpretation.pendingOnly && interpretation.documentTypes.includes("dispatch")) {
    hits = hits.filter((hit) => hit.shipmentIds.length === 0);
  } else if (interpretation.pendingOnly && interpretation.documentTypes.includes("invoice")) {
    hits = hits.filter((hit) => hit.invoiceIds.length === 0);
  }

  hits.sort((a, b) => b.score - a.score || b.planMonth - a.planMonth || a.salesOrderId.localeCompare(b.salesOrderId));
  const total = hits.length;
  hits = hits.slice(0, limit);
  return { query, interpretation, hits, total, limited: total > hits.length };
}

export const searchTraceability = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((input: { query: string; limit?: number }) => ({
    query: clean(input.query).slice(0, 500),
    limit: Math.max(1, Math.min(Number(input.limit ?? 30) || 30, 100)),
  }))
  .handler(async ({ data, context }) => {
    const actor = await requireBusinessActor("view", context.userId ? { userId: context.userId, email: context.userEmail } : undefined);
    return searchTraceabilityInternal(data.query, actor.role, data.limit);
  });

function formatTraceabilityAnswer(result: TraceabilitySearchResponse) {
  if (!result.hits.length) return `I interpreted this as a traceability search, but I could not find a matching governed business record for “${result.query}”. Try a partial order, Job Card, Traveller/serial, batch, MR, PO, GRN, Quality Release, dispatch, invoice, SKU, supplier or model reference.`;
  const lines = result.hits.slice(0, 5).map((hit, index) => {
    const traveller = hit.serialNumbers[0] || hit.travellerIds[0] || "pending";
    return `${index + 1}. ${hit.salesOrderId} R${hit.salesOrderRevision} · ${hit.variantName || hit.variantId}\n   Job Card: ${hit.jobCardId || "pending"} · Batch/MR: ${hit.batchCode || "pending"} / ${hit.materialRequisitionId || "pending"}\n   Traveller/Serial: ${traveller} · PO: ${hit.purchaseOrderIds.join(", ") || "pending"} · GRN: ${hit.goodsReceiptIds.join(", ") || "pending"}\n   Quality: ${hit.qualityReleaseIds.join(", ") || "pending"} · Dispatch: ${hit.shipmentIds.join(", ") || "pending"} · Invoice: ${hit.invoiceIds.join(", ") || "pending"}`;
  });
  const more = result.total > 5 ? `\n\n${result.total - 5} more matching lineage(s) are available in Traceability & Print.` : "";
  return `Traceability search — ${result.total} matching lineage(s).\n\n${lines.join("\n\n")}${more}\n\nUse Traceability & Print to open or print the exact governed records. This search is read-only and respects the signed-in user’s route permissions.`;
}

export const askTraceabilityCopilot = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((input: { question: string }) => ({ question: clean(input.question).slice(0, 500) }))
  .handler(async ({ data, context }) => {
    const interpretation = interpretTraceabilityQuery(data.question);
    if (!interpretation.recognized) return { handled: false as const };
    const actor = await requireBusinessActor("view", context.userId ? { userId: context.userId, email: context.userEmail } : undefined);
    const result = await searchTraceabilityInternal(data.question, actor.role, 25);
    return { handled: true as const, answer: formatTraceabilityAnswer(result), query: data.question, result };
  });

async function firstRow(sql: Awaited<ReturnType<typeof getSql>>, statement: string, params: unknown[]) {
  const rows = await sql.query<Record<string, unknown>>(statement, params);
  return rows[0];
}

function ensureRoute(role: CommandRole, type: TraceabilityDocumentType) {
  if (!canSee(role, type)) throw new Error("You do not have permission to view this controlled record.");
}

export const getTraceabilityPrintRecord = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((input: { type: TraceabilityDocumentType; id: string }) => ({ type: input.type, id: clean(input.id).slice(0, 160) }))
  .handler(async ({ data, context }): Promise<TraceabilityPrintRecord> => {
    const actor = await requireBusinessActor("view", context.userId ? { userId: context.userId, email: context.userEmail } : undefined);
    ensureRoute(actor.role, data.type);
    const sql = await getSql();

    if (data.type === "commercial_order") {
      const row = await firstRow(sql, `select * from vyndi_sales_orders where id=$1 order by revision desc limit 1`, [data.id]);
      if (!row) throw new Error("Commercial Order not found.");
      return { title: clean(row.id), recordType: "Commercial Demand / Order", status: clean(row.status), authority: "Commercial · central order ledger", sourceReference: `Commercial order ${clean(row.id)}`, fields: [
        { label: "Order", value: clean(row.id) }, { label: "Revision", value: Number(row.revision ?? 0) }, { label: "Plan month", value: `M${Number(row.plan_month ?? 0)}` }, { label: "Variant", value: clean(row.variant_name || row.variant_id) }, { label: "Units", value: Number(row.units ?? 0) }, { label: "Channel", value: clean(row.channel) }, { label: "Status", value: clean(row.status) },
      ], lineage: [{ label: "Digital-thread root", value: clean(row.id) }] };
    }

    if (data.type === "job_card" || data.type === "material_requisition") {
      const jobCardId = data.type === "job_card" ? data.id : "";
      const batch = data.type === "material_requisition" ? `BATCH-${data.id.replace(/^MR-/i, "")}` : "";
      const row = await firstRow(sql, `select c.*,o.variant_name,o.units from epr_production_job_cards c left join vyndi_sales_orders o on o.id=c.sales_order_id and o.revision=c.sales_order_revision where ($1<>'' and c.id=$1) or ($2<>'' and c.batch_code=$2) order by c.updated_at desc limit 1`, [jobCardId, batch]);
      if (!row) throw new Error(data.type === "job_card" ? "Job Card not found." : "Material Requisition not found.");
      const lines = await sql.query<Record<string, unknown>>(`select sku,stage_code,stage_name,quantity,reservation_status,reservation_quantity,issue_status,shortage_quantity,reservation_id from vyndi_live_job_card_requirements where job_card_id=$1 and sku is not null order by stage_code,sku`, [row.id]);
      const requisitionId = `MR-${clean(row.batch_code || row.id).replace(/^BATCH-/i, "")}`;
      return { title: data.type === "job_card" ? clean(row.id) : requisitionId, recordType: data.type === "job_card" ? "Production Job Card" : "Material Requisition & Issue Record", status: clean(row.status), authority: data.type === "job_card" ? "Production · controlled build authority" : "Production / Stores · FIFO material issue authority", sourceReference: `Job Card ${clean(row.id)}`, orientation: "landscape", fields: [
        { label: "Commercial order", value: clean(row.sales_order_id) }, { label: "Job Card", value: clean(row.id) }, { label: "Batch", value: clean(row.batch_code) }, { label: "BOM", value: clean(row.bom_revision) }, { label: "Variant", value: clean(row.variant_name) }, { label: "Units", value: Number(row.units ?? 0) }, { label: "Status", value: clean(row.status) },
      ], lineage: [{ label: "Commercial order", value: clean(row.sales_order_id) }, { label: "Job Card", value: clean(row.id) }, { label: "Material Requisition", value: requisitionId }], sections: [{ title: "Material requirement / issue", table: { columns: ["SKU","Stage","Required","Reserved","Issue state","Short","Evidence"], rows: lines.map((line) => [clean(line.sku), `${clean(line.stage_code)} · ${clean(line.stage_name)}`, Number(line.quantity ?? 0), Number(line.reservation_quantity ?? 0), clean(line.issue_status || line.reservation_status), Number(line.shortage_quantity ?? 0), clean(line.reservation_id) || "—"]) } }] };
    }

    if (data.type === "traveller") {
      const row = await firstRow(sql, `select t.*,c.sales_order_id,c.batch_code,c.bom_revision from epr_travellers t left join epr_production_job_cards c on c.id=t.job_card_id where t.id=$1 limit 1`, [data.id]);
      if (!row) throw new Error("Traveller not found.");
      return { title: clean(row.serial_number || row.id), recordType: "Traveller Card / Serial Genealogy", status: clean(row.status), authority: "Production · serialized genealogy authority", sourceReference: `Traveller ${clean(row.id)}`, fields: [
        { label: "Traveller", value: clean(row.id) }, { label: "Serial", value: clean(row.serial_number) }, { label: "Commercial order", value: clean(row.sales_order_id) }, { label: "Job Card", value: clean(row.job_card_id) }, { label: "Batch", value: clean(row.batch_code) }, { label: "BOM", value: clean(row.bom_revision) }, { label: "Status", value: clean(row.status) },
      ], lineage: [{ label: "Commercial order", value: clean(row.sales_order_id) }, { label: "Job Card", value: clean(row.job_card_id) }, { label: "Traveller / serial", value: `${clean(row.id)} · ${clean(row.serial_number)}` }] };
    }

    if (data.type === "purchase_order") {
      const row = await firstRow(sql, `select * from vyndi_purchase_orders where id=$1 limit 1`, [data.id]);
      if (!row) throw new Error("Purchase Order not found.");
      return { title: clean(row.id), recordType: "Purchase Order", status: clean(row.status), authority: "Procurement · purchase-order authority", sourceReference: clean(row.source_reference) || `PO ${clean(row.id)}`, fields: [
        { label: "PO", value: clean(row.id) }, { label: "Supplier", value: clean(row.supplier_name || row.supplier_id) }, { label: "SKU", value: clean(row.sku) }, { label: "Quantity", value: Number(row.quantity ?? 0) }, { label: "Unit", value: clean(row.unit) }, { label: "Unit price INR", value: Number(row.unit_price_inr ?? 0) }, { label: "Order value INR", value: Number(row.order_value_inr ?? 0) }, { label: "Status", value: clean(row.status) }, { label: "Job Card", value: clean(row.job_card_id) },
      ], lineage: [{ label: "Job Card", value: clean(row.job_card_id) }, { label: "PO", value: clean(row.id) }] };
    }

    if (data.type === "grn") {
      const row = await firstRow(sql, `select g.*,p.job_card_id,p.supplier_name from vyndi_goods_receipts g left join vyndi_purchase_orders p on p.id=g.purchase_order_id where g.id=$1 limit 1`, [data.id]);
      if (!row) throw new Error("GRN not found.");
      return { title: clean(row.id), recordType: "Goods Receipt Note / Incoming Inspection", status: clean(row.inspection_status), authority: "Receiving · controlled GRN and inventory boundary", sourceReference: clean(row.source_reference) || `GRN ${clean(row.id)}`, fields: [
        { label: "GRN", value: clean(row.id) }, { label: "PO", value: clean(row.purchase_order_id) }, { label: "Job Card", value: clean(row.job_card_id) }, { label: "Supplier", value: clean(row.supplier_name) }, { label: "SKU", value: clean(row.sku) }, { label: "Received", value: Number(row.quantity_received ?? 0) }, { label: "Accepted", value: Number(row.quantity_accepted ?? 0) }, { label: "Quarantine", value: Number(row.quantity_quarantined ?? 0) }, { label: "Rejected", value: Number(row.quantity_rejected ?? 0) }, { label: "Inspection", value: clean(row.inspection_status) },
      ], lineage: [{ label: "Job Card", value: clean(row.job_card_id) }, { label: "Purchase Order", value: clean(row.purchase_order_id) }, { label: "GRN", value: clean(row.id) }] };
    }

    if (data.type === "quality_release") {
      const row = await firstRow(sql, `select * from vyndi_quality_releases where id=$1 limit 1`, [data.id]);
      if (!row) throw new Error("Quality Release not found.");
      return { title: clean(row.id), recordType: "Serialized Quality Release", status: clean(row.decision), authority: "Quality · serialized release authority", sourceReference: clean(row.evidence_ref) || `Quality release ${clean(row.id)}`, fields: [
        { label: "Release", value: clean(row.id) }, { label: "Decision", value: clean(row.decision) }, { label: "Commercial order", value: clean(row.sales_order_id) }, { label: "Job Card", value: clean(row.job_card_id) }, { label: "Traveller", value: clean(row.traveller_id) }, { label: "Serial", value: clean(row.serial_number) }, { label: "Reason", value: clean(row.decision_reason) }, { label: "Evidence", value: clean(row.evidence_ref) }, { label: "Decided by", value: clean(row.decided_by) },
      ], lineage: [{ label: "Commercial order", value: clean(row.sales_order_id) }, { label: "Job Card", value: clean(row.job_card_id) }, { label: "Traveller", value: clean(row.traveller_id) }, { label: "Quality release", value: clean(row.id) }] };
    }

    if (data.type === "dispatch") {
      const row = await firstRow(sql, `select * from vyndi_dispatch_register where shipment_id=$1 limit 1`, [data.id]);
      if (!row) throw new Error("Dispatch record not found.");
      return { title: clean(row.shipment_id), recordType: "Dispatch / Shipment Record", status: clean(row.status), authority: "Operations / Fulfilment · canonical dispatch authority", sourceReference: clean(row.source_reference) || `Dispatch ${clean(row.shipment_id)}`, fields: [
        { label: "Shipment", value: clean(row.shipment_id) }, { label: "Commercial order", value: clean(row.sales_order_id) }, { label: "Job Card", value: clean(row.job_card_id) }, { label: "Units", value: Number(row.units ?? 0) }, { label: "Plan month", value: `M${Number(row.plan_month ?? 0)}` }, { label: "Quality releases", value: Number(row.current_quality_release_count ?? 0) }, { label: "Invoice", value: clean(row.invoice_id) || "Pending" }, { label: "Status", value: clean(row.status) },
      ], lineage: [{ label: "Commercial order", value: clean(row.sales_order_id) }, { label: "Job Card", value: clean(row.job_card_id) }, { label: "Dispatch", value: clean(row.shipment_id) }, { label: "Invoice", value: clean(row.invoice_id) || "Pending" }] };
    }

    if (data.type === "invoice" || data.type === "collection") {
      if (data.type === "invoice") {
        const row = await firstRow(sql, `select * from vyndi_invoices where id=$1 limit 1`, [data.id]);
        if (!row) throw new Error("Invoice not found.");
        const collections = await sql.query<Record<string, unknown>>(`select * from vyndi_collections where invoice_id=$1 order by plan_month,id`, [data.id]);
        return { title: clean(row.id), recordType: "Customer Invoice / Receivable Record", status: clean(row.status), authority: "Finance · shipment-derived receivable authority", sourceReference: clean(row.source_reference) || `Invoice ${clean(row.id)}`, fields: [
          { label: "Invoice", value: clean(row.id) }, { label: "Commercial order", value: clean(row.sales_order_id) }, { label: "Shipment", value: clean(row.shipment_id) }, { label: "Plan month", value: `M${Number(row.plan_month ?? 0)}` }, { label: "Amount lakh", value: Number(row.amount_lakh ?? 0) }, { label: "Status", value: clean(row.status) },
        ], lineage: [{ label: "Commercial order", value: clean(row.sales_order_id) }, { label: "Shipment", value: clean(row.shipment_id) }, { label: "Invoice", value: clean(row.id) }], sections: [{ title: "Collection evidence", table: { columns: ["Collection","Month","Amount lakh","Status","Reference"], rows: collections.map((item) => [clean(item.id), `M${Number(item.plan_month ?? 0)}`, Number(item.amount_lakh ?? 0), clean(item.status), clean(item.source_reference) || "—"]) } }] };
      }
      const row = await firstRow(sql, `select c.*,i.sales_order_id,i.shipment_id from vyndi_collections c left join vyndi_invoices i on i.id=c.invoice_id where c.id=$1 limit 1`, [data.id]);
      if (!row) throw new Error("Collection record not found.");
      return { title: clean(row.id), recordType: "Customer Collection Record", status: clean(row.status), authority: "Finance · collection authority", sourceReference: clean(row.source_reference) || `Collection ${clean(row.id)}`, fields: [
        { label: "Collection", value: clean(row.id) }, { label: "Invoice", value: clean(row.invoice_id) }, { label: "Commercial order", value: clean(row.sales_order_id) }, { label: "Shipment", value: clean(row.shipment_id) }, { label: "Plan month", value: `M${Number(row.plan_month ?? 0)}` }, { label: "Amount lakh", value: Number(row.amount_lakh ?? 0) }, { label: "Status", value: clean(row.status) },
      ], lineage: [{ label: "Commercial order", value: clean(row.sales_order_id) }, { label: "Invoice", value: clean(row.invoice_id) }, { label: "Collection", value: clean(row.id) }] };
    }

    throw new Error("Unsupported traceability document type.");
  });
