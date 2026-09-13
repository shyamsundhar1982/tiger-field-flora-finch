import type { Sql } from "@/lib/db";

const n = (value: string | number | null | undefined) => Number(value ?? 0);
const moneyLakh = (value: string | number | null | undefined) => `₹${n(value).toFixed(1)}L`;
const plural = (value: number, singular: string, pluralValue = `${singular}s`) => value === 1 ? singular : pluralValue;

function normalized(question: string) {
  return question.toLowerCase().replace(/\s+/g, " ").trim();
}

export function isLiveOperationalSpecialistQuestion(question: string) {
  const q = normalized(question);
  const exactCommittedSku = /\bskus?\b/.test(q)
    && /\b(confirmed|committed|customer)\b/.test(q)
    && /\b(short|shortage|prevent|block|blocking|entering production|production)\b/.test(q);
  const orderRisk = /\b(confirmed|customer)\b/.test(q)
    && /\borders?\b/.test(q)
    && /\b(risk|at risk|promise date|late|delay|miss|missing|delivery)\b/.test(q)
    && /\b(material|supplier|capacity|production)\b/.test(q);
  const reconciliation = /\b(reconcil|agree|match|align|consistent|tie out|ties out|exceptions?)\b/.test(q)
    && [/inventory|reserv/, /procure|purchase|requirements?/, /job[- ]?card|production|material demand/]
      .filter((pattern) => pattern.test(q)).length >= 2;
  const supplierRisk = /\bsupplier(?:-related)?\b/.test(q)
    && /\b(risk|risks|threat|threaten|constraint|constraints|block|blocking)\b/.test(q)
    && /\b(production|orders?|material|supply)\b/.test(q);
  const liquidityTriage = /\b(no|without)\b[^.?!]{0,40}\b(additional|new)?\s*funding\b/.test(q)
    && /\b(slow|slowed|defer|deferred|protect|protected|priorit|pace)\b/.test(q);
  const rankedRisk = /\b(top|rank|ranked|highest|five|5)\b/.test(q)
    && /\boperational risks?\b|\brisks?\b[^.?!]{0,30}\bbusiness impact\b/.test(q);
  const capacitySeparation = /\bcapacity\b/.test(q)
    && /\b(confirmed|committed)\b/.test(q)
    && /\b(approved plan|plan)\b/.test(q)
    && /\b(material|materials)\b/.test(q);
  const founderReview = /\bfounder(?:'s)?\b/.test(q)
    && /\b(operating review|decision|decisions|execute|commit|committed)\b/.test(q);

  return exactCommittedSku || orderRisk || reconciliation || supplierRisk || liquidityTriage || rankedRisk || capacitySeparation || founderReview;
}

async function exactCommittedSkuAnswer(sql: Sql) {
  const rows = await sql.query<{
    requirement_month: string | number;
    sku: string;
    item_name: string | null;
    committed_requirement: string | number;
    net_committed_shortage: string | number;
    open_po_qty: string | number;
  }>(`
    select p.requirement_month,
           p.sku,
           i.name as item_name,
           p.committed_requirement,
           p.net_committed_shortage,
           coalesce(r.open_po_qty,0) as open_po_qty
      from vyndi_committed_procurement_requirements p
      left join master_inventory_items i on i.sku=p.sku
      left join vyndi_report_procurement_net_requirement r on r.sku=p.sku
     where p.net_committed_shortage > 0
     order by p.requirement_month,p.net_committed_shortage desc,p.sku
  `);

  if (!rows.length) {
    return "Exact committed-SKU shortage check: PASS — no committed SKU currently has a net material shortage.";
  }

  const shortage = rows.reduce((sum, row) => sum + n(row.net_committed_shortage), 0);
  const openPo = rows.reduce((sum, row) => sum + n(row.open_po_qty), 0);
  const details = rows.map((row) => {
    const name = row.item_name ? ` (${row.item_name})` : "";
    return `${row.sku}${name}: ${n(row.net_committed_shortage).toFixed(1)} short of ${n(row.committed_requirement).toFixed(1)} required at M${n(row.requirement_month).toFixed(0)}`;
  }).join("; ");

  return [
    `Exact committed-SKU shortage check: BLOCKED — ${shortage.toFixed(1)} component units across ${rows.length} SKU${rows.length === 1 ? "" : "s"} are preventing full material coverage of confirmed demand.`,
    `Short SKUs: ${details}.`,
    `Authorised/open-PO coverage recorded for these short committed rows is ${openPo.toFixed(1)} component units.`,
    "Controlled next action: cover each exact gap with available stock, an approved substitute, or an authorised/confirmed receipt before treating the affected confirmed order as immediately producible.",
  ].join("\n\n");
}

async function confirmedOrderRiskAnswer(sql: Sql) {
  const orders = await sql.query<{
    sales_order_id: string;
    product_label: string | null;
    plan_month: string | number | null;
    job_card_id: string | null;
    due_month: string | number | null;
    material_shortage: string | number;
    draft_po_count: string | number;
    committed_po_count: string | number;
  }>(`
    with job as (
      select jc.id as job_card_id,
             jc.sales_order_id,
             jc.sales_order_revision,
             jc.product_label,
             jc.due_month,
             coalesce(sum(case when r.sku is not null and coalesce(r.issue_status,'') <> 'issued' then r.shortage_quantity else 0 end),0)::numeric as material_shortage
        from epr_production_job_cards jc
        left join vyndi_live_job_card_requirements r on r.job_card_id=jc.id
       where jc.status in ('released','in_progress')
       group by jc.id,jc.sales_order_id,jc.sales_order_revision,jc.product_label,jc.due_month
    ), po as (
      select job_card_id,
             count(*) filter (where status='draft')::int as draft_po_count,
             count(*) filter (where status in ('approved','issued','part_received'))::int as committed_po_count
        from vyndi_purchase_orders
       group by job_card_id
    )
    select o.id as sales_order_id,
           coalesce(j.product_label,o.variant_name,o.product_id) as product_label,
           o.plan_month,
           j.job_card_id,
           j.due_month,
           coalesce(j.material_shortage,0) as material_shortage,
           coalesce(p.draft_po_count,0) as draft_po_count,
           coalesce(p.committed_po_count,0) as committed_po_count
      from vyndi_sales_orders o
      left join job j on j.sales_order_id=o.id and j.sales_order_revision=o.revision
      left join po p on p.job_card_id=j.job_card_id
     where o.status='confirmed'
     order by o.plan_month,o.id
  `);

  const [capacity] = await sql.query<{ capacity_shortfall_months: string | number }>(`
    select coalesce((result_json->'summary'->>'capacityShortfallMonths')::numeric,0) as capacity_shortfall_months
      from vyndi_ibpe_runs
     where status='complete'
     order by created_at desc
     limit 1
  `);

  if (!orders.length) return "Confirmed-order risk assessment: no confirmed open customer orders are currently recorded.";

  const atRisk = orders.filter((row) => n(row.material_shortage) > 0 || n(row.committed_po_count) === 0);
  const details = orders.map((row) => {
    const reasons = [
      n(row.material_shortage) > 0 ? `${n(row.material_shortage).toFixed(1)} material units short` : "material covered",
      n(row.committed_po_count) > 0 ? `${n(row.committed_po_count)} authorised/open supplier commitment rows` : `${n(row.draft_po_count)} draft PO rows and no authorised supplier commitment`,
    ];
    return `${row.product_label ?? row.sales_order_id}${row.job_card_id ? ` (${row.job_card_id})` : ""}: ${reasons.join("; ")}; due/plan M${n(row.due_month ?? row.plan_month).toFixed(0)}`;
  }).join(" | ");

  return [
    `Confirmed-order delivery risk: ${atRisk.length ? `AT RISK — ${atRisk.length} of ${orders.length} confirmed order threads have an unresolved material and/or supplier-commitment blocker` : `no current material/supplier blocker is evidenced across ${orders.length} confirmed order threads`}.`,
    details,
    `Capacity: the latest governed IBPE model reports ${n(capacity?.capacity_shortfall_months).toFixed(0)} capacity shortfall months, so modeled capacity is ${n(capacity?.capacity_shortfall_months) > 0 ? "also a risk" : "not the current blocker"}.`,
    "Promise-date limitation: the governed sales-order record stores plan month and the job card stores due month; it does not store a calendar customer promise date. VIBPE can therefore identify delivery risk against the due/plan period, but it should not claim a calendar promise is already late without separate promise-date evidence.",
    "Controlled next action: convert the required replenishment from draft to authorised supplier commitment (or approved substitute/stock coverage) and confirm receipt timing against each job-card due month before confirming customer delivery.",
  ].join("\n\n");
}

type ReconciliationRow = {
  sku: string;
  open_required: string | number;
  job_reserved: string | number;
  job_shortage: string | number;
  issued_qty: string | number;
  committed_requirement: string | number;
  procurement_reserved: string | number;
  net_committed_shortage: string | number;
  report_reserved: string | number;
  open_po_qty: string | number;
};

async function operationalReconciliationAnswer(sql: Sql) {
  const rows = await sql.query<ReconciliationRow>(`
    with jc as (
      select sku,
             sum(case when coalesce(issue_status,'') <> 'issued' then required_quantity else 0 end)::numeric as open_required,
             sum(case when coalesce(issue_status,'') <> 'issued' then reserved_quantity else 0 end)::numeric as open_reserved,
             sum(case when coalesce(issue_status,'') <> 'issued' then shortage_quantity else 0 end)::numeric as open_shortage,
             sum(case when issue_status='issued' then required_quantity else 0 end)::numeric as issued_qty
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
      select sku,committed_reserved_qty,open_po_qty
        from vyndi_report_procurement_net_requirement
    )
    select coalesce(jc.sku,pr.sku,rn.sku) as sku,
           coalesce(jc.open_required,0) as open_required,
           coalesce(jc.open_reserved,0) as job_reserved,
           coalesce(jc.open_shortage,0) as job_shortage,
           coalesce(jc.issued_qty,0) as issued_qty,
           coalesce(pr.committed_requirement,0) as committed_requirement,
           coalesce(pr.procurement_reserved,0) as procurement_reserved,
           coalesce(pr.net_committed_shortage,0) as net_committed_shortage,
           coalesce(rn.committed_reserved_qty,0) as report_reserved,
           coalesce(rn.open_po_qty,0) as open_po_qty
      from jc
      full join pr on pr.sku=jc.sku
      full join rn on rn.sku=coalesce(jc.sku,pr.sku)
     order by sku
  `);

  const mismatches = rows.filter((row) =>
    Math.abs(n(row.open_required) - n(row.committed_requirement)) > 0.0001
    || Math.abs(n(row.job_reserved) - n(row.procurement_reserved)) > 0.0001
    || Math.abs(n(row.job_reserved) - n(row.report_reserved)) > 0.0001
    || Math.abs(n(row.job_shortage) - n(row.net_committed_shortage)) > 0.0001
  );
  const totals = rows.reduce((acc, row) => ({
    demand: acc.demand + n(row.open_required),
    committed: acc.committed + n(row.committed_requirement),
    reserved: acc.reserved + n(row.job_reserved),
    shortage: acc.shortage + n(row.job_shortage),
    issued: acc.issued + n(row.issued_qty),
    openPo: acc.openPo + n(row.open_po_qty),
  }), { demand: 0, committed: 0, reserved: 0, shortage: 0, issued: 0, openPo: 0 });

  if (!mismatches.length) {
    return [
      "Operational reconciliation: PASS — inventory/job-card/procurement ledgers agree at committed-SKU level.",
      `Open/unissued job-card material demand ${totals.demand.toFixed(1)} = committed procurement requirement ${totals.committed.toFixed(1)}; active reservations are ${totals.reserved.toFixed(1)} and reconcile across job-card/procurement/report views; open shortage is ${totals.shortage.toFixed(1)}.`,
      `Already-issued material ${totals.issued.toFixed(1)} is excluded from current demand. Authorised/open PO coverage is ${totals.openPo.toFixed(1)}.`,
      "Exceptions: none at SKU reconciliation level. A PASS means the ledgers agree; it does not mean material is available or production is ready.",
    ].join("\n\n");
  }

  return [
    `Operational reconciliation: FAIL — ${mismatches.length} committed SKU ${plural(mismatches.length, "mismatch", "mismatches")}.`,
    `Exceptions: ${mismatches.slice(0, 20).map((row) => `${row.sku}: job demand ${n(row.open_required).toFixed(1)}, committed requirement ${n(row.committed_requirement).toFixed(1)}, job reservation ${n(row.job_reserved).toFixed(1)}, procurement reservation ${n(row.procurement_reserved).toFixed(1)}, shortage ${n(row.net_committed_shortage).toFixed(1)}`).join("; ")}.`,
    "Controlled next action: reconcile the affected job-card requirement/reservation rows before relying on procurement or ATP decisions.",
  ].join("\n\n");
}

async function supplierRiskAnswer(sql: Sql) {
  const [po] = await sql.query<{
    draft_rows: string | number;
    draft_qty: string | number;
    unassigned_draft_rows: string | number;
    committed_rows: string | number;
    committed_qty: string | number;
  }>(`
    select count(*) filter (where status='draft')::int as draft_rows,
           coalesce(sum(quantity) filter (where status='draft'),0)::numeric as draft_qty,
           count(*) filter (where status='draft' and supplier_id is null)::int as unassigned_draft_rows,
           count(*) filter (where status in ('approved','issued','part_received'))::int as committed_rows,
           coalesce(sum(quantity) filter (where status in ('approved','issued','part_received')),0)::numeric as committed_qty
      from vyndi_purchase_orders
  `);
  const [supplier] = await sql.query<{
    approved_active: string | number;
    missing_quality_rating: string | number;
    missing_delivery_rating: string | number;
  }>(`
    select count(*) filter (where active and approval_status='approved')::int as approved_active,
           count(*) filter (where active and quality_rating is null)::int as missing_quality_rating,
           count(*) filter (where active and delivery_rating is null)::int as missing_delivery_rating
      from vyndi_suppliers
  `);
  const [shortage] = await sql.query<{ shortage_qty: string | number; shortage_skus: string | number }>(`
    select coalesce(sum(net_committed_shortage),0)::numeric as shortage_qty,
           count(distinct sku)::int as shortage_skus
      from vyndi_committed_procurement_requirements
     where net_committed_shortage > 0
  `);

  const risks: string[] = [];
  if (n(shortage?.shortage_qty) > 0 && n(po?.committed_rows) === 0) {
    risks.push(`CRITICAL — ${n(shortage?.shortage_qty).toFixed(1)} committed component units across ${n(shortage?.shortage_skus).toFixed(0)} SKUs are short while there are 0 approved/issued/part-received supplier commitment rows. Action: assign an approved source and move only the required committed-order replenishment through controlled PO approval/issue.`);
  }
  if (n(po?.unassigned_draft_rows) > 0) {
    risks.push(`HIGH — ${n(po?.unassigned_draft_rows).toFixed(0)} draft PO lines are supplier-unassigned. Action: source each line to an approved supplier (or approved substitute) and validate lead time/receipt date before approval.`);
  }
  if (n(supplier?.approved_active) === 0) {
    risks.push("HIGH — no active approved supplier exists in the supplier master. Action: complete supplier approval before issuing a purchase commitment.");
  }
  if (n(supplier?.missing_quality_rating) > 0 || n(supplier?.missing_delivery_rating) > 0) {
    risks.push(`MEDIUM — supplier performance evidence is incomplete: ${n(supplier?.missing_quality_rating).toFixed(0)} active supplier rows lack quality rating and ${n(supplier?.missing_delivery_rating).toFixed(0)} lack delivery rating. Action: populate governed supplier performance evidence before relying on supplier ranking for production-critical sourcing.`);
  }

  return [
    `Supplier-risk assessment: ${risks.length ? `${risks.length} current supplier/procurement control risks are evidenced` : "no supplier-control risk is currently evidenced"}.`,
    risks.length ? risks.join("\n") : "No supplier risk action is currently required from the live supplier/PO evidence.",
    `Current PO state: ${n(po?.draft_rows).toFixed(0)} draft lines / ${n(po?.draft_qty).toFixed(1)} units; ${n(po?.committed_rows).toFixed(0)} approved/issued/part-received lines / ${n(po?.committed_qty).toFixed(1)} units. Draft POs are not supplier commitments.`,
  ].join("\n\n");
}

async function liquidityTriageAnswer(sql: Sql) {
  const [run] = await sql.query<{
    minimum_liquidity: string | number;
    funding_need: string | number;
    first_breach: string | number | null;
    committed_units: string | number;
    recommended_procurement: string | number;
  }>(`
    select coalesce((result_json->'summary'->>'minimumFreeLiquidityAfterRecommendationsLakh')::numeric,0) as minimum_liquidity,
           coalesce((result_json->'funding'->>'incrementalFundingNeedLakh')::numeric,0) as funding_need,
           nullif(result_json->'funding'->>'firstLiquidityBreachAfterRecommendationsPeriod','')::int as first_breach,
           coalesce((result_json->'summary'->>'committedOpenUnits')::numeric,0) as committed_units,
           coalesce((result_json->'summary'->>'totalRecommendedProcurementLakh')::numeric,0) as recommended_procurement
      from vyndi_ibpe_runs
     where status='complete'
     order by created_at desc
     limit 1
  `);
  const [commitment] = await sql.query<{ shortage_qty: string | number }>(`
    select coalesce(sum(net_committed_shortage),0)::numeric as shortage_qty
      from vyndi_committed_procurement_requirements
  `);

  return [
    `No-new-funding triage: AT RISK — minimum free liquidity is ${moneyLakh(run?.minimum_liquidity)}; incremental funding need is ${moneyLakh(run?.funding_need)} and the first modeled liquidity breach is ${run?.first_breach ? `M${n(run.first_breach).toFixed(0)}` : "not present in the governed horizon"}.`,
    `Protect first: the ${n(run?.committed_units).toFixed(0)} confirmed customer units, the ${n(commitment?.shortage_qty).toFixed(1)} component units needed to unblock them, and mandatory safety/quality/statutory controls. These are the highest-priority operating commitments, subject to authorised funding and procurement approval.`,
    `Slow/defer first: forecast/buffer replenishment not required for confirmed orders, discretionary expansion or nonessential spend, and any recommendation that would deepen the liquidity breach. The broader ${moneyLakh(run?.recommended_procurement)} planning procurement recommendation must not be converted automatically into commitments while unfunded.`,
    "Evidence limitation: the current governed packet does not rank every discretionary cost line by avoidability, so VIBPE should not invent a named cost-cut list. Finance/People & Office owners should disposition specific spend items through their approval lifecycle.",
  ].join("\n\n");
}

async function rankedOperationalRiskAnswer(sql: Sql) {
  const [run] = await sql.query<{
    health: string | number;
    minimum_liquidity: string | number;
    funding_need: string | number;
    capacity_shortfall_months: string | number;
  }>(`
    select coalesce((result_json->'summary'->>'businessHealthScore')::numeric,0) as health,
           coalesce((result_json->'summary'->>'minimumFreeLiquidityAfterRecommendationsLakh')::numeric,0) as minimum_liquidity,
           coalesce((result_json->'funding'->>'incrementalFundingNeedLakh')::numeric,0) as funding_need,
           coalesce((result_json->'summary'->>'capacityShortfallMonths')::numeric,0) as capacity_shortfall_months
      from vyndi_ibpe_runs
     where status='complete'
     order by created_at desc
     limit 1
  `);
  const [material] = await sql.query<{ shortage_qty: string | number; shortage_skus: string | number }>(`
    select coalesce(sum(net_committed_shortage),0)::numeric as shortage_qty,
           count(distinct sku)::int as shortage_skus
      from vyndi_committed_procurement_requirements
     where net_committed_shortage > 0
  `);
  const [po] = await sql.query<{ draft_rows: string | number; committed_rows: string | number; unassigned_drafts: string | number }>(`
    select count(*) filter (where status='draft')::int as draft_rows,
           count(*) filter (where status in ('approved','issued','part_received'))::int as committed_rows,
           count(*) filter (where status='draft' and supplier_id is null)::int as unassigned_drafts
      from vyndi_purchase_orders
  `);
  const [assurance] = await sql.query<{ critical_count: string | number; top_gate: string | null; top_type: string | null }>(`
    select count(*) filter (where severity='critical')::int as critical_count,
           (array_agg(gate_id order by case severity when 'critical' then 0 when 'high' then 1 else 2 end))[1] as top_gate,
           (array_agg(exception_type order by case severity when 'critical' then 0 when 'high' then 1 else 2 end))[1] as top_type
      from vyndi_vibpe_assurance_exceptions_all
  `);
  const [actions] = await sql.query<{ open_actions: string | number; unowned: string | number; no_due: string | number }>(`
    select count(*) filter (where lower(status) not in ('done','completed','closed','cancelled'))::int as open_actions,
           count(*) filter (where lower(status) not in ('done','completed','closed','cancelled') and nullif(trim(coalesce(owner,'')),'') is null)::int as unowned,
           count(*) filter (where lower(status) not in ('done','completed','closed','cancelled') and due_on is null)::int as no_due
      from vyndi_operating_actions
  `);

  const risks = [
    `1. LIQUIDITY — minimum free liquidity ${moneyLakh(run?.minimum_liquidity)} with ${moneyLakh(run?.funding_need)} incremental funding need. Impact: the current operating/supply response is not fully funded. Action: funding, cost and pace decision before new commitments.`,
    `2. CONFIRMED-ORDER MATERIAL COVERAGE — ${n(material?.shortage_qty).toFixed(1)} component units across ${n(material?.shortage_skus).toFixed(0)} committed SKUs are short. Impact: confirmed bikes are not immediately producible. Action: stock, approved substitutes or confirmed receipts against exact gaps.`,
    `3. SUPPLIER COMMITMENT — ${n(po?.draft_rows).toFixed(0)} draft PO lines (${n(po?.unassigned_drafts).toFixed(0)} supplier-unassigned) versus ${n(po?.committed_rows).toFixed(0)} approved/issued/part-received lines. Impact: replenishment exists as draft intent, not supplier commitment. Action: source, approve and issue only funded committed-order requirements.`,
    `4. ASSURANCE / AUDIT — ${n(assurance?.critical_count).toFixed(0)} critical active assurance exception${assurance?.top_gate ? ` at ${assurance.top_gate}` : ""}${assurance?.top_type ? ` (${assurance.top_type})` : ""}. Impact: assurance governance remains blocked. Action: clear the underlying capability/evidence exception and re-evaluate the gate.`,
    `5. ACTION HYGIENE — ${n(actions?.open_actions).toFixed(0)} open actions; ${n(actions?.unowned).toFixed(0)} unowned and ${n(actions?.no_due).toFixed(0)} without due date. Impact: execution accountability and escalation timing are weak. Action: assign accountable owners and due dates.`,
  ];

  return [
    `Top operational risks by current business impact (business health ${n(run?.health).toFixed(0)}/100):`,
    risks.join("\n"),
    `Capacity context: ${n(run?.capacity_shortfall_months).toFixed(0)} modeled capacity shortfall months; current risk concentration is therefore liquidity/material/supplier/governance execution rather than plant capacity.`,
  ].join("\n\n");
}

async function capacitySeparationAnswer(sql: Sql) {
  const [run] = await sql.query<{
    expected_units: string | number;
    committed_units: string | number;
    shortage_sku_months: string | number;
    capacity_shortfall_months: string | number;
  }>(`
    select coalesce((result_json->'summary'->>'expectedUnits')::numeric,0) as expected_units,
           coalesce((result_json->'summary'->>'committedOpenUnits')::numeric,0) as committed_units,
           coalesce((result_json->'summary'->>'fulfillmentShortageSkuMonths')::numeric,0) as shortage_sku_months,
           coalesce((result_json->'summary'->>'capacityShortfallMonths')::numeric,0) as capacity_shortfall_months
      from vyndi_ibpe_runs
     where status='complete'
     order by created_at desc
     limit 1
  `);
  const [commitment] = await sql.query<{ shortage_qty: string | number; shortage_skus: string | number; open_po_qty: string | number }>(`
    select coalesce(sum(p.net_committed_shortage),0)::numeric as shortage_qty,
           count(distinct p.sku) filter (where p.net_committed_shortage > 0)::int as shortage_skus,
           coalesce(sum(r.open_po_qty),0)::numeric as open_po_qty
      from vyndi_committed_procurement_requirements p
      left join vyndi_report_procurement_net_requirement r on r.sku=p.sku
  `);

  const capacityMonths = n(run?.capacity_shortfall_months);
  return [
    `Capacity/material separation: ${capacityMonths === 0 ? "MODELED CAPACITY IS SUFFICIENT; MATERIAL COVERAGE IS NOT" : "CAPACITY AND MATERIAL CONSTRAINTS BOTH REQUIRE ACTION"}.`,
    `Confirmed demand: ${n(run?.committed_units).toFixed(0)} open committed units. Exact committed material shortage is ${n(commitment?.shortage_qty).toFixed(1)} component units across ${n(commitment?.shortage_skus).toFixed(0)} SKUs; authorised/open-PO coverage is ${n(commitment?.open_po_qty).toFixed(1)}. This is the immediate production blocker.`,
    `Approved-plan capacity: ${n(run?.expected_units).toFixed(0)} expected units in the governed horizon and ${capacityMonths.toFixed(0)} modeled capacity shortfall months. On current governed capacity evidence, capacity ${capacityMonths === 0 ? "does not constrain the approved plan" : "does constrain the approved plan"}.`,
    `Approved-plan material exposure: ${n(run?.shortage_sku_months).toFixed(0)} reconciled supply-shortage SKU-months. This is broader plan/forecast exposure and must not be confused with the exact committed-order shortage above.`,
    "Controlled next action: solve exact committed material/supplier coverage first; do not add capacity merely to address a supply-shortage problem when the capacity model shows no shortfall.",
  ].join("\n\n");
}

async function founderOperatingReviewAnswer(sql: Sql) {
  const [run] = await sql.query<{
    health: string | number;
    committed_units: string | number;
    minimum_liquidity: string | number;
    funding_need: string | number;
    capacity_shortfall_months: string | number;
  }>(`
    select coalesce((result_json->'summary'->>'businessHealthScore')::numeric,0) as health,
           coalesce((result_json->'summary'->>'committedOpenUnits')::numeric,0) as committed_units,
           coalesce((result_json->'summary'->>'minimumFreeLiquidityAfterRecommendationsLakh')::numeric,0) as minimum_liquidity,
           coalesce((result_json->'funding'->>'incrementalFundingNeedLakh')::numeric,0) as funding_need,
           coalesce((result_json->'summary'->>'capacityShortfallMonths')::numeric,0) as capacity_shortfall_months
      from vyndi_ibpe_runs
     where status='complete'
     order by created_at desc
     limit 1
  `);
  const [material] = await sql.query<{ shortage_qty: string | number; shortage_skus: string | number }>(`
    select coalesce(sum(net_committed_shortage),0)::numeric as shortage_qty,
           count(distinct sku) filter (where net_committed_shortage > 0)::int as shortage_skus
      from vyndi_committed_procurement_requirements
  `);
  const [po] = await sql.query<{ draft_rows: string | number; committed_rows: string | number; unassigned_drafts: string | number }>(`
    select count(*) filter (where status='draft')::int as draft_rows,
           count(*) filter (where status in ('approved','issued','part_received'))::int as committed_rows,
           count(*) filter (where status='draft' and supplier_id is null)::int as unassigned_drafts
      from vyndi_purchase_orders
  `);
  const [assurance] = await sql.query<{ critical_count: string | number }>(`
    select count(*) filter (where severity='critical')::int as critical_count
      from vyndi_vibpe_assurance_exceptions_all
  `);
  const [actions] = await sql.query<{ open_actions: string | number; unowned: string | number; no_due: string | number }>(`
    select count(*) filter (where lower(status) not in ('done','completed','closed','cancelled'))::int as open_actions,
           count(*) filter (where lower(status) not in ('done','completed','closed','cancelled') and nullif(trim(coalesce(owner,'')),'') is null)::int as unowned,
           count(*) filter (where lower(status) not in ('done','completed','closed','cancelled') and due_on is null)::int as no_due
      from vyndi_operating_actions
  `);

  return [
    `Founder operating review: AMBER/RED execution posture — business health ${n(run?.health).toFixed(0)}/100, minimum free liquidity ${moneyLakh(run?.minimum_liquidity)}, ${moneyLakh(run?.funding_need)} funding need, ${n(material?.shortage_qty).toFixed(1)} committed component units short, and ${n(run?.capacity_shortfall_months).toFixed(0)} capacity shortfall months.`,
    `Requires founder/authorised management decision today: (1) funding/cost/pace response before the liquidity breach; (2) whether and how to authorise supplier commitments or approved substitutes for the ${n(run?.committed_units).toFixed(0)} confirmed customer units; (3) disposition/escalation of ${n(assurance?.critical_count).toFixed(0)} critical assurance exception.`,
    `Team can execute without a new strategic decision: complete supplier assignment/evidence for ${n(po?.unassigned_drafts).toFixed(0)} unassigned draft PO lines, prepare the ${n(po?.draft_rows).toFixed(0)} draft lines for the owning approval workflow, maintain job-card/material reconciliation, and clean action hygiene (${n(actions?.unowned).toFixed(0)} unowned / ${n(actions?.no_due).toFixed(0)} without due date). Transaction approval remains with the authorised owning role.`,
    `Do not commit yet: immediate production/delivery of the confirmed orders while ${n(material?.shortage_qty).toFixed(1)} material units remain uncovered; the ${n(po?.draft_rows).toFixed(0)} draft POs as if they were supplier commitments; or unfunded planning recommendations as approved purchases.`,
    `Current management focus: material/procurement authorisation plus liquidity protection. Capacity expansion is not the corrective action while the governed model reports ${n(run?.capacity_shortfall_months).toFixed(0)} capacity shortfall months.`,
  ].join("\n\n");
}

export async function tryVibpeLiveSpecialistAnswer(sql: Sql, question: string) {
  const q = normalized(question);

  if (/\bfounder(?:'s)?\b/.test(q) && /\b(operating review|decision|decisions|execute|commit|committed)\b/.test(q)) {
    return founderOperatingReviewAnswer(sql);
  }
  if (/\b(top|rank|ranked|highest|five|5)\b/.test(q) && (/\boperational risks?\b/.test(q) || /\brisks?\b[^.?!]{0,30}\bbusiness impact\b/.test(q))) {
    return rankedOperationalRiskAnswer(sql);
  }
  if (/\bcapacity\b/.test(q) && /\b(confirmed|committed)\b/.test(q) && /\b(approved plan|plan)\b/.test(q) && /\bmaterial|materials\b/.test(q)) {
    return capacitySeparationAnswer(sql);
  }
  if (/\b(confirmed|customer)\b/.test(q) && /\borders?\b/.test(q) && /\b(risk|at risk|promise date|late|delay|miss|missing|delivery)\b/.test(q) && /\b(material|supplier|capacity|production)\b/.test(q)) {
    return confirmedOrderRiskAnswer(sql);
  }
  if (/\bskus?\b/.test(q) && /\b(confirmed|committed|customer)\b/.test(q) && /\b(short|shortage|prevent|block|blocking|entering production|production)\b/.test(q)) {
    return exactCommittedSkuAnswer(sql);
  }
  if (/\b(reconcil|agree|match|align|consistent|tie out|ties out|exceptions?)\b/.test(q)
    && [/inventory|reserv/, /procure|purchase|requirements?/, /job[- ]?card|production|material demand/].filter((pattern) => pattern.test(q)).length >= 2) {
    return operationalReconciliationAnswer(sql);
  }
  if (/\bsupplier(?:-related)?\b/.test(q) && /\b(risk|risks|threat|threaten|constraint|constraints|block|blocking)\b/.test(q) && /\b(production|orders?|material|supply)\b/.test(q)) {
    return supplierRiskAnswer(sql);
  }
  if (/\b(no|without)\b[^.?!]{0,40}\b(additional|new)?\s*funding\b/.test(q) && /\b(slow|slowed|defer|deferred|protect|protected|priorit|pace)\b/.test(q)) {
    return liquidityTriageAnswer(sql);
  }
  return undefined;
}
