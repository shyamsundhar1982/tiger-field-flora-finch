import type { Sql } from "@/lib/db";

const n = (value: unknown) => Number(value ?? 0);
const clean = (value: unknown) => String(value ?? "").trim();
const qn = (question: string) => question.toLowerCase().replace(/\s+/g, " ").trim();

async function confirmedOrderCount(sql: Sql) {
  const [row] = await sql.query<Record<string, unknown>>(`
    select count(*)::int as order_count,coalesce(sum(units),0)::numeric as unit_count
      from vyndi_sales_orders where status='confirmed'
  `);
  const orders = n(row?.order_count);
  const units = n(row?.unit_count);
  return `Confirmed customer demand: ${orders.toFixed(0)} confirmed order${orders === 1 ? "" : "s"}, representing ${units.toFixed(0)} unit${units === 1 ? "" : "s"}. Evidence: live vyndi_sales_orders rows with status=confirmed.`;
}

async function missingJobCard(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select o.id as sales_order_id,o.revision as sales_order_revision,
           coalesce(o.variant_name,o.variant_id,o.product_id) as variant_name,jc.id as job_card_id
      from vyndi_sales_orders o
      left join lateral (
        select c.id from epr_production_job_cards c
         where c.sales_order_id=o.id and c.sales_order_revision=o.revision
           and c.status<>'cancelled'
         order by c.updated_at desc,c.created_at desc,c.id desc limit 1
      ) jc on true
     where o.status='confirmed'
     order by o.plan_month,o.id
  `);
  const missing = rows.filter((row) => !clean(row.job_card_id));
  if (!missing.length) return `Confirmed-order job-card coverage: PASS — 0 of ${rows.length} confirmed orders lack a production job card. Every current confirmed sales-order revision resolves to an active job card.`;
  return [
    `Confirmed-order job-card coverage: FAIL — ${missing.length} of ${rows.length} confirmed orders have no active production job card.`,
    `Missing: ${missing.map((row) => `${clean(row.sales_order_id)} R${n(row.sales_order_revision).toFixed(0)}${clean(row.variant_name) ? ` · ${clean(row.variant_name)}` : ""}`).join("; ")}.`,
    "Controlled next action: create or restore the governed production job-card linkage before treating these orders as released to production.",
  ].join("\n\n");
}

async function confirmedShortages(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select o.id as sales_order_id,c.id as job_card_id,r.sku,r.shortage_quantity
      from vyndi_sales_orders o
      join epr_production_job_cards c on c.sales_order_id=o.id and c.sales_order_revision=o.revision and c.status<>'cancelled'
      join vyndi_live_job_card_requirements r on r.job_card_id=c.id
     where o.status='confirmed' and r.sku is not null
       and coalesce(r.issue_status,'')<>'issued' and coalesce(r.shortage_quantity,0)>0
     order by o.plan_month,o.id,c.id,r.sku
  `);
  if (!rows.length) return "Exact confirmed-order shortage check: PASS — no uncovered job-card material shortage is recorded for current confirmed orders.";
  const total = rows.reduce((sum, row) => sum + n(row.shortage_quantity), 0);
  return [
    `Exact confirmed-order shortage check: BLOCKED — ${total.toFixed(1)} component units across ${rows.length} order/job-card/SKU shortage rows require coverage.`,
    rows.map((row) => `${clean(row.sales_order_id)} · ${clean(row.job_card_id)} · ${clean(row.sku)}: ${n(row.shortage_quantity).toFixed(1)} short`).join("; "),
    "Controlled next action: cover each exact shortage with governed stock/reservation, an approved substitute, or an authorised supplier receipt before production release.",
  ].join("\n\n");
}

async function sharedComponentAggregation(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    with job as (
      select r.sku,count(distinct r.job_card_id)::int as job_cards,
             sum(r.required_quantity)::numeric as job_required
        from vyndi_live_job_card_requirements r
        join epr_production_job_cards c on c.id=r.job_card_id
        join vyndi_sales_orders o on o.id=c.sales_order_id and o.revision=c.sales_order_revision
       where o.status='confirmed' and c.status<>'cancelled' and r.sku is not null
         and coalesce(r.issue_status,'')<>'issued'
       group by r.sku
    ), committed as (
      select sku,sum(committed_requirement)::numeric as committed_requirement
        from vyndi_committed_procurement_requirements
       group by sku
    )
    select j.sku,j.job_cards,j.job_required,coalesce(c.committed_requirement,0) as committed_requirement
      from job j left join committed c on c.sku=j.sku
     where j.job_cards>1
     order by j.sku
  `);
  const bad = rows.filter((row) => Math.abs(n(row.job_required) - n(row.committed_requirement)) > 0.0001);
  if (!bad.length) {
    return `Shared-component aggregation: PASS — ${rows.length} SKU${rows.length === 1 ? "" : "s"} are required by more than one confirmed-order job card, and each aggregated committed requirement equals the summed job-card requirement; no shared component is evidenced as being counted only once.`;
  }
  return [
    `Shared-component aggregation: FAIL — ${bad.length} shared SKU${bad.length === 1 ? "" : "s"} do not reconcile across multiple confirmed-order job cards.`,
    bad.map((row) => `${clean(row.sku)}: ${n(row.job_cards).toFixed(0)} job cards, summed job requirement ${n(row.job_required).toFixed(1)}, committed procurement requirement ${n(row.committed_requirement).toFixed(1)}`).join("; "),
    "Controlled next action: repair the cross-job aggregation before relying on procurement demand or shortage conclusions.",
  ].join("\n\n");
}

async function inventoryTransactionLineage(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    with skus as (
      select distinct sku from vyndi_committed_procurement_requirements where sku is not null
    )
    select l.sku,l.id as ledger_id,l.movement_id,l.quantity_delta,l.created_at,
           m.movement_type,
           coalesce(nullif(l.reference,''),nullif(m.reference,''),'') as reference
      from epr_inventory_ledger l
      join skus s on s.sku=l.sku
      left join epr_inventory_movements m on m.id=l.movement_id
     order by l.sku,l.created_at,l.id
  `);
  if (!rows.length) return "Committed-SKU inventory transaction lineage: no inventory ledger transactions are recorded for current committed SKUs.";
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const sku = clean(row.sku);
    const entries = grouped.get(sku) ?? [];
    entries.push(`${clean(row.ledger_id)} / ${clean(row.movement_type) || "movement n/a"} ${n(row.quantity_delta) >= 0 ? "+" : ""}${n(row.quantity_delta).toFixed(1)} · ${clean(row.reference) || clean(row.movement_id)}`);
    grouped.set(sku, entries);
  }
  return [
    "Committed-SKU inventory transaction lineage:",
    [...grouped].map(([sku, entries]) => `${sku}: ${entries.join("; ")}`).join("\n"),
    "Evidence: immutable epr_inventory_ledger with its canonical movement/reference linkage. Use inventory arithmetic reconciliation to verify these deltas tie to current physical balance.",
  ].join("\n\n");
}

async function draftPoLineage(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select p.id as po_id,p.job_card_id,c.sales_order_id,p.sku,p.quantity
      from vyndi_purchase_orders p
      left join epr_production_job_cards c on c.id=p.job_card_id
     where p.status='draft'
     order by p.created_at,p.id
  `);
  if (!rows.length) return "Draft-PO lineage: PASS — 0 draft purchase orders exist.";
  return [
    `Draft-PO lineage: ${rows.length} draft purchase order${rows.length === 1 ? "" : "s"}.`,
    rows.map((row) => `${clean(row.po_id)} → order ${clean(row.sales_order_id) || "UNLINKED"} → job card ${clean(row.job_card_id) || "UNLINKED"} → ${clean(row.sku) || "SKU MISSING"} × ${n(row.quantity).toFixed(1)}`).join("; "),
    "Governance: draft POs are sourcing intent only; they are not authorised supplier commitments.",
  ].join("\n\n");
}

async function draftPoMissingSupplier(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select id as po_id,job_card_id,sku,quantity from vyndi_purchase_orders
     where status='draft' and supplier_id is null order by created_at,id
  `);
  if (!rows.length) return "Draft-PO supplier assignment: PASS — no draft purchase order is supplier-unassigned.";
  return [
    `Draft-PO supplier assignment: FAIL — ${rows.length} draft PO${rows.length === 1 ? "" : "s"} have no supplier assigned.`,
    rows.map((row) => `${clean(row.po_id)} · ${clean(row.job_card_id) || "job card UNLINKED"} · ${clean(row.sku) || "SKU MISSING"} × ${n(row.quantity).toFixed(1)}`).join("; "),
    "Controlled next action: assign an approved supplier and validate source/lead-time authority before PO approval or issue.",
  ].join("\n\n");
}

async function supplierRatingGap(sql: Sql, question: string) {
  const q = qn(question);
  const quality = /\bquality\s+ratings?\b/.test(q);
  const rows = await sql.query<Record<string, unknown>>(quality
    ? `select id,name from vyndi_suppliers where active and quality_rating is null order by coalesce(name,id),id`
    : `select id,name from vyndi_suppliers where active and delivery_rating is null order by coalesce(name,id),id`);
  const label = quality ? "quality" : "delivery";
  if (!rows.length) return `Supplier ${label}-rating completeness: PASS — every active supplier has a governed ${label} rating.`;
  return [
    `Supplier ${label}-rating completeness: FAIL — ${rows.length} active supplier${rows.length === 1 ? "" : "s"} lack a ${label} rating.`,
    `Missing: ${rows.map((row) => `${clean(row.name) || clean(row.id)} (${clean(row.id)})`).join("; ")}.`,
    `Controlled next action: populate governed ${label}-performance evidence before using supplier ranking as decision-grade sourcing authority.`,
  ].join("\n\n");
}

export async function tryVibpePriorityOperationalControl(sql: Sql, question: string): Promise<string | undefined> {
  const q = qn(question);
  if (/\bhow many\b/.test(q) && /\bconfirmed\b/.test(q) && /\b(customer\s+)?orders?\b/.test(q) && /\bunits?\b/.test(q)) return confirmedOrderCount(sql);
  if (/\bconfirmed\b/.test(q) && /\borders?\b/.test(q) && /\b(no|without|missing)\b[^.?!]{0,50}\b(job\s*card|production\s+job\s*card)\b/.test(q)) return missingJobCard(sql);
  if (/\bconfirmed[- ]order|confirmed\s+orders?|committed\b/.test(q) && /\bshortage|shortages|short\b/.test(q) && /\bprocure|procurement|purchase|need|now\b/.test(q)) return confirmedShortages(sql);
  if (/components? required by more than one bike|counted only once/.test(q)) return sharedComponentAggregation(sql);
  if (/inventory transactions?/.test(q) && /(created the present stock balance|present stock balance)/.test(q)) return inventoryTransactionLineage(sql);
  if (/\bdraft\s+(?:purchase\s+orders?|pos?)\b/.test(q) && /\bhow many|which\b/.test(q) && /\b(job\s*card|confirmed\s+order|generated|originat|linked)\b/.test(q)) return draftPoLineage(sql);
  if (/\bdraft\s+(?:purchase\s+orders?|pos?)\b/.test(q) && /\b(no|without|missing|unassigned)\b[^.?!]{0,40}\bsupplier\b/.test(q)) return draftPoMissingSupplier(sql);
  if (/\bsuppliers?\b/.test(q) && /\b(lack|lacks|missing|without|no)\b/.test(q) && /\b(quality|delivery)\s+ratings?\b/.test(q)) return supplierRatingGap(sql, question);
  return undefined;
}
