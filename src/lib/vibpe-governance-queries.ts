import type { Sql } from "@/lib/db";

type ActiveActionRow = {
  id: string;
  kind: string;
  title: string;
  status: string;
  owner: string | null;
  due_on: string | null;
};

type ExceptionRow = {
  exception_key: string;
  exception_type: string;
  severity: string;
  domain: string;
  entity_type: string;
  entity_id: string;
  gate_id: string | null;
};

type WorkflowOrderRow = {
  sales_order_id: string;
  variant_name: string;
  job_card_id: string;
  job_card_status: string;
  open_shortage_units: string | number;
  draft_po_count: string | number;
  committed_po_count: string | number;
  received_po_count: string | number;
  traveller_count: string | number;
  quality_release_count: string | number;
  shipment_count: string | number;
  invoice_count: string | number;
  collection_count: string | number;
};

type HealthRunRow = {
  approved_plan_revision: string | number;
  input_hash: string;
  business_health_score: string | number;
  expected_units: string | number;
  critical_count: string | number;
  high_count: string | number;
  medium_count: string | number;
  shortage_sku_months: string | number;
  minimum_liquidity: string | number;
  funding_need: string | number;
  first_breach: string | number | null;
  active_bom_skus: string | number;
  resolved_cost_skus: string | number;
  missing_cost_skus: string;
};

const n = (value: unknown) => Number(value ?? 0);
const clean = (value: unknown) => String(value ?? "").trim();

export function isTraceabilityExceptionQuestion(question: string) {
  const q = question.toLowerCase();
  return /\b(job\s*cards?|orders?|demand)\b/.test(q)
    && /traceab|lineage|originat/.test(q)
    && /without|missing|incomplete|broken|gap|not\s+(?:linked|traceable)|orphan/.test(q);
}

export function isGovernanceOperatingStatusQuestion(question: string) {
  const q = question.toLowerCase();
  const asksControlState = /open\s+actions?|exceptions?|blocked\s+gates?|overdue|incomplete\s+workflows?|workflows?\s+are\s+incomplete|blocking\s+each|what\s+is\s+blocking/.test(q);
  return asksControlState && /action|exception|gate|overdue|workflow|block/.test(q);
}

export function isOverallRagHealthQuestion(question: string) {
  const q = question.toLowerCase();
  return /overall\s+health|current\s+health|health\s+of\s+vyndi|green.*amber.*red|red.*amber.*green|rag\s+(?:status|health)/.test(q);
}

async function traceabilityExceptionAnswer(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select c.id as job_card_id,
           c.sales_order_id,
           c.sales_order_revision,
           c.status as job_card_status,
           c.product_label,
           o.id as matched_order_id,
           o.revision as matched_order_revision,
           o.status as order_status
      from epr_production_job_cards c
      left join vyndi_sales_orders o
        on o.id=c.sales_order_id
       and o.revision=c.sales_order_revision
     order by c.created_at,c.id
  `);

  const incomplete = rows.filter((row) => !clean(row.sales_order_id) || !clean(row.matched_order_id));
  if (!incomplete.length) {
    return [
      `Traceability exception check: PASS — 0 of ${rows.length} job cards lack their originating governed order link.`,
      "Every current job card resolves to an exact sales-order ID and sales-order revision.",
      "Scope: originating demand/order lineage only. Downstream Traveller, Quality, Dispatch, Invoice and Collection completion are evaluated separately as workflow progression."
    ].join("\n\n");
  }

  const details = incomplete.slice(0, 12).map((row) => {
    const reason = !clean(row.sales_order_id) ? "missing sales-order ID" : `sales order/revision ${clean(row.sales_order_id)} R${Number(row.sales_order_revision ?? 0)} not found`;
    return `${clean(row.job_card_id)} (${clean(row.product_label) || "product not labelled"}) — ${reason}`;
  });
  return [
    `Traceability exception check: FAIL — ${incomplete.length} of ${rows.length} job cards lack complete originating order lineage.`,
    details.join("; "),
    "Controlled next action: repair the job-card → sales-order ID/revision lineage before relying on downstream genealogy or audit evidence."
  ].join("\n\n");
}

async function activeActions(sql: Sql) {
  return sql.query<ActiveActionRow>(`
    select action_id as id,'operating'::text as kind,action_id as title,status,owner,due_on
      from vyndi_operating_actions
     where status not in ('done','closed','cancelled')
    union all
    select id,'ibpe-management'::text as kind,title,status,owner,due_date as due_on
      from vyndi_ibpe_management_actions
     where status not in ('done','closed','cancelled')
     order by kind,id
  `);
}

async function assuranceExceptions(sql: Sql) {
  return sql.query<ExceptionRow>(`
    select exception_key,exception_type,severity,domain,entity_type,entity_id,gate_id
      from vyndi_vibpe_assurance_exceptions_all
     order by case severity when 'critical' then 0 when 'warning' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
              domain,exception_key
     limit 100
  `);
}

async function workflowOrders(sql: Sql) {
  return sql.query<WorkflowOrderRow>(`
    select o.id as sales_order_id,
           coalesce(o.variant_name,o.variant_id) as variant_name,
           c.id as job_card_id,
           c.status as job_card_status,
           coalesce(req.open_shortage_units,0) as open_shortage_units,
           coalesce(po.draft_po_count,0) as draft_po_count,
           coalesce(po.committed_po_count,0) as committed_po_count,
           coalesce(po.received_po_count,0) as received_po_count,
           coalesce(tr.traveller_count,0) as traveller_count,
           coalesce(qr.quality_release_count,0) as quality_release_count,
           coalesce(sh.shipment_count,0) as shipment_count,
           coalesce(inv.invoice_count,0) as invoice_count,
           coalesce(col.collection_count,0) as collection_count
      from vyndi_sales_orders o
      left join lateral (
        select * from epr_production_job_cards jc
         where jc.sales_order_id=o.id and jc.sales_order_revision=o.revision
         order by jc.updated_at desc,jc.created_at desc,jc.id desc limit 1
      ) c on true
      left join lateral (
        select coalesce(sum(r.shortage_quantity) filter (
                 where r.sku is not null and coalesce(r.issue_status,'') <> 'issued'
               ),0) as open_shortage_units
          from vyndi_live_job_card_requirements r
         where r.job_card_id=c.id
      ) req on true
      left join lateral (
        select count(*) filter (where p.status='draft') as draft_po_count,
               count(*) filter (where p.status in ('approved','issued','part_received')) as committed_po_count,
               count(*) filter (where p.status='received') as received_po_count
          from vyndi_purchase_orders p
         where p.job_card_id=c.id and p.status<>'cancelled'
      ) po on true
      left join lateral (
        select count(*) filter (where t.status<>'rejected') as traveller_count
          from epr_travellers t where t.job_card_id=c.id
      ) tr on true
      left join lateral (
        select count(*) filter (where q.superseded_at is null) as quality_release_count
          from vyndi_quality_releases q where q.job_card_id=c.id
      ) qr on true
      left join lateral (
        select count(*) filter (where s.status='posted') as shipment_count
          from vyndi_shipments s where s.sales_order_id=o.id
      ) sh on true
      left join lateral (
        select count(*) filter (where i.status='issued') as invoice_count
          from vyndi_invoices i where i.sales_order_id=o.id
      ) inv on true
      left join lateral (
        select count(*) filter (where c2.status='posted') as collection_count
          from vyndi_collections c2
          join vyndi_invoices i2 on i2.id=c2.invoice_id
         where i2.sales_order_id=o.id and i2.status='issued'
      ) col on true
     where o.status in ('confirmed','delivered')
     order by o.plan_month,o.id
  `);
}

function blockerForOrder(row: WorkflowOrderRow) {
  const shortage = n(row.open_shortage_units);
  const draftPos = n(row.draft_po_count);
  const committedPos = n(row.committed_po_count);
  if (!clean(row.job_card_id)) return "job card not created";
  if (shortage > 0) return `${shortage.toFixed(1)} material units short; ${draftPos} draft PO${draftPos === 1 ? "" : "s"}, ${committedPos} approved/issued/part-received PO${committedPos === 1 ? "" : "s"}`;
  if (n(row.traveller_count) === 0) return "material gate cleared but Traveller/build record not started";
  if (n(row.quality_release_count) === 0) return "Traveller exists but no current Quality Release";
  if (n(row.shipment_count) === 0) return "Quality released but no posted Dispatch/Shipment";
  if (n(row.invoice_count) === 0) return "Dispatch exists but no issued customer Invoice";
  if (n(row.collection_count) === 0) return "Invoice issued but no posted Collection";
  return "complete through collection";
}

async function governanceOperatingStatusAnswer(sql: Sql) {
  const [actions, exceptions, orders, gateRows, p2pRows, peopleRows] = await Promise.all([
    activeActions(sql),
    assuranceExceptions(sql),
    workflowOrders(sql),
    sql.query<Record<string, unknown>>(`
      select
        (select count(*) from vyndi_vibpe_gate_registry where active) as registered_gates,
        (select count(distinct e.gate_id) from vyndi_vibpe_assurance_exceptions_all e where e.gate_id is not null) as exception_gates,
        (select count(*) from vyndi_report_production_release_gate) as production_gate_rows,
        (select count(*) from vyndi_report_production_release_gate where gate_status<>'RELEASED') as production_gate_blocked
    `),
    sql.query<Record<string, unknown>>(`
      select
        count(*) filter (where status='draft') as draft_po_count,
        count(*) filter (where status in ('approved','issued','part_received')) as committed_po_count,
        count(*) filter (where status='received') as received_po_count,
        (select count(*) from vyndi_supplier_invoices) as supplier_invoice_count,
        (select count(*) from vyndi_supplier_payments) as supplier_payment_count
      from vyndi_purchase_orders
      where status<>'cancelled'
    `),
    sql.query<Record<string, unknown>>(`
      select count(*) as total_items,
             count(*) filter (where lifecycle_status='draft') as draft_items,
             count(*) filter (where lifecycle_status<>'draft') as non_draft_items
        from vyndi_people_office_cost_items
    `),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const overdue = actions.filter((item) => item.due_on && item.due_on < today);
  const missingDue = actions.filter((item) => !item.due_on);
  const missingOwner = actions.filter((item) => !clean(item.owner));
  const gate = gateRows[0] ?? {};
  const p2p = p2pRows[0] ?? {};
  const people = peopleRows[0] ?? {};

  const totalShortage = orders.reduce((sum, row) => sum + n(row.open_shortage_units), 0);
  const orderBlockers = orders
    .filter((row) => blockerForOrder(row) !== "complete through collection")
    .map((row) => `${clean(row.variant_name)} (${clean(row.job_card_id) || clean(row.sales_order_id)}): ${blockerForOrder(row)}`);

  const lines = [
    `Governance operating status: ${actions.length} open action${actions.length === 1 ? "" : "s"}; ${exceptions.length} active VIBPE assurance exception${exceptions.length === 1 ? "" : "s"}; ${n(gate.exception_gates)} registered gate${n(gate.exception_gates) === 1 ? "" : "s"} blocked by assurance exceptions; ${n(gate.production_gate_blocked)} production-release gate row${n(gate.production_gate_blocked) === 1 ? "" : "s"} blocked.`,
    `Action hygiene: ${overdue.length} recorded overdue; ${missingDue.length} open action${missingDue.length === 1 ? "" : "s"} have no due date; ${missingOwner.length} have no owner. Open actions: ${actions.length ? actions.map((item) => `${item.id} [${item.kind}/${item.status}]${item.owner ? ` owner ${item.owner}` : " owner missing"}${item.due_on ? ` due ${item.due_on}` : " due date missing"}`).join("; ") : "none"}.`,
  ];

  if (exceptions.length) {
    lines.push(`Active assurance exceptions: ${exceptions.slice(0, 8).map((item) => `${item.severity} ${item.domain} — ${item.exception_type} (${item.entity_type}:${item.entity_id}${item.gate_id ? `, gate ${item.gate_id}` : ""})`).join("; ")}.`);
  } else {
    lines.push(`Assurance gates: ${n(gate.registered_gates)} active gates are registered and no current assurance exception is attached to a gate. Production-release report rows are ${n(gate.production_gate_rows) - n(gate.production_gate_blocked)}/${n(gate.production_gate_rows)} RELEASED.`);
  }

  lines.push(
    `Incomplete workflow — order-to-cash: ${orders.length} active confirmed/delivered order thread${orders.length === 1 ? "" : "s"}; current open material shortage ${totalShortage.toFixed(1)} units. ${orderBlockers.join(" | ")}.`,
    `Incomplete workflow — procure-to-pay: ${n(p2p.draft_po_count)} draft POs, ${n(p2p.committed_po_count)} approved/issued/part-received POs, ${n(p2p.received_po_count)} received POs, ${n(p2p.supplier_invoice_count)} supplier invoices and ${n(p2p.supplier_payment_count)} supplier payments. The immediate blocker is that draft replenishment has not become authorised supplier commitment.`,
  );

  if (n(people.draft_items) > 0) {
    lines.push(`Incomplete workflow — People & Office → Finance: ${n(people.draft_items)}/${n(people.total_items)} cost items remain draft, so they are not yet an approved finance feed.`);
  }

  lines.push("Evidence: live Action Inbox/operating-action state, VIBPE assurance exception/gate registries, production-release gates, canonical order/job-card/material/PO lineage, supplier invoice/payment ledgers and People & Office lifecycle state.");
  return lines.join("\n\n");
}

async function overallRagHealthAnswer(sql: Sql) {
  const [runs, traceRows, assuranceRows, actionRows, productionRows, executionRows, peopleRows] = await Promise.all([
    sql.query<HealthRunRow>(`
      select approved_plan_revision,input_hash,
             result_json->'summary'->>'businessHealthScore' as business_health_score,
             result_json->'summary'->>'expectedUnits' as expected_units,
             result_json->'summary'->'findingCounts'->>'critical' as critical_count,
             result_json->'summary'->'findingCounts'->>'high' as high_count,
             result_json->'summary'->'findingCounts'->>'medium' as medium_count,
             result_json->'summary'->>'fulfillmentShortageSkuMonths' as shortage_sku_months,
             result_json->'summary'->>'minimumFreeLiquidityAfterRecommendationsLakh' as minimum_liquidity,
             result_json->'funding'->>'incrementalFundingNeedLakh' as funding_need,
             result_json->'funding'->>'firstLiquidityBreachAfterRecommendationsPeriod' as first_breach,
             validation_json->>'activePlanningBomSkus' as active_bom_skus,
             validation_json->>'activePlanningBomResolvedCostSkus' as resolved_cost_skus,
             validation_json->>'missingControlledCostSkus' as missing_cost_skus
        from vyndi_ibpe_runs
       where status='complete'
       order by created_at desc limit 1
    `),
    sql.query<Record<string, unknown>>(`
      select count(*) as total_job_cards,
             count(*) filter (where o.id is null) as broken_origin_links
        from epr_production_job_cards c
        left join vyndi_sales_orders o on o.id=c.sales_order_id and o.revision=c.sales_order_revision
    `),
    sql.query<Record<string, unknown>>(`select count(*) as exception_count,count(distinct gate_id) filter (where gate_id is not null) as blocked_gate_count from vyndi_vibpe_assurance_exceptions_all`),
    sql.query<Record<string, unknown>>(`
      select count(*) as active_actions,
             count(*) filter (where due_on is null) as missing_due,
             count(*) filter (where owner is null or btrim(owner)='') as missing_owner
        from vyndi_operating_actions
       where status not in ('done','closed','cancelled')
    `),
    sql.query<Record<string, unknown>>(`select count(*) as gate_rows,count(*) filter (where gate_status='RELEASED') as released_rows from vyndi_report_production_release_gate`),
    sql.query<Record<string, unknown>>(`
      select
        (select coalesce(sum(shortage_quantity),0) from vyndi_live_job_card_requirements where sku is not null and coalesce(issue_status,'')<>'issued') as current_shortage_units,
        (select count(*) from vyndi_purchase_orders where status='draft') as draft_po_count,
        (select count(*) from vyndi_purchase_orders where status in ('approved','issued','part_received')) as committed_po_count,
        (select count(*) from vyndi_quality_releases where superseded_at is null) as quality_releases,
        (select count(*) from vyndi_shipments where status='posted') as shipments,
        (select count(*) from vyndi_invoices where status='issued') as invoices,
        (select count(*) from vyndi_collections where status='posted') as collections,
        (select count(*) from (
          with jc as (
            select sku,
                   sum(case when coalesce(issue_status,'') <> 'issued' then required_quantity else 0 end)::numeric as open_required,
                   sum(case when coalesce(issue_status,'') <> 'issued' then reserved_quantity else 0 end)::numeric as open_reserved,
                   sum(case when coalesce(issue_status,'') <> 'issued' then shortage_quantity else 0 end)::numeric as open_shortage
              from vyndi_live_job_card_requirements
             where sku is not null
             group by sku
          ), pr as (
            select sku,
                   sum(committed_requirement)::numeric as committed_requirement,
                   sum(reserved_quantity)::numeric as procurement_reserved,
                   sum(net_committed_shortage)::numeric as net_committed_shortage
              from vyndi_committed_procurement_requirements
             group by sku
          ), rn as (
            select sku,committed_reserved_qty from vyndi_report_procurement_net_requirement
          )
          select coalesce(jc.sku,pr.sku,rn.sku) as sku
            from jc
            full join pr on pr.sku=jc.sku
            full join rn on rn.sku=coalesce(jc.sku,pr.sku)
           where abs(coalesce(jc.open_required,0)-coalesce(pr.committed_requirement,0))>0.0001
              or abs(coalesce(jc.open_reserved,0)-coalesce(pr.procurement_reserved,0))>0.0001
              or abs(coalesce(jc.open_reserved,0)-coalesce(rn.committed_reserved_qty,0))>0.0001
              or abs(coalesce(jc.open_shortage,0)-coalesce(pr.net_committed_shortage,0))>0.0001
        ) reconciliation_mismatches) as reconciliation_mismatch_skus
    `),
    sql.query<Record<string, unknown>>(`select count(*) as total_items,count(*) filter (where lifecycle_status='draft') as draft_items from vyndi_people_office_cost_items`),
  ]);

  const run = runs[0];
  if (!run) return "Overall health is unavailable because no completed governed IBPE run exists.";
  const trace = traceRows[0] ?? {};
  const assurance = assuranceRows[0] ?? {};
  const actions = actionRows[0] ?? {};
  const production = productionRows[0] ?? {};
  const execution = executionRows[0] ?? {};
  const people = peopleRows[0] ?? {};
  const missingCosts = clean(run.missing_cost_skus).split(",").filter(Boolean).length;
  const reconciliationMismatchSkus = n(execution.reconciliation_mismatch_skus);

  const overall = n(run.critical_count) > 0 || n(run.minimum_liquidity) < 0 || n(execution.current_shortage_units) > 0 || reconciliationMismatchSkus > 0
    ? "RED"
    : n(run.high_count) > 0 ? "AMBER" : "GREEN";

  const green = [
    `${n(trace.total_job_cards) - n(trace.broken_origin_links)}/${n(trace.total_job_cards)} job cards resolve to their exact originating order revision`,
    `VIBPE assurance has ${n(assurance.exception_count)} active exceptions and ${n(assurance.blocked_gate_count)} exception-blocked registered gates`,
    `production-release rows are ${n(production.released_rows)}/${n(production.gate_rows)} RELEASED`,
  ];
  if (reconciliationMismatchSkus === 0) green.push("inventory reservation / committed procurement / open production-material demand reconciliation has 0 SKU mismatches");

  const red = [
    `minimum free liquidity after recommendations is ₹${n(run.minimum_liquidity).toFixed(3)}L`,
    `incremental funding need is ₹${n(run.funding_need).toFixed(3)}L with first breach ${run.first_breach ? `M${n(run.first_breach)}` : "not present"}`,
    `current open job-card material shortage is ${n(execution.current_shortage_units).toFixed(1)} units and the 36-month IBPE horizon carries ${n(run.shortage_sku_months)} shortage SKU-months`,
    `procurement cost authority covers ${n(run.resolved_cost_skus)}/${n(run.active_bom_skus)} active planning-BOM SKUs, with ${missingCosts} planned/exact committed cost exceptions in scope`,
  ];
  if (reconciliationMismatchSkus > 0) red.push(`operational demand/reservation/procurement reconciliation has ${reconciliationMismatchSkus} SKU mismatch${reconciliationMismatchSkus === 1 ? "" : "es"}`);

  return [
    `Current overall VYNDI health: ${overall}. Governed IBPE R${n(run.approved_plan_revision)} is ${n(run.business_health_score).toFixed(0)}/100 across ${n(run.expected_units).toFixed(0)} expected units.`,
    `GREEN — verified controls: ${green.join("; ")}.`,
    `AMBER — execution/governance hygiene: ${n(actions.active_actions)} operating actions remain in progress; ${n(actions.missing_due)} lack due dates and ${n(actions.missing_owner)} lack owners. ${n(execution.draft_po_count)} POs remain draft with ${n(execution.committed_po_count)} approved/issued/part-received. ${n(people.draft_items)}/${n(people.total_items)} People & Office cost items remain draft. Downstream Quality/Dispatch/Invoice/Collection counts are ${n(execution.quality_releases)}/${n(execution.shipments)}/${n(execution.invoices)}/${n(execution.collections)}.`,
    `RED — current blockers: ${red.join("; ")}.`,
    `Finding load: ${n(run.critical_count)} critical, ${n(run.high_count)} high and ${n(run.medium_count)} medium. Current high-level root causes are funding/liquidity, committed-supply coverage, procurement timing/cost authority and demand-vs-plan variance.`,
    `Evidence: governed IBPE input ${run.input_hash.slice(0, 8)} plus live action, assurance, traceability, production-release, material, procurement and downstream transaction ledgers.`
  ].join("\n\n");
}

export async function tryGovernanceDataAnswer(sql: Sql, question: string) {
  if (isTraceabilityExceptionQuestion(question)) return traceabilityExceptionAnswer(sql);
  if (isGovernanceOperatingStatusQuestion(question)) return governanceOperatingStatusAnswer(sql);
  if (isOverallRagHealthQuestion(question)) return overallRagHealthAnswer(sql);
  return undefined;
}
