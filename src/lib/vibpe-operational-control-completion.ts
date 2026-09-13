import type { Sql } from "@/lib/db";

const n = (value: unknown) => Number(value ?? 0);
const t = (value: unknown) => String(value ?? "").trim();
const qn = (question: string) => question.toLowerCase().replace(/\s+/g, " ").trim();
const join = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join("\n\n");

async function confirmedOrderProductionBlockers(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select o.id as sales_order_id,o.revision,o.variant_name,o.units,
           c.id as job_card_id,c.status as job_status,
           coalesce(req.shortage_qty,0)::numeric as shortage_qty,
           coalesce(b.compliance,'NO_JOB_CARD') as bom_compliance,
           coalesce(g.gate_status,'NO_JOB_CARD') as gate_status
      from vyndi_sales_orders o
      left join lateral (
        select jc.id,jc.status from epr_production_job_cards jc
         where jc.sales_order_id=o.id and jc.sales_order_revision=o.revision and jc.status<>'cancelled'
         order by jc.updated_at desc,jc.created_at desc,jc.id desc limit 1
      ) c on true
      left join lateral (
        select sum(r.shortage_quantity)::numeric as shortage_qty
          from vyndi_live_job_card_requirements r
         where r.job_card_id=c.id and r.sku is not null and coalesce(r.issue_status,'')<>'issued'
      ) req on true
      left join vyndi_report_bom_compliance b on b.job_card_id=c.id
      left join vyndi_report_production_release_gate g on g.job_card_id=c.id
     where o.status='confirmed'
     order by o.plan_month,o.id
  `);
  if (!rows.length) return "Confirmed-order producibility: no confirmed customer orders are currently open.";
  const blocked = rows.filter((row) => !t(row.job_card_id) || n(row.shortage_qty)>0 || t(row.bom_compliance)!=='OK' || ['HOLD','AWAITING_RELEASE','NO_JOB_CARD'].includes(t(row.gate_status)));
  if (!blocked.length) return `Confirmed-order producibility: PASS — all ${rows.length} confirmed order thread(s) have an active job card, valid released BOM/mapping state, no current material shortage and no production-release hold evidenced.`;
  return join(
    `Confirmed-order producibility: BLOCKED — ${blocked.length} of ${rows.length} confirmed order thread(s) have a current production blocker.`,
    blocked.map((row) => {
      const reasons: string[]=[];
      if (!t(row.job_card_id)) reasons.push('job card missing');
      if (t(row.bom_compliance)!=='OK') reasons.push(`BOM ${t(row.bom_compliance)}`);
      if (n(row.shortage_qty)>0) reasons.push(`${n(row.shortage_qty).toFixed(1)} material units short`);
      if (['HOLD','AWAITING_RELEASE'].includes(t(row.gate_status))) reasons.push(`production gate ${t(row.gate_status)}`);
      return `${t(row.sales_order_id)} R${n(row.revision).toFixed(0)} · ${t(row.variant_name) || 'variant n/a'} · ${t(row.job_card_id) || 'NO JOB CARD'} — ${reasons.join('; ')}`;
    }).join("\n"),
    "Capacity is reported separately; this answer does not convert a planning-capacity summary into order-level production authority.",
  );
}

async function materialClearOtherBlocker(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select o.id as sales_order_id,c.id as job_card_id,c.status as job_status,
           coalesce(req.shortage_qty,0)::numeric as shortage_qty,
           coalesce(b.compliance,'NO_JOB_CARD') as bom_compliance,
           coalesce(g.gate_status,'NO_JOB_CARD') as gate_status,
           coalesce(ex.cnt,0)::int as assurance_exceptions
      from vyndi_sales_orders o
      join epr_production_job_cards c on c.sales_order_id=o.id and c.sales_order_revision=o.revision and c.status<>'cancelled'
      left join lateral (
        select sum(r.shortage_quantity)::numeric as shortage_qty from vyndi_live_job_card_requirements r
         where r.job_card_id=c.id and r.sku is not null and coalesce(r.issue_status,'')<>'issued'
      ) req on true
      left join vyndi_report_bom_compliance b on b.job_card_id=c.id
      left join vyndi_report_production_release_gate g on g.job_card_id=c.id
      left join lateral (
        select count(*)::int cnt from vyndi_vibpe_assurance_exceptions_all e
         where e.entity_id in (c.id,o.id)
      ) ex on true
     where o.status='confirmed' and coalesce(req.shortage_qty,0)=0
     order by o.plan_month,o.id
  `);
  const blocked = rows.filter((row) => t(row.bom_compliance)!=='OK' || ['HOLD','AWAITING_RELEASE'].includes(t(row.gate_status)) || n(row.assurance_exceptions)>0);
  if (!blocked.length) return `Material-clear non-material blocker check: PASS — ${rows.length} confirmed order thread(s) with zero current material shortage have no BOM/release/assurance blocker evidenced by the queried controls.`;
  return join(
    `Material-clear non-material blocker check: FAIL — ${blocked.length} confirmed order thread(s) have material available but another governed workflow/gate issue remains.`,
    blocked.map((row) => `${t(row.sales_order_id)} · ${t(row.job_card_id)} — BOM ${t(row.bom_compliance)}, gate ${t(row.gate_status)}, assurance exceptions ${n(row.assurance_exceptions).toFixed(0)}`).join("; "),
  );
}

async function confirmedConfigurationCompleteness(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select o.id as sales_order_id,o.revision,o.variant_id,o.model_tier,o.configuration,
           c.id as job_card_id,c.bom_revision,c.released_mapping_set
      from vyndi_sales_orders o
      left join epr_production_job_cards c on c.sales_order_id=o.id and c.sales_order_revision=o.revision and c.status<>'cancelled'
     where o.status='confirmed'
     order by o.id
  `);
  const bad=rows.filter((row)=>!t(row.variant_id)||!t(row.model_tier)||row.configuration==null||!t(row.job_card_id)||!t(row.bom_revision)||!Array.isArray(row.released_mapping_set) && !t(row.released_mapping_set));
  if (!bad.length) return `Confirmed-order configuration completeness: PASS — ${rows.length} confirmed order(s) carry variant/model/configuration and their active job cards carry BOM revision plus released mapping snapshot.`;
  return join(
    `Confirmed-order configuration completeness: FAIL — ${bad.length} of ${rows.length} confirmed order(s) have missing product/BOM/configuration authority.`,
    bad.map((row)=>`${t(row.sales_order_id)} R${n(row.revision).toFixed(0)}: variant ${t(row.variant_id)||'MISSING'}, model ${t(row.model_tier)||'MISSING'}, job ${t(row.job_card_id)||'MISSING'}, BOM ${t(row.bom_revision)||'MISSING'}, mapping snapshot ${t(row.released_mapping_set)||'MISSING'}`).join("; "),
  );
}

async function jobCardSkuRequirements(sql: Sql) {
  const rows=await sql.query<Record<string,unknown>>(`
    select c.id as job_card_id,c.sales_order_id,r.sku,sum(r.required_quantity)::numeric as required_qty,
           sum(r.reserved_quantity)::numeric as reserved_qty,sum(r.shortage_quantity)::numeric as shortage_qty
      from epr_production_job_cards c
      join vyndi_sales_orders o on o.id=c.sales_order_id and o.revision=c.sales_order_revision
      join vyndi_live_job_card_requirements r on r.job_card_id=c.id
     where o.status='confirmed' and c.status<>'cancelled' and r.sku is not null
     group by c.id,c.sales_order_id,r.sku
     order by c.id,r.sku
  `);
  if(!rows.length) return "Active-job-card SKU requirements: no material SKU rows are recorded for current confirmed-order job cards.";
  const grouped=new Map<string,string[]>();
  for(const row of rows){const key=`${t(row.job_card_id)} · order ${t(row.sales_order_id)}`; const arr=grouped.get(key)??[]; arr.push(`${t(row.sku)} ${n(row.required_qty).toFixed(1)} req / ${n(row.reserved_qty).toFixed(1)} res / ${n(row.shortage_qty).toFixed(1)} short`); grouped.set(key,arr);}
  return join("Active-job-card exact material requirements:",[...grouped].map(([key,items])=>`${key}: ${items.join('; ')}`).join("\n"),"Evidence: vyndi_live_job_card_requirements. Operation-only rows without SKU are intentionally excluded from procurement material demand.");
}

async function bomExplosionReconciliation(sql: Sql) {
  const rows=await sql.query<Record<string,unknown>>(`
    with current_jobs as (
      select c.* from epr_production_job_cards c
      join vyndi_sales_orders o on o.id=c.sales_order_id and o.revision=c.sales_order_revision
      where o.status='confirmed' and c.status<>'cancelled'
    ), released as (
      select c.id as job_card_id,c.sales_order_id,c.units,
             released.mapping_id,m.sku,m.quantity as qty_per_unit,vyndi_canonical_unit(m.unit) as mapping_unit
        from current_jobs c
        cross join lateral jsonb_array_elements_text(coalesce(c.released_mapping_set,'[]'::jsonb)) released(mapping_id)
        left join epr_bom_inventory_mappings m on m.id=released.mapping_id
    ), exploded as (
      select c.id as job_card_id,l.id as line_id,l.bom_mapping_id,l.sku,l.quantity,vyndi_canonical_unit(l.unit) as line_unit,l.line_type
        from current_jobs c join epr_production_job_card_lines l on l.job_card_id=c.id
       where l.line_type<>'operation'
    )
    select coalesce(r.job_card_id,e.job_card_id) as job_card_id,
           r.sales_order_id,r.mapping_id,r.sku as expected_sku,e.sku as actual_sku,
           coalesce(r.qty_per_unit*r.units,0)::numeric as expected_qty,coalesce(e.quantity,0)::numeric as actual_qty,
           r.mapping_unit,e.line_unit,e.line_id,e.bom_mapping_id,
           case when r.mapping_id is null then 'EXTRA_JOB_LINE'
                when e.line_id is null then 'MISSING_JOB_LINE'
                when r.sku is distinct from e.sku then 'SKU_MISMATCH'
                when r.mapping_unit is distinct from e.line_unit then 'UNIT_MISMATCH'
                when abs((r.qty_per_unit*r.units)-e.quantity)>0.0001 then 'QUANTITY_MISMATCH'
                else 'OK' end as reconciliation
      from released r full join exploded e on e.job_card_id=r.job_card_id and e.bom_mapping_id=r.mapping_id
     order by job_card_id,coalesce(r.mapping_id,e.bom_mapping_id,e.line_id)
  `);
  const bad=rows.filter((row)=>t(row.reconciliation)!=='OK');
  if(!bad.length) return `BOM-to-job-card explosion reconciliation: PASS — ${rows.length} released BOM mapping line(s) exactly reconcile to the current confirmed-order job-card material ledger by mapping ID, SKU, canonical unit and quantity × job-card units.`;
  return join(
    `BOM-to-job-card explosion reconciliation: FAIL — ${bad.length} exception row(s) across the current confirmed-order build set.`,
    bad.slice(0,30).map((row)=>`${t(row.job_card_id)} · ${t(row.mapping_id)||t(row.bom_mapping_id)||t(row.line_id)} · ${t(row.reconciliation)} · expected ${t(row.expected_sku)||'none'} ${n(row.expected_qty).toFixed(1)} ${t(row.mapping_unit)||''}, actual ${t(row.actual_sku)||'none'} ${n(row.actual_qty).toFixed(1)} ${t(row.line_unit)||''}`).join("; "),
    "Evidence: each job card's immutable released_mapping_set, epr_bom_inventory_mappings and epr_production_job_card_lines. This is the required equality test; procurement-ledger agreement is not a substitute.",
  );
}

async function operationRowsProcurable(sql: Sql) {
  const rows=await sql.query<Record<string,unknown>>(`
    select c.id as job_card_id,l.id as line_id,l.stage_code,l.item,l.sku,l.quantity,l.unit
      from epr_production_job_card_lines l
      join epr_production_job_cards c on c.id=l.job_card_id
      join vyndi_sales_orders o on o.id=c.sales_order_id and o.revision=c.sales_order_revision
     where o.status='confirmed' and c.status<>'cancelled' and l.line_type='operation'
       and (l.sku is not null or l.bom_mapping_id is not null)
     order by c.id,l.id
  `);
  if(!rows.length) return "Operation/procurable-material separation: PASS — no active confirmed-order operation row carries a SKU or BOM mapping and therefore none is presented as procurable material by this control.";
  return join(`Operation/procurable-material separation: FAIL — ${rows.length} operation row(s) are incorrectly material-addressable.`,rows.map((row)=>`${t(row.job_card_id)} · ${t(row.line_id)} · ${t(row.stage_code)} ${t(row.item)} · SKU ${t(row.sku)||'none'} · mapping ${t(row.bom_mapping_id)||'none'}`).join("; "));
}

async function issuedStillProcured(sql: Sql) {
  const rows=await sql.query<Record<string,unknown>>(`
    with state as (
      select c.id as job_card_id,l.sku,
             count(*) filter (where l.issue_status='issued')::int as issued_lines,
             count(*) filter (where l.issue_status<>'issued')::int as open_lines
        from epr_production_job_cards c join epr_production_job_card_lines l on l.job_card_id=c.id
        join vyndi_sales_orders o on o.id=c.sales_order_id and o.revision=c.sales_order_revision
       where o.status='confirmed' and c.status<>'cancelled' and l.sku is not null
       group by c.id,l.sku
    ), po as (
      select job_card_id,sku,sum(quantity_open)::numeric as open_po_qty
        from vyndi_purchase_order_status
       where status in ('draft','pending_approval','approved','issued','part_received') and job_card_id is not null
       group by job_card_id,sku
    )
    select s.*,coalesce(p.open_po_qty,0) as open_po_qty
      from state s left join po p on p.job_card_id=s.job_card_id and p.sku=s.sku
     where s.issued_lines>0 and s.open_lines=0 and coalesce(p.open_po_qty,0)>0
     order by s.job_card_id,s.sku
  `);
  if(!rows.length) return "Issued-material/open-procurement control: PASS — no fully issued job-card/SKU remains covered by an active open PO quantity.";
  return join(`Issued-material/open-procurement control: FAIL/REVIEW — ${rows.length} fully issued job-card/SKU position(s) still have open PO quantity.`,rows.map((row)=>`${t(row.job_card_id)} · ${t(row.sku)} · issued lines ${n(row.issued_lines).toFixed(0)} · open PO ${n(row.open_po_qty).toFixed(1)}`).join("; "),"Controlled next action: confirm whether the remaining PO quantity serves another governed requirement; otherwise reduce/cancel the obsolete coverage.");
}

async function atpFormulaConsistency(sql: Sql) {
  const rows=await sql.query<Record<string,unknown>>(`
    select r.sku,r.physical_qty,r.committed_reserved_qty,r.atp_qty,
           coalesce(a.available_to_promise,0) as canonical_atp
      from vyndi_report_procurement_net_requirement r
      left join master_inventory_items i on i.sku=r.sku
      left join vyndi_inventory_available_to_promise a on a.sku=r.sku and a.unit=vyndi_canonical_unit(i.unit)
     where abs(r.atp_qty-coalesce(a.available_to_promise,0))>0.0001
     order by r.sku
  `);
  const over=await sql.query<Record<string,unknown>>(`select reservation_id,sku,quantity_reserved,physical_quantity from vyndi_report_reservation_health where health='OVER_RESERVED' order by sku,reservation_id`);
  if(!rows.length && !over.length) return "ATP consistency control: PASS — procurement ATP equals canonical inventory ATP for every reported SKU and no over-reservation exception is active; no shortage is hidden by an inconsistent ATP value in these governed views.";
  return join(
    `ATP consistency control: ${rows.length?'FAIL':'REVIEW'} — ${rows.length} cross-view ATP mismatch(es); ${over.length} over-reservation exception(s).`,
    rows.length?`ATP mismatches: ${rows.map((row)=>`${t(row.sku)} report ${n(row.atp_qty).toFixed(1)} vs canonical ${n(row.canonical_atp).toFixed(1)}`).join('; ')}.`:null,
    over.length?`Over-reservations: ${over.map((row)=>`${t(row.sku)} ${t(row.reservation_id)} reserved ${n(row.quantity_reserved).toFixed(1)} vs physical ${n(row.physical_quantity).toFixed(1)}`).join('; ')}.`:null,
  );
}

async function inventoryTransactionDetail(sql: Sql) {
  const rows=await sql.query<Record<string,unknown>>(`
    with skus as (select distinct sku from vyndi_committed_procurement_requirements)
    select l.sku,l.id as ledger_id,l.movement_id,l.quantity_delta,l.unit_cost_inr,l.posted_at,
           m.movement_type,m.reference_type,m.reference_id
      from epr_inventory_ledger l
      join skus s on s.sku=l.sku
      left join epr_inventory_movements m on m.id=l.movement_id
     order by l.sku,l.posted_at,l.id
  `);
  if(!rows.length) return "Committed-SKU inventory transaction lineage: no inventory ledger transactions are recorded for current committed SKUs.";
  const grouped=new Map<string,string[]>();
  for(const row of rows){const arr=grouped.get(t(row.sku))??[]; arr.push(`${t(row.ledger_id)} / ${t(row.movement_type)||'type n/a'} ${n(row.quantity_delta)>=0?'+':''}${n(row.quantity_delta).toFixed(1)} · ${t(row.reference_type)||'ref'} ${t(row.reference_id)||t(row.movement_id)}`); grouped.set(t(row.sku),arr);}
  return join("Committed-SKU inventory transaction lineage:",[...grouped].map(([sku,items])=>`${sku}: ${items.join('; ')}`).join("\n"),"Evidence: immutable epr_inventory_ledger with movement/reference linkage. Use the arithmetic reconciliation control to verify these deltas tie to current physical stock.");
}

async function procurementLineage(sql: Sql) {
  const rows=await sql.query<Record<string,unknown>>(`
    select o.id as sales_order_id,c.id as job_card_id,r.sku,r.required_quantity,r.shortage_quantity,
           coalesce(po.po_ids,'') as po_ids,coalesce(po.po_states,'') as po_states
      from vyndi_sales_orders o
      join epr_production_job_cards c on c.sales_order_id=o.id and c.sales_order_revision=o.revision and c.status<>'cancelled'
      join vyndi_live_job_card_requirements r on r.job_card_id=c.id
      left join lateral (
        select string_agg(p.id,', ' order by p.id) as po_ids,string_agg(p.status,', ' order by p.id) as po_states
          from vyndi_purchase_orders p where p.job_card_id=c.id and p.sku=r.sku and p.status<>'cancelled'
      ) po on true
     where o.status='confirmed' and r.sku is not null and coalesce(r.issue_status,'')<>'issued'
     order by o.id,c.id,r.sku
  `);
  const gaps=rows.filter((row)=>n(row.shortage_quantity)>0&&!t(row.po_ids));
  return join(
    `Procurement backward/forward lineage: ${gaps.length?'FAIL':'PASS'} — ${rows.length} active confirmed-order job-card/SKU requirement row(s) checked; ${gaps.length} uncovered shortage row(s) have no PO/sourcing record.`,
    rows.map((row)=>`${t(row.sales_order_id)} → ${t(row.job_card_id)} → ${t(row.sku)} req ${n(row.required_quantity).toFixed(1)} short ${n(row.shortage_quantity).toFixed(1)} → ${t(row.po_ids)||'NO PO'}${t(row.po_states)?` [${t(row.po_states)}]`:''}`).join("; "),
    "Evidence: exact sales-order revision → job card → live material requirement → PO linkage. Planning recommendations without a PO remain advisory and are not shown as supplier commitments.",
  );
}

async function shortagesInsideLeadTime(sql: Sql) {
  const rows=await sql.query<Record<string,unknown>>(`
    select p.requirement_month,p.sku,p.net_committed_shortage,s.lead_time_months,s.planning_status,s.source_ref
      from vyndi_committed_procurement_requirements p
      left join vyndi_supply_planning_parameters s on s.sku=p.sku and s.planning_status<>'retired'
     where p.net_committed_shortage>0 and coalesce(s.lead_time_months,0)>=p.requirement_month
     order by p.requirement_month,p.sku
  `);
  if(!rows.length) return "Committed shortages inside lead time: PASS — no current committed shortage falls inside its governed supply-planning lead-time horizon.";
  return join(`Committed shortages inside lead time: BLOCKED/EXPEDITE — ${rows.length} SKU-month shortage row(s).`,rows.map((row)=>`${t(row.sku)} M${n(row.requirement_month).toFixed(0)}: ${n(row.net_committed_shortage).toFixed(1)} short, lead time ${n(row.lead_time_months).toFixed(1)} month(s), authority ${t(row.planning_status)} · ${t(row.source_ref)}`).join("; "),"Planning-default lead time is not supplier-contract truth; expedite/alternate-source decisions require approved supplier-lane evidence where available.");
}

async function receiptAfterDuePeriod(sql: Sql) {
  const rows=await sql.query<Record<string,unknown>>(`
    select p.id,p.job_card_id,p.sku,p.expected_receipt_on,c.due_month,c.sales_order_id
      from vyndi_purchase_orders p
      join epr_production_job_cards c on c.id=p.job_card_id
     where p.status in ('draft','pending_approval','approved','issued','part_received') and p.expected_receipt_on is not null
     order by c.due_month,p.expected_receipt_on,p.id
  `);
  if(!rows.length) return "Receipt-vs-job-card due-period check: no open PO with an expected receipt date is available for comparison.";
  return join(
    "Receipt-vs-job-card due-period check: NOT VERIFIED at calendar-date precision.",
    `The PO authority stores calendar expected_receipt_on while the job card stores planning due_month (M1…M36). No governed M-number → calendar-date conversion authority is used by this check, so VIBPE will not fabricate an on-time/late conclusion. ${rows.length} open dated PO row(s) require a governed planning-calendar mapping.`,
    rows.map((row)=>`${t(row.id)} · order ${t(row.sales_order_id)} · job ${t(row.job_card_id)} · ${t(row.sku)} · expected ${t(row.expected_receipt_on)} · due M${n(row.due_month).toFixed(0)}`).join("; "),
  );
}

async function poLifecycleControl(sql: Sql) {
  const rows=await sql.query<Record<string,unknown>>(`
    select p.id,p.status,p.approved_at,p.issued_at,
           coalesce(g.grn_count,0)::int as grn_count,
           coalesce(i.invoice_count,0)::int as invoice_count,
           coalesce(pay.payment_count,0)::int as payment_count
      from vyndi_purchase_orders p
      left join lateral (select count(*)::int grn_count from vyndi_goods_receipts g where g.purchase_order_id=p.id) g on true
      left join lateral (select count(*)::int invoice_count from vyndi_supplier_invoices si where si.purchase_order_id=p.id and si.status<>'void') i on true
      left join lateral (
        select count(*)::int payment_count from vyndi_supplier_payments sp
        join vyndi_supplier_invoices si on si.id=sp.supplier_invoice_id
        where si.purchase_order_id=p.id and si.status<>'void'
      ) pay on true
     where p.status<>'cancelled'
     order by p.created_at,p.id
  `);
  const bad=rows.filter((row)=>
    (['approved','issued','part_received','received'].includes(t(row.status))&&!row.approved_at)
    ||(['issued','part_received','received'].includes(t(row.status))&&!row.issued_at)
    ||(['part_received','received'].includes(t(row.status))&&n(row.grn_count)===0)
  );
  return join(
    `PO lifecycle control: ${bad.length?'FAIL':'PASS'} — ${rows.length} non-cancelled PO(s) checked for current-state evidence consistency; ${bad.length} inconsistent row(s).`,
    bad.length?bad.map((row)=>`${t(row.id)} [${t(row.status)}]: approved_at ${t(row.approved_at)||'MISSING'}, issued_at ${t(row.issued_at)||'MISSING'}, GRNs ${n(row.grn_count).toFixed(0)}, invoices ${n(row.invoice_count).toFixed(0)}, payments ${n(row.payment_count).toFixed(0)}`).join("; "):"Current status/evidence prerequisites are consistent.",
    "Important scope: current row state plus GRN/AP linkage proves present lifecycle consistency, not every historical transition event. The controlled transition function enforces allowed PO state changes; received POs may legitimately await invoice/payment if not yet due.",
  );
}

async function confirmedCapacity(sql: Sql) {
  const demand=await sql.query<Record<string,unknown>>(`select plan_month,sum(units)::numeric as units from vyndi_sales_orders where status='confirmed' group by plan_month order by plan_month`);
  const standards=await sql.query<Record<string,unknown>>(`select work_centre_id,work_centre_name,available_hours_per_month,efficiency,standard_hours_per_unit,planning_status from vyndi_capacity_standards where planning_status<>'retired' order by sequence,work_centre_id`);
  const unapproved=standards.filter((row)=>t(row.planning_status)!=='approved');
  const exceptions:string[]=[];
  for(const d of demand){for(const s of standards){const std=n(s.standard_hours_per_unit); const cap=std>0?n(s.available_hours_per_month)*n(s.efficiency)/std:0; if(n(d.units)>cap+0.0001) exceptions.push(`M${n(d.plan_month).toFixed(0)} ${t(s.work_centre_id)}: committed ${n(d.units).toFixed(1)} > capacity ${cap.toFixed(1)}`);}}
  return join(
    `Confirmed-order capacity: ${exceptions.length?'INSUFFICIENT ON CURRENT STANDARDS':unapproved.length?'MODELED SUFFICIENT, AUTHORITY PROVISIONAL':'PASS — SUFFICIENT ON APPROVED STANDARDS'}.`,
    `Confirmed demand: ${demand.map((row)=>`M${n(row.plan_month).toFixed(0)} ${n(row.units).toFixed(1)} unit(s)`).join('; ')||'none'}. Capacity standards checked: ${standards.length}; unapproved: ${unapproved.length}.`,
    exceptions.length?`Capacity exceptions: ${exceptions.join('; ')}.`:null,
    unapproved.length?`Authority limitation: ${unapproved.map((row)=>`${t(row.work_centre_id)} ${t(row.planning_status)}`).join('; ')}. A zero calculated shortfall must not be presented as firm capacity authority until standards are approved.`:null,
  );
}

async function approvedPlanCapacity(sql: Sql) {
  const [run]=await sql.query<Record<string,unknown>>(`select result_json from vyndi_ibpe_runs where status='complete' order by created_at desc limit 1`);
  const [authority]=await sql.query<Record<string,unknown>>(`select count(*)::int total,count(*) filter(where planning_status='approved')::int approved from vyndi_capacity_standards where planning_status<>'retired'`);
  const summary=(run?.result_json as Record<string,unknown>|undefined)?.summary as Record<string,unknown>|undefined;
  const shortfall=n(summary?.capacityShortfallMonths);
  return join(
    `Approved-plan capacity: ${shortfall>0?'INSUFFICIENT':n(authority?.approved)<n(authority?.total)?'MODELED SUFFICIENT, AUTHORITY PROVISIONAL':'PASS — no modeled shortfall on approved standards'}.`,
    `Latest governed IBPE summary reports ${shortfall.toFixed(0)} capacity-shortfall month(s). Capacity-standard authority is ${n(authority?.approved).toFixed(0)}/${n(authority?.total).toFixed(0)} approved.`,
    n(authority?.approved)<n(authority?.total)?"Decision limitation: planning feasibility remains provisional where capacity standards are not approved; zero modeled shortfall is not the same as firm manufacturing/CTP authority.":null,
  );
}

async function provisionalPlanningConclusions(sql: Sql) {
  const [cap]=await sql.query<Record<string,unknown>>(`select count(*)::int total,count(*) filter(where planning_status='approved')::int approved from vyndi_capacity_standards where planning_status<>'retired'`);
  const [routing]=await sql.query<Record<string,unknown>>(`select count(*) filter(where status='approved' and effective_from<=current_date and (effective_to is null or effective_to>=current_date))::int approved from vyndi_routing_revisions`);
  const [lanes]=await sql.query<Record<string,unknown>>(`select count(*) filter(where status='approved' and effective_from<=current_date and (effective_to is null or effective_to>=current_date))::int approved from vyndi_supplier_lane_revisions`);
  const dependent:string[]=[];
  if(n(cap?.approved)<n(cap?.total)) dependent.push('work-centre capacity sufficiency, overload headroom and any downstream feasibility conclusion that consumes those standards');
  if(n(routing?.approved)===0) dependent.push('operation sequence/load derivation and routing-dependent advanced feasibility remain provisional/capacity-standard-derived');
  if(n(lanes?.approved)===0) dependent.push('supplier-specific lead-time, finite-capacity, reliability and alternate-source conclusions are not firm lane authority');
  dependent.push('firm capable-to-promise and mathematical optimisation remain non-releaseable until their authority gates are eligible');
  return join("Planning conclusions dependent on provisional authority:",dependent.map((item,index)=>`${index+1}. ${item}`).join("\n"),`Authority snapshot: capacity standards ${n(cap?.approved).toFixed(0)}/${n(cap?.total).toFixed(0)} approved; effective approved routing revisions ${n(routing?.approved).toFixed(0)}; effective approved supplier lanes ${n(lanes?.approved).toFixed(0)}.`);
}

export async function tryVibpeOperationalControlCompletion(sql: Sql, question: string): Promise<string|undefined>{
  const q=qn(question);
  if(/confirmed orders?/.test(q)&&/(cannot currently be produced|cannot.*produced|not.*produc)/.test(q)) return confirmedOrderProductionBlockers(sql);
  if(/confirmed orders?/.test(q)&&/all materials available|materials? available/.test(q)&&/(workflow|gate|blocked)/.test(q)) return materialClearOtherBlocker(sql);
  if(/confirmed orders?/.test(q)&&/(missing product variant|bom revision|configuration information)/.test(q)) return confirmedConfigurationCompleteness(sql);
  if(/exact material skus?/.test(q)&&/active job[- ]?card/.test(q)) return jobCardSkuRequirements(sql);
  if(/bom/.test(q)&&/job[- ]?card/.test(q)&&/(exactly match|explosion|complete and internally consistent|never reached|components? required)/.test(q)) return bomExplosionReconciliation(sql);
  if(/routing or operation rows?/.test(q)&&/(procurable material|treated as procurable)/.test(q)) return operationRowsProcurable(sql);
  if(/materials? already issued/.test(q)&&/open procurement demand/.test(q)) return issuedStillProcured(sql);
  if(/shortages? hidden/.test(q)&&/(incorrect atp|atp.*calculated)/.test(q)) return atpFormulaConsistency(sql);
  if(/inventory transactions?/.test(q)&&/(created the present stock balance|present stock balance)/.test(q)) return inventoryTransactionDetail(sql);
  if(/procurement requirements?/.test(q)&&/(traced backward|trace.*customer order)/.test(q)&&/(forward|po|sourcing action)/.test(q)) return procurementLineage(sql);
  if(/shortages?/.test(q)&&/inside supplier lead time/.test(q)) return shortagesInsideLeadTime(sql);
  if(/expected receipts?/.test(q)&&/(after the related job[- ]?card due|job[- ]?card due period)/.test(q)) return receiptAfterDuePeriod(sql);
  if(/every po|every purchase order/.test(q)&&/lifecycle/.test(q)) return poLifecycleControl(sql);
  if(/production capacity/.test(q)&&/(four confirmed orders|confirmed orders)/.test(q)&&/sufficient/.test(q)) return confirmedCapacity(sql);
  if(/production capacity/.test(q)&&/(entire approved plan|approved plan)/.test(q)&&/sufficient/.test(q)) return approvedPlanCapacity(sql);
  if(/planning conclusions?/.test(q)&&/(provisional routing|unapproved capacity standards)/.test(q)) return provisionalPlanningConclusions(sql);
  return undefined;
}
