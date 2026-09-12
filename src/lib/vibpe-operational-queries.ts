import type { Sql } from "@/lib/db";

type ReconciliationRow = {
  sku: string;
  open_required: string | number;
  job_reserved: string | number;
  job_shortage: string | number;
  issued_qty: string | number;
  committed_requirement: string | number;
  procurement_reserved: string | number;
  net_committed_shortage: string | number;
  physical_qty: string | number;
  report_reserved: string | number;
  atp_qty: string | number;
  open_po_qty: string | number;
  open_job_cards: string | number;
};

type CommittedFeasibilitySummaryRow = {
  confirmed_orders: string | number;
  confirmed_units: string | number;
  active_job_cards: string | number;
  committed_component_units: string | number;
  committed_skus: string | number;
  net_committed_shortage: string | number;
  open_po_qty: string | number;
  capacity_shortfall_months: string | number | null;
  latest_run_id: string | null;
};

type CommittedGapRow = {
  requirement_month: string | number;
  sku: string;
  committed_requirement: string | number;
  net_committed_shortage: string | number;
};

type BusinessHealthRow = {
  id: string;
  approved_plan_revision: string | number;
  created_at: string;
  business_health_score: string | number;
  expected_units: string | number;
  committed_open_units: string | number;
  shortage_sku_months: string | number;
  capacity_shortfall_months: string | number;
  recommended_procurement_lakh: string | number;
  minimum_free_liquidity_lakh: string | number;
  incremental_funding_need_lakh: string | number;
};

type BusinessFindingRow = {
  severity: string;
  title: string;
  recommended_action: string;
};

type SupplierRow = {
  id: string;
  name: string;
  currency: string;
  payment_terms_days: number;
  lead_time_days: number;
  approval_status: string;
  active: boolean;
};

type SupplierPoRow = {
  id: string;
  sku: string;
  quantity: string | number;
  unit_price_inr: string | number;
  requirement_month: number | null;
  status: string;
  expected_receipt_on: string | null;
  job_card_id: string | null;
};

type SupplierPriceRow = {
  sku: string;
  price_type: string;
  unit_price_inr: string | number;
  currency: string;
  status: string;
};

const n = (value: string | number | null | undefined) => Number(value ?? 0);
const close = (a: number, b: number) => Math.abs(a - b) < 0.0001;
const moneyLakh = (value: string | number | null | undefined) => `₹${n(value).toFixed(1)}L`;

function isBusinessHealthQuestion(question: string) {
  return /\bbusiness\s+health\b/i.test(question);
}

async function businessHealthAnswer(sql: Sql) {
  const [run] = await sql.query<BusinessHealthRow>(`
    select id,
           approved_plan_revision,
           created_at::text,
           coalesce((result_json->'summary'->>'businessHealthScore')::numeric,0) as business_health_score,
           coalesce((result_json->'summary'->>'expectedUnits')::numeric,0) as expected_units,
           coalesce((result_json->'summary'->>'committedOpenUnits')::numeric,0) as committed_open_units,
           coalesce((result_json->'summary'->>'fulfillmentShortageSkuMonths')::numeric,0) as shortage_sku_months,
           coalesce((result_json->'summary'->>'capacityShortfallMonths')::numeric,0) as capacity_shortfall_months,
           coalesce((result_json->'summary'->>'totalRecommendedProcurementLakh')::numeric,0) as recommended_procurement_lakh,
           coalesce((result_json->'summary'->>'minimumFreeLiquidityAfterRecommendationsLakh')::numeric,0) as minimum_free_liquidity_lakh,
           coalesce((result_json->'funding'->>'incrementalFundingNeedLakh')::numeric,0) as incremental_funding_need_lakh
      from vyndi_ibpe_runs
     where status='complete'
     order by created_at desc
     limit 1
  `);

  if (!run) return "Business health is unavailable because no complete governed IBPE run exists.";

  const findings = await sql.query<BusinessFindingRow>(`
    with latest as (
      select result_json
        from vyndi_ibpe_runs
       where status='complete'
       order by created_at desc
       limit 1
    ), expanded as (
      select finding->>'severity' as severity,
             finding->>'title' as title,
             finding->>'recommendedAction' as recommended_action,
             case finding->>'severity'
               when 'critical' then 0
               when 'high' then 1
               when 'medium' then 2
               else 3
             end as severity_rank
        from latest,
             lateral jsonb_array_elements(result_json->'findings') as finding
    ), deduped as (
      select title,recommended_action,min(severity_rank) as severity_rank,
             (array_agg(severity order by severity_rank))[1] as severity
        from expanded
       where coalesce(title,'')<>''
       group by title,recommended_action
    )
    select severity,title,coalesce(recommended_action,'') as recommended_action
      from deduped
     order by severity_rank,title
     limit 4
  `);

  const top = findings.length
    ? findings.map((finding) => `${finding.title}${finding.recommended_action ? ` — ${finding.recommended_action}` : ""}`).join(" ")
    : "No governed findings are currently ranked.";

  return [
    `Business health: ${n(run.business_health_score).toFixed(0)}/100 across ${n(run.expected_units).toFixed(0)} expected units and ${n(run.committed_open_units).toFixed(0)} committed open units.`,
    `Planning exposure: ${n(run.shortage_sku_months).toFixed(0)} reconciled supply shortage SKU-months; ${n(run.capacity_shortfall_months).toFixed(0)} capacity shortfall months; recommended procurement ${moneyLakh(run.recommended_procurement_lakh)}.`,
    `Liquidity: minimum free liquidity after recommendations is ${moneyLakh(run.minimum_free_liquidity_lakh)}; incremental funding need is ${moneyLakh(run.incremental_funding_need_lakh)}.`,
    `Highest-priority findings: ${top}`,
    `Evidence: latest complete governed IBPE run R${n(run.approved_plan_revision).toFixed(0)} · ${run.id}. The supply-shortage count is a reconciled plan/commitment planning metric; exact committed-demand feasibility is assessed separately from live confirmed-order and job-card material evidence.`,
  ].join("\n\n");
}

function isCommittedDemandFeasibilityQuestion(question: string) {
  const q = question.toLowerCase().replace(/\s+/g, " ").trim();
  const asksCommitted = /\b(committed|confirmed)\b|customer\s+orders?/.test(q);
  const asksDemand = /\b(demand|orders?|units?|commitments?)\b/.test(q);
  const asksFeasibility = /\bcan\b[^?.]{0,80}\b(produce|produced|make|build|fulfil|fulfill|deliver)\b|\bproducible\b|production\s+feasibility|meet[^?.]{0,40}\bdemand\b|cover[^?.]{0,40}\bdemand\b/.test(q);
  return asksCommitted && asksDemand && asksFeasibility;
}

async function committedDemandFeasibilityAnswer(sql: Sql) {
  const [summary] = await sql.query<CommittedFeasibilitySummaryRow>(`
    with current_orders as (
      select count(*)::int as confirmed_orders,
             coalesce(sum(units),0)::numeric as confirmed_units
        from vyndi_sales_orders
       where status='confirmed'
    ), current_jobs as (
      select count(distinct jc.id)::int as active_job_cards
        from epr_production_job_cards jc
        join vyndi_sales_orders o
          on o.id=jc.sales_order_id
         and o.revision=jc.sales_order_revision
         and o.status='confirmed'
       where jc.status in ('released','in_progress')
    ), committed as (
      select coalesce(sum(committed_requirement),0)::numeric as committed_component_units,
             count(distinct sku)::int as committed_skus,
             coalesce(sum(net_committed_shortage),0)::numeric as net_committed_shortage
        from vyndi_committed_procurement_requirements
    ), open_po as (
      select coalesce(sum(r.open_po_qty),0)::numeric as open_po_qty
        from (select distinct sku from vyndi_committed_procurement_requirements) c
        join vyndi_report_procurement_net_requirement r on r.sku=c.sku
    ), latest as (
      select id as latest_run_id,
             coalesce((result_json->'summary'->>'capacityShortfallMonths')::numeric,0) as capacity_shortfall_months
        from vyndi_ibpe_runs
       where status='complete'
       order by created_at desc
       limit 1
    )
    select o.confirmed_orders,o.confirmed_units,j.active_job_cards,
           c.committed_component_units,c.committed_skus,c.net_committed_shortage,
           p.open_po_qty,l.capacity_shortfall_months,l.latest_run_id
      from current_orders o
      cross join current_jobs j
      cross join committed c
      cross join open_po p
      left join latest l on true
  `);

  if (!summary || n(summary.confirmed_units) <= 0) {
    return "Committed-demand feasibility: no confirmed open customer demand is currently recorded. No production promise should be inferred from the planning forecast alone.";
  }

  const gaps = await sql.query<CommittedGapRow>(`
    select requirement_month,sku,committed_requirement,net_committed_shortage
      from vyndi_committed_procurement_requirements
     where net_committed_shortage > 0
     order by net_committed_shortage desc,requirement_month,sku
     limit 8
  `);

  const confirmedUnits = n(summary.confirmed_units);
  const confirmedOrders = n(summary.confirmed_orders);
  const activeJobCards = n(summary.active_job_cards);
  const committedComponents = n(summary.committed_component_units);
  const committedSkus = n(summary.committed_skus);
  const materialShortage = n(summary.net_committed_shortage);
  const openPo = n(summary.open_po_qty);
  const capacityShortfallMonths = n(summary.capacity_shortfall_months);

  const status = materialShortage > 0
    ? "BLOCKED — exact committed material is not currently covered"
    : capacityShortfallMonths > 0
      ? "AT RISK — material is covered but the governed capacity model has shortfall months"
      : "FEASIBLE ON CURRENT MATERIAL/CAPACITY EVIDENCE";

  const lines = [
    `Committed-demand feasibility: ${status}.`,
    `Confirmed customer demand is ${confirmedUnits.toFixed(0)} unit${confirmedUnits === 1 ? "" : "s"} across ${confirmedOrders.toFixed(0)} open order${confirmedOrders === 1 ? "" : "s"}; ${activeJobCards.toFixed(0)} current released/in-progress job card${activeJobCards === 1 ? " is" : "s are"} linked to those confirmed orders.`,
    `Exact committed material demand is ${committedComponents.toFixed(1)} component units across ${committedSkus.toFixed(0)} SKU${committedSkus === 1 ? "" : "s"}. Current committed material shortage is ${materialShortage.toFixed(1)} component units; open-PO coverage recorded for those committed SKUs is ${openPo.toFixed(1)}.`,
    `Capacity: the latest governed IBPE run${summary.latest_run_id ? ` (${summary.latest_run_id})` : ""} reports ${capacityShortfallMonths.toFixed(0)} capacity shortfall month${capacityShortfallMonths === 1 ? "" : "s"}. This capacity result is broader planning evidence and does not override exact committed-material shortages.`,
  ];

  if (gaps.length) {
    lines.push(`Largest exact committed gaps: ${gaps.map((row) => `${row.sku} M${n(row.requirement_month).toFixed(0)}: ${n(row.net_committed_shortage).toFixed(1)} of ${n(row.committed_requirement).toFixed(1)} short`).join("; ")}.`);
  }

  if (materialShortage > 0) {
    lines.push("Conclusion: the confirmed demand should not be promised as immediately producible until the exact committed SKU shortages are covered by available stock, approved substitutes, or confirmed receipts. Procurement and production release remain controlled in their owning workspaces.");
  } else if (capacityShortfallMonths > 0) {
    lines.push("Conclusion: committed material is covered, but production timing remains constrained by modeled capacity. Resolve the relevant capacity period before confirming the customer promise date.");
  } else {
    lines.push("Conclusion: current governed evidence shows no committed-material or modeled capacity blocker. Final production release still depends on the owning production/quality gates.");
  }

  lines.push("Evidence: confirmed sales orders → current-revision job cards → live committed procurement requirements → inventory/ATP/open-PO evidence, with capacity from the latest governed IBPE run. The broader reconciled planning shortage is intentionally not presented as committed-demand shortage.");
  return lines.join("\n\n");
}

function isOperationalReconciliationQuestion(question: string) {
  const q = question.toLowerCase();
  const asksReconcile = /reconcil|match|align|consistent|tie out|ties out/.test(q);
  const operationalTerms = [
    /inventory|reservation|reserved/,
    /procure|requirement|mrp|purchase/,
    /production|job card|job-card|material demand|manufactur/,
  ].filter((pattern) => pattern.test(q)).length;
  return asksReconcile && operationalTerms >= 2;
}

async function reconciliationAnswer(sql: Sql) {
  const rows = await sql.query<ReconciliationRow>(`
    with jc as (
      select sku,
             sum(case when coalesce(issue_status,'') <> 'issued' then required_quantity else 0 end)::numeric as open_required,
             sum(case when coalesce(issue_status,'') <> 'issued' then reserved_quantity else 0 end)::numeric as open_reserved,
             sum(case when coalesce(issue_status,'') <> 'issued' then shortage_quantity else 0 end)::numeric as open_shortage,
             sum(case when issue_status = 'issued' then required_quantity else 0 end)::numeric as issued_qty,
             count(distinct job_card_id) filter (where coalesce(issue_status,'') <> 'issued') as open_job_cards
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
      select sku, physical_qty, committed_reserved_qty, atp_qty, open_po_qty
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
           coalesce(rn.physical_qty,0) as physical_qty,
           coalesce(rn.committed_reserved_qty,0) as report_reserved,
           coalesce(rn.atp_qty,0) as atp_qty,
           coalesce(rn.open_po_qty,0) as open_po_qty,
           coalesce(jc.open_job_cards,0) as open_job_cards
      from jc
      full join pr on pr.sku=jc.sku
      full join rn on rn.sku=coalesce(jc.sku,pr.sku)
     order by sku
  `);

  const mismatches = rows.filter((row) =>
    !close(n(row.open_required), n(row.committed_requirement)) ||
    !close(n(row.job_reserved), n(row.procurement_reserved)) ||
    !close(n(row.job_reserved), n(row.report_reserved)) ||
    !close(n(row.job_shortage), n(row.net_committed_shortage))
  );

  const totals = rows.reduce((acc, row) => ({
    openRequired: acc.openRequired + n(row.open_required),
    reserved: acc.reserved + n(row.job_reserved),
    shortage: acc.shortage + n(row.job_shortage),
    issued: acc.issued + n(row.issued_qty),
    committed: acc.committed + n(row.committed_requirement),
    openPo: acc.openPo + n(row.open_po_qty),
  }), { openRequired: 0, reserved: 0, shortage: 0, issued: 0, committed: 0, openPo: 0 });

  if (!mismatches.length) {
    return [
      "Operational reconciliation: PASS.",
      `Open/unissued production material demand (${totals.openRequired.toFixed(1)}) reconciles to committed procurement requirement (${totals.committed.toFixed(1)}). Active job-card reservations (${totals.reserved.toFixed(1)}) reconcile to procurement/report reservations, and open material shortage is ${totals.shortage.toFixed(1)}.`,
      `Already-issued material (${totals.issued.toFixed(1)}) is excluded from current procurement demand; routing/operation rows without a SKU are also excluded because they are not procurable material lines. Open PO quantity is ${totals.openPo.toFixed(1)}.`,
      "Evidence: live job-card requirements, inventory reservations/ATP, committed procurement requirements and procurement net-requirement views."
    ].join("\n\n");
  }

  const detail = mismatches.slice(0, 10).map((row) =>
    `${row.sku}: open demand ${n(row.open_required).toFixed(1)}, committed requirement ${n(row.committed_requirement).toFixed(1)}, job reservation ${n(row.job_reserved).toFixed(1)}, procurement reservation ${n(row.procurement_reserved).toFixed(1)}, net shortage ${n(row.net_committed_shortage).toFixed(1)}`
  ).join("; ");

  return [
    `Operational reconciliation: FAIL — ${mismatches.length} SKU mismatch${mismatches.length === 1 ? "" : "es"}.`,
    detail,
    "Controlled next action: reconcile the affected job-card requirement/reservation rows before relying on procurement or availability-to-promise outputs."
  ].join("\n\n");
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function supplierMatchScore(question: string, supplierName: string) {
  const q = ` ${normalize(question)} `;
  const tokens = normalize(supplierName)
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !["test", "supplier", "cycles", "cycle"].includes(token));
  return tokens.reduce((score, token) => score + (q.includes(` ${token} `) ? 1 : 0), 0);
}

function mightBeSupplierLookup(question: string) {
  return /supplier|supplies|supply|oda\b|from\s+[a-z0-9]/i.test(question);
}

async function supplierAnswer(sql: Sql, question: string) {
  if (!mightBeSupplierLookup(question)) return undefined;
  const suppliers = await sql.query<SupplierRow>(`
    select id,name,currency,payment_terms_days,lead_time_days,approval_status,active
      from vyndi_suppliers
     order by active desc,name
  `);
  const ranked = suppliers
    .map((supplier) => ({ supplier, score: supplierMatchScore(question, supplier.name) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return undefined;

  const supplier = ranked[0].supplier;
  const [orders, prices] = await Promise.all([
    sql.query<SupplierPoRow>(`
      select id,sku,quantity,unit_price_inr,requirement_month,status,expected_receipt_on,job_card_id
        from vyndi_purchase_orders
       where supplier_id=$1
       order by created_at desc
       limit 20
    `, [supplier.id]),
    sql.query<SupplierPriceRow>(`
      select sku,price_type,unit_price_inr,currency,status
        from vyndi_procurement_prices
       where supplier_id=$1
       order by sku,effective_from desc
       limit 30
    `, [supplier.id]),
  ]);

  const supplierState = `${supplier.approval_status}${supplier.active ? ", active" : ", inactive"}`;
  const lines = [
    `Supplier: ${supplier.name} — ${supplierState}; ${supplier.lead_time_days}-day lead time; ${supplier.payment_terms_days}-day payment terms; currency ${supplier.currency}.`,
  ];

  if (orders.length) {
    lines.push(`Recorded purchase orders: ${orders.map((order) => `${order.sku} qty ${n(order.quantity).toFixed(1)} @ ₹${n(order.unit_price_inr).toFixed(0)}/unit — ${order.status}${order.job_card_id ? `, linked to job card ${order.job_card_id}` : ""}`).join("; ")}.`);
  } else {
    lines.push("Recorded purchase orders: none.");
  }

  if (prices.length) {
    lines.push(`Supplier price authority rows: ${prices.map((price) => `${price.sku} ₹${n(price.unit_price_inr).toFixed(0)}/${price.price_type} (${price.status})`).join("; ")}.`);
  } else {
    lines.push("Supplier price authority rows: none. Any received PO price remains transaction evidence but is not automatically a reusable supplier-price master.");
  }

  return lines.join("\n\n");
}

export async function tryOperationalDataAnswer(sql: Sql, question: string) {
  if (isBusinessHealthQuestion(question)) return businessHealthAnswer(sql);
  if (isCommittedDemandFeasibilityQuestion(question)) return committedDemandFeasibilityAnswer(sql);
  if (isOperationalReconciliationQuestion(question)) return reconciliationAnswer(sql);
  return supplierAnswer(sql, question);
}
