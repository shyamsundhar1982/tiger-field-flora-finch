import type { Sql } from "@/lib/db";

const n = (value: unknown) => Number(value ?? 0);
const text = (value: unknown) => String(value ?? "").trim();

function qn(question: string) {
  return question.toLowerCase().replace(/\s+/g, " ").trim();
}

function lines(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join("\n\n");
}

async function orderRevisionControl(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select sales_order_id,order_revision,job_card_id,job_order_revision,sync_status
      from vyndi_report_order_book_sync
     where order_status='confirmed'
     order by sales_order_id,job_card_id
  `);
  const bad = rows.filter((row) => text(row.job_card_id) && n(row.job_order_revision) !== n(row.order_revision));
  return bad.length
    ? lines(
        `Sales-order/job-card revision control: FAIL — ${bad.length} job card${bad.length === 1 ? "" : "s"} do not point to the current confirmed sales-order revision.`,
        bad.map((row) => `${text(row.sales_order_id)} R${n(row.order_revision)} → ${text(row.job_card_id)} references R${n(row.job_order_revision)}`).join("; "),
        "Evidence: vyndi_report_order_book_sync. Controlled next action: supersede or relink stale job cards before production execution.",
      )
    : `Sales-order/job-card revision control: PASS — every current confirmed-order job card points to the current sales-order revision. Evidence: vyndi_report_order_book_sync (${rows.length} checked row${rows.length === 1 ? "" : "s"}).`;
}

async function invalidOrderStateJobCards(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select sales_order_id,order_revision,order_status,job_card_id,job_status,sync_status
      from vyndi_report_order_book_sync
     where job_card_id is not null
       and (order_status not in ('confirmed','delivered') or sync_status='CANCELLED_ORDER_ACTIVE_JOB')
     order by sales_order_id,job_card_id
  `);
  if (!rows.length) return "Job-card originating-order state control: PASS — no job card is linked to a cancelled, superseded or otherwise non-confirmed/non-delivered sales order.";
  return lines(
    `Job-card originating-order state control: FAIL — ${rows.length} exception${rows.length === 1 ? "" : "s"}.`,
    rows.map((row) => `${text(row.job_card_id)} → ${text(row.sales_order_id)} R${n(row.order_revision)} [order ${text(row.order_status)}, job ${text(row.job_status)}, ${text(row.sync_status)}]`).join("; "),
    "Evidence: vyndi_report_order_book_sync. Controlled next action: cancel/supersede the invalid production authority or restore the correct confirmed order revision.",
  );
}

async function orderJobQuantityReconciliation(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select o.id as sales_order_id,o.revision,o.units as order_units,
           coalesce(sum(c.units) filter (where c.status<>'cancelled'),0)::numeric as active_job_units,
           count(c.id) filter (where c.status<>'cancelled')::int as active_job_cards
      from vyndi_sales_orders o
      left join epr_production_job_cards c
        on c.sales_order_id=o.id and c.sales_order_revision=o.revision
     where o.status='confirmed'
     group by o.id,o.revision,o.units
     order by o.id
  `);
  const bad = rows.filter((row) => Math.abs(n(row.order_units) - n(row.active_job_units)) > 0.0001);
  if (!bad.length) return `Sales-order/job-card quantity reconciliation: PASS — ${rows.length} confirmed order${rows.length === 1 ? "" : "s"} exactly reconcile to active job-card production quantity.`;
  return lines(
    `Sales-order/job-card quantity reconciliation: FAIL — ${bad.length} confirmed order${bad.length === 1 ? "" : "s"} do not reconcile.`,
    bad.map((row) => `${text(row.sales_order_id)} R${n(row.revision)}: order ${n(row.order_units).toFixed(1)} vs active job-card ${n(row.active_job_units).toFixed(1)} across ${n(row.active_job_cards).toFixed(0)} card(s)`).join("; "),
    "Controlled next action: correct the production quantity/revision linkage before using job-card demand as committed material truth.",
  );
}

async function duplicateActiveJobCards(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select o.id as sales_order_id,o.revision,count(c.id)::int as active_job_cards,
           string_agg(c.id,', ' order by c.id) as job_cards
      from vyndi_sales_orders o
      join epr_production_job_cards c
        on c.sales_order_id=o.id and c.sales_order_revision=o.revision
     where o.status='confirmed' and c.status<>'cancelled'
     group by o.id,o.revision
    having count(c.id)>1
     order by o.id
  `);
  if (!rows.length) return "Duplicate active job-card control: PASS — no current confirmed sales-order revision is represented by more than one active job card.";
  return lines(
    `Duplicate active job-card control: FAIL — ${rows.length} confirmed order${rows.length === 1 ? "" : "s"} have multiple active job cards.`,
    rows.map((row) => `${text(row.sales_order_id)} R${n(row.revision)}: ${text(row.job_cards)}`).join("; "),
    "Controlled next action: retain one governed production authority per confirmed order revision or explicitly split the order with controlled quantity lineage.",
  );
}

async function confirmedOrderWorkflowState(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select o.id as sales_order_id,o.revision,o.variant_name,o.units,
           c.id as job_card_id,c.status as job_card_status,
           coalesce(tr.cnt,0)::int as traveller_count,
           coalesce(qr.cnt,0)::int as quality_release_count,
           coalesce(sh.cnt,0)::int as shipment_count,
           coalesce(inv.cnt,0)::int as invoice_count,
           coalesce(col.cnt,0)::int as collection_count
      from vyndi_sales_orders o
      left join lateral (
        select jc.id,jc.status from epr_production_job_cards jc
         where jc.sales_order_id=o.id and jc.sales_order_revision=o.revision and jc.status<>'cancelled'
         order by jc.updated_at desc,jc.created_at desc,jc.id desc limit 1
      ) c on true
      left join lateral (select count(*)::int cnt from epr_travellers t where t.job_card_id=c.id and t.status<>'rejected') tr on true
      left join lateral (select count(*)::int cnt from vyndi_quality_releases q where q.job_card_id=c.id and q.superseded_at is null) qr on true
      left join lateral (select count(*)::int cnt from vyndi_shipments s where s.sales_order_id=o.id and s.status='posted') sh on true
      left join lateral (select count(*)::int cnt from vyndi_invoices i where i.sales_order_id=o.id and i.status='issued') inv on true
      left join lateral (
        select count(*)::int cnt from vyndi_collections c2
        join vyndi_invoices i2 on i2.id=c2.invoice_id
        where i2.sales_order_id=o.id and c2.status='posted'
      ) col on true
     where o.status='confirmed'
     order by o.plan_month,o.id
  `);
  if (!rows.length) return "Confirmed-order workflow state: no confirmed customer orders are currently open.";
  return lines(
    `Confirmed-order workflow state: ${rows.length} active confirmed order thread${rows.length === 1 ? "" : "s"}.`,
    rows.map((row) => `${text(row.sales_order_id)} R${n(row.revision)} · ${text(row.variant_name) || "variant n/a"} · ${n(row.units).toFixed(0)} unit(s) → Job ${text(row.job_card_id) || "MISSING"} [${text(row.job_card_status) || "n/a"}] → Travellers ${n(row.traveller_count).toFixed(0)} → Quality ${n(row.quality_release_count).toFixed(0)} → Dispatch ${n(row.shipment_count).toFixed(0)} → Invoice ${n(row.invoice_count).toFixed(0)} → Collection ${n(row.collection_count).toFixed(0)}`).join("\n"),
    "Evidence: canonical sales-order, job-card, traveller, quality-release, shipment, invoice and collection ledgers. Counts describe workflow state; they do not create or approve transactions.",
  );
}

async function bomCompliance(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select b.job_card_id,b.sales_order_id,b.sales_order_revision,b.bom_revision,b.released_mapping_count,b.compliance
      from vyndi_report_bom_compliance b
      join vyndi_sales_orders o on o.id=b.sales_order_id and o.revision=b.sales_order_revision
     where o.status='confirmed'
     order by b.job_card_id
  `);
  const bad = rows.filter((row) => text(row.compliance) !== "OK");
  if (!bad.length) return `BOM release/compliance control: PASS — ${rows.length} confirmed-order job card${rows.length === 1 ? "" : "s"} have a released BOM revision and valid approved mapping snapshot.`;
  return lines(
    `BOM release/compliance control: FAIL — ${bad.length} of ${rows.length} confirmed-order job cards have BOM/mapping exceptions.`,
    bad.map((row) => `${text(row.job_card_id)} · order ${text(row.sales_order_id)} R${n(row.sales_order_revision)} · BOM ${text(row.bom_revision) || "MISSING"} · ${text(row.compliance)} · released mappings ${n(row.released_mapping_count).toFixed(0)}`).join("; "),
    "Evidence: vyndi_report_bom_compliance. This verifies controlled BOM/mapping release state; it does not by itself prove every exploded material quantity equals the BOM quantity-per-unit.",
  );
}

async function missingRequirementSku(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select r.job_card_id,r.stage_code,r.stage_name,r.required_quantity
      from vyndi_live_job_card_requirements r
      join epr_production_job_cards c on c.id=r.job_card_id
      join vyndi_sales_orders o on o.id=c.sales_order_id and o.revision=c.sales_order_revision
     where o.status='confirmed' and c.status<>'cancelled' and r.sku is null
     order by r.job_card_id,r.stage_code
  `);
  if (!rows.length) return "Job-card material SKU completeness: PASS — no active confirmed-order material requirement row is missing a SKU.";
  return lines(
    `Job-card material SKU completeness: FAIL — ${rows.length} requirement row${rows.length === 1 ? "" : "s"} are missing a SKU.`,
    rows.map((row) => `${text(row.job_card_id)} · ${text(row.stage_code)} ${text(row.stage_name)} · required ${n(row.required_quantity).toFixed(1)}`).join("; "),
    "Controlled next action: repair the released mapping/material explosion before procurement or issue.",
  );
}

async function nonPositiveRequirement(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select r.job_card_id,r.sku,r.required_quantity
      from vyndi_live_job_card_requirements r
      join epr_production_job_cards c on c.id=r.job_card_id
      join vyndi_sales_orders o on o.id=c.sales_order_id and o.revision=c.sales_order_revision
     where o.status='confirmed' and c.status<>'cancelled' and coalesce(r.required_quantity,0)<=0
     order by r.job_card_id,r.sku
  `);
  if (!rows.length) return "Job-card material quantity validity: PASS — no active confirmed-order material requirement is zero or negative.";
  return lines(
    `Job-card material quantity validity: FAIL — ${rows.length} non-positive requirement row${rows.length === 1 ? "" : "s"}.`,
    rows.map((row) => `${text(row.job_card_id)} · ${text(row.sku) || "SKU MISSING"}: ${n(row.required_quantity).toFixed(4)}`).join("; "),
  );
}

async function invalidMasterInventoryRequirement(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select distinct r.job_card_id,r.sku
      from vyndi_live_job_card_requirements r
      join epr_production_job_cards c on c.id=r.job_card_id
      join vyndi_sales_orders o on o.id=c.sales_order_id and o.revision=c.sales_order_revision
      left join master_inventory_items i on i.sku=r.sku and i.active=true
     where o.status='confirmed' and c.status<>'cancelled' and r.sku is not null and i.id is null
     order by r.job_card_id,r.sku
  `);
  if (!rows.length) return "Material/master-inventory referential control: PASS — every SKU required by an active confirmed-order job card resolves to an active controlled Master Inventory item.";
  return lines(
    `Material/master-inventory referential control: FAIL — ${rows.length} job-card/SKU reference${rows.length === 1 ? "" : "s"} do not resolve to active Master Inventory.`,
    rows.map((row) => `${text(row.job_card_id)} · ${text(row.sku)}`).join("; "),
  );
}

async function committedInventoryPosition(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    with skus as (
      select distinct r.sku
        from vyndi_live_job_card_requirements r
        join epr_production_job_cards c on c.id=r.job_card_id
        join vyndi_sales_orders o on o.id=c.sales_order_id and o.revision=c.sales_order_revision
       where o.status='confirmed' and c.status<>'cancelled' and r.sku is not null and coalesce(r.issue_status,'')<>'issued'
    )
    select r.sku,r.physical_qty,r.committed_reserved_qty,r.atp_qty,r.open_po_qty
      from skus s
      left join vyndi_report_procurement_net_requirement r on r.sku=s.sku
     order by s.sku
  `);
  if (!rows.length) return "Committed-SKU inventory position: no open committed material SKUs are currently recorded.";
  return lines(
    `Committed-SKU inventory position: ${rows.length} open SKU${rows.length === 1 ? "" : "s"}.`,
    rows.map((row) => `${text(row.sku)}: physical ${n(row.physical_qty).toFixed(1)}, reserved ${n(row.committed_reserved_qty).toFixed(1)}, ATP ${n(row.atp_qty).toFixed(1)}, authorised/open PO ${n(row.open_po_qty).toFixed(1)}`).join("; "),
    "Evidence: vyndi_report_procurement_net_requirement over current confirmed-order job-card SKUs.",
  );
}

async function overReservationControl(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select reservation_id,sku,quantity_reserved,physical_quantity,available_to_promise,job_card_id,sales_order_id,health
      from vyndi_report_reservation_health
     where health<>'OK'
     order by sku,reservation_id
  `);
  if (!rows.length) return "Inventory reservation health: PASS — no active reservation exceeds physical stock and no active reservation has an invalid non-positive quantity.";
  return lines(
    `Inventory reservation health: FAIL — ${rows.length} active reservation exception${rows.length === 1 ? "" : "s"}.`,
    rows.map((row) => `${text(row.reservation_id)} · ${text(row.sku)} · reserved ${n(row.quantity_reserved).toFixed(1)} vs physical ${n(row.physical_quantity).toFixed(1)} · ${text(row.health)} · job ${text(row.job_card_id) || "n/a"}`).join("; "),
  );
}

async function negativeAtpControl(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select sku,physical_qty,committed_reserved_qty,atp_qty
      from vyndi_report_procurement_net_requirement
     where atp_qty<0
     order by sku
  `);
  const over = await sql.query<Record<string, unknown>>(`select count(*)::int as cnt from vyndi_report_reservation_health where health='OVER_RESERVED'`);
  if (!rows.length) {
    return `ATP non-negativity control: PASS — no SKU has negative canonical ATP. The canonical ATP view floors free stock at zero; ${n(over[0]?.cnt).toFixed(0)} over-reservation exception(s) are tracked separately by reservation health.`;
  }
  return lines(
    `ATP non-negativity control: FAIL — ${rows.length} SKU${rows.length === 1 ? "" : "s"} show negative ATP.`,
    rows.map((row) => `${text(row.sku)}: physical ${n(row.physical_qty).toFixed(1)}, reserved ${n(row.committed_reserved_qty).toFixed(1)}, ATP ${n(row.atp_qty).toFixed(1)}`).join("; "),
  );
}

async function stockCoveredButUnreserved(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    with job as (
      select r.sku,sum(r.required_quantity)::numeric as required_qty,sum(r.reserved_quantity)::numeric as reserved_qty
        from vyndi_live_job_card_requirements r
        join epr_production_job_cards c on c.id=r.job_card_id
        join vyndi_sales_orders o on o.id=c.sales_order_id and o.revision=c.sales_order_revision
       where o.status='confirmed' and c.status<>'cancelled' and r.sku is not null and coalesce(r.issue_status,'')<>'issued'
       group by r.sku
    )
    select j.sku,j.required_qty,j.reserved_qty,r.physical_qty,r.atp_qty
      from job j join vyndi_report_procurement_net_requirement r on r.sku=j.sku
     where r.physical_qty>=j.required_qty and j.reserved_qty<j.required_qty
     order by j.sku
  `);
  if (!rows.length) return "Stock-available-but-unreserved control: PASS — no open confirmed-order SKU is fully covered by physical stock while remaining under-reserved.";
  return lines(
    `Stock-available-but-unreserved control: FAIL — ${rows.length} SKU${rows.length === 1 ? "" : "s"} have enough physical stock but insufficient reservation.`,
    rows.map((row) => `${text(row.sku)}: required ${n(row.required_qty).toFixed(1)}, reserved ${n(row.reserved_qty).toFixed(1)}, physical ${n(row.physical_qty).toFixed(1)}, ATP ${n(row.atp_qty).toFixed(1)}`).join("; "),
    "Controlled next action: create/repair the governed reservation against the exact job-card demand before promising material availability.",
  );
}

async function obsoleteReservationControl(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select r.id as reservation_id,r.sku,r.quantity_reserved,r.sales_order_id,r.job_card_id,
           coalesce(o.status,oj.status,'MISSING') as demand_status
      from epr_inventory_reservations r
      left join vyndi_sales_orders o on o.id=r.sales_order_id
      left join epr_production_job_cards c on c.id=r.job_card_id
      left join vyndi_sales_orders oj on oj.id=c.sales_order_id and oj.revision=c.sales_order_revision
     where r.status='active'
       and coalesce(o.status,oj.status,'MISSING') not in ('confirmed','delivered')
     order by r.sku,r.id
  `);
  if (!rows.length) return "Reservation-demand validity: PASS — no active inventory reservation is attached to cancelled, obsolete or missing demand.";
  return lines(
    `Reservation-demand validity: FAIL — ${rows.length} active reservation${rows.length === 1 ? "" : "s"} point to non-current demand.`,
    rows.map((row) => `${text(row.reservation_id)} · ${text(row.sku)} · qty ${n(row.quantity_reserved).toFixed(1)} · order ${text(row.sales_order_id) || "via job card"} · demand ${text(row.demand_status)}`).join("; "),
  );
}

async function reservationReconciliation(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    with jc as (
      select sku,sum(reserved_quantity)::numeric as job_reserved
        from vyndi_live_job_card_requirements
       where sku is not null and coalesce(issue_status,'')<>'issued'
       group by sku
    ), cp as (
      select sku,sum(reserved_quantity)::numeric as committed_reserved
        from vyndi_committed_procurement_requirements group by sku
    )
    select coalesce(j.sku,c.sku) as sku,coalesce(j.job_reserved,0) as job_reserved,coalesce(c.committed_reserved,0) as committed_reserved
      from jc j full join cp c on c.sku=j.sku
     where abs(coalesce(j.job_reserved,0)-coalesce(c.committed_reserved,0))>0.0001
     order by sku
  `);
  if (!rows.length) return "Job-card/procurement reservation reconciliation: PASS — total open job-card reservation equals committed procurement reservation for every SKU.";
  return lines(
    `Job-card/procurement reservation reconciliation: FAIL — ${rows.length} SKU mismatch${rows.length === 1 ? "" : "es"}.`,
    rows.map((row) => `${text(row.sku)}: job-card reserved ${n(row.job_reserved).toFixed(1)} vs committed-procurement reserved ${n(row.committed_reserved).toFixed(1)}`).join("; "),
  );
}

async function physicalStockStillShort(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select requirement_month,sku,physical_quantity,reserved_quantity,available_to_promise,committed_requirement,net_committed_shortage
      from vyndi_committed_procurement_requirements
     where physical_quantity>0 and net_committed_shortage>0
     order by requirement_month,sku
  `);
  if (!rows.length) return "Physical-stock/shortage consistency: PASS — no committed requirement is simultaneously shown with positive physical stock and a net shortage requiring explanation.";
  return lines(
    `Physical-stock/shortage consistency: ${rows.length} row${rows.length === 1 ? "" : "s"} require explanation; positive physical stock does not necessarily mean free ATP.`,
    rows.map((row) => `${text(row.sku)} M${n(row.requirement_month).toFixed(0)}: physical ${n(row.physical_quantity).toFixed(1)}, reserved ${n(row.reserved_quantity).toFixed(1)}, ATP ${n(row.available_to_promise).toFixed(1)}, committed requirement ${n(row.committed_requirement).toFixed(1)}, shortage ${n(row.net_committed_shortage).toFixed(1)}`).join("; "),
    "Interpretation: this is valid when stock is already reserved/consumed by higher-priority commitments; otherwise reservation lineage must be reconciled.",
  );
}

async function inventoryLedgerArithmetic(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    with committed_skus as (select distinct sku from vyndi_committed_procurement_requirements),
    calc as (
      select l.sku,
             sum(case when m.movement_type='opening_balance' then l.quantity_delta else 0 end)::numeric as opening_qty,
             sum(case when m.movement_type='receipt' then l.quantity_delta else 0 end)::numeric as receipt_qty,
             sum(case when m.movement_type in ('issue','consume') then l.quantity_delta else 0 end)::numeric as issue_consume_delta,
             sum(case when m.movement_type='return' then l.quantity_delta else 0 end)::numeric as return_qty,
             sum(case when m.movement_type='adjust' then l.quantity_delta else 0 end)::numeric as adjustment_qty,
             sum(l.quantity_delta)::numeric as ledger_balance
        from epr_inventory_ledger l
        left join epr_inventory_movements m on m.id=l.movement_id
        join committed_skus c on c.sku=l.sku
       group by l.sku
    )
    select c.*,coalesce(b.quantity_balance,0) as physical_balance
      from calc c left join vyndi_inventory_balance b on b.sku=c.sku
     order by c.sku
  `);
  const bad = rows.filter((row) => Math.abs(n(row.ledger_balance) - n(row.physical_balance)) > 0.0001);
  if (!bad.length) {
    return lines(
      `Inventory arithmetic reconciliation: PASS — ${rows.length} committed SKU ledger${rows.length === 1 ? "" : "s"} reconcile from posted quantity deltas to canonical physical balance.`,
      rows.slice(0, 20).map((row) => `${text(row.sku)}: opening ${n(row.opening_qty).toFixed(1)} + receipts ${n(row.receipt_qty).toFixed(1)} + issue/consume ${n(row.issue_consume_delta).toFixed(1)} + returns ${n(row.return_qty).toFixed(1)} + adjustments ${n(row.adjustment_qty).toFixed(1)} = ${n(row.ledger_balance).toFixed(1)}`).join("; "),
      "Evidence: epr_inventory_ledger + epr_inventory_movements reconciled to vyndi_inventory_balance.",
    );
  }
  return lines(
    `Inventory arithmetic reconciliation: FAIL — ${bad.length} committed SKU${bad.length === 1 ? "" : "s"} do not tie to canonical physical balance.`,
    bad.map((row) => `${text(row.sku)}: ledger ${n(row.ledger_balance).toFixed(1)} vs physical ${n(row.physical_balance).toFixed(1)}`).join("; "),
  );
}

async function draftPoPriceAuthority(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select p.id,p.sku,p.supplier_id,p.unit_price_inr,ca.cost_authority,
           ca.approved_supplier_price_ref,ca.approved_planning_price_ref,ca.approved_purchase_price_ref
      from vyndi_purchase_orders p
      left join vyndi_procurement_cost_authority ca on ca.sku=p.sku
     where p.status='draft'
       and ca.approved_supplier_price_ref is null
       and ca.approved_planning_price_ref is null
       and ca.approved_purchase_price_ref is null
     order by p.created_at,p.id
  `);
  if (!rows.length) return "Draft-PO price-authority control: PASS — every draft PO SKU has an approved supplier, planning or prior approved-PO price authority available.";
  return lines(
    `Draft-PO price-authority control: FAIL — ${rows.length} draft PO${rows.length === 1 ? "" : "s"} have no approved procurement price authority.`,
    rows.map((row) => `${text(row.id)} · ${text(row.sku)} · draft value ${n(row.unit_price_inr).toFixed(2)} INR · authority ${text(row.cost_authority) || "MISSING"}`).join("; "),
    "Governance: a draft PO-entered price is not approved price authority by itself.",
  );
}

async function draftPoReceiptDate(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`select id,sku,job_card_id from vyndi_purchase_orders where status='draft' and expected_receipt_on is null order by id`);
  if (!rows.length) return "Draft-PO expected-receipt-date control: PASS — every draft PO has an expected receipt date. The table also enforces expected_receipt_on >= order_date.";
  return lines(`Draft-PO expected-receipt-date control: FAIL — ${rows.length} draft PO${rows.length === 1 ? "" : "s"} lack an expected receipt date.`, rows.map((row) => `${text(row.id)} · ${text(row.sku)} · job ${text(row.job_card_id) || "UNLINKED"}`).join("; "));
}

async function duplicateOrExcessPo(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    with po as (
      select job_card_id,sku,count(*)::int as po_count,sum(quantity_open)::numeric as open_po_qty,
             string_agg(id,', ' order by id) as po_ids
        from vyndi_purchase_order_status
       where status in ('draft','pending_approval','approved','issued','part_received') and job_card_id is not null
       group by job_card_id,sku
    ), shortage as (
      select job_card_id,sku,sum(shortage_quantity)::numeric as shortage_qty
        from vyndi_live_job_card_requirements
       where sku is not null and coalesce(issue_status,'')<>'issued'
       group by job_card_id,sku
    )
    select p.*,coalesce(s.shortage_qty,0) as shortage_qty
      from po p left join shortage s on s.job_card_id=p.job_card_id and s.sku=p.sku
     where p.po_count>1 or p.open_po_qty>coalesce(s.shortage_qty,0)
     order by p.job_card_id,p.sku
  `);
  if (!rows.length) return "PO duplicate/excess coverage control: PASS — no active job-card/SKU has multiple or excess open PO coverage relative to its current uncovered shortage.";
  return lines(
    `PO duplicate/excess coverage control: FAIL/REVIEW — ${rows.length} job-card/SKU position${rows.length === 1 ? "" : "s"} have duplicate or excess open PO coverage.`,
    rows.map((row) => `${text(row.job_card_id)} · ${text(row.sku)}: ${n(row.po_count).toFixed(0)} PO(s), open PO ${n(row.open_po_qty).toFixed(1)}, current shortage ${n(row.shortage_qty).toFixed(1)} · ${text(row.po_ids)}`).join("; "),
    "Controlled next action: validate whether the split is intentional; cancel/reduce obsolete excess before issue.",
  );
}

async function obsoletePoShortage(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select p.id,p.job_card_id,p.sku,p.status,p.quantity_open
      from vyndi_purchase_order_status p
      left join vyndi_live_job_card_requirements r
        on r.job_card_id=p.job_card_id and r.sku=p.sku and coalesce(r.issue_status,'')<>'issued' and r.shortage_quantity>0
     where p.status in ('draft','pending_approval','approved','issued','part_received')
       and p.job_card_id is not null and r.job_card_id is null
     order by p.id
  `);
  if (!rows.length) return "PO-to-current-shortage control: PASS — no active PO is linked to a job-card/SKU shortage that no longer exists.";
  return lines(
    `PO-to-current-shortage control: FAIL/REVIEW — ${rows.length} active PO${rows.length === 1 ? "" : "s"} no longer map to a current uncovered job-card shortage.`,
    rows.map((row) => `${text(row.id)} · ${text(row.job_card_id)} · ${text(row.sku)} · ${text(row.status)} · open ${n(row.quantity_open).toFixed(1)}`).join("; "),
  );
}

async function unapprovedSupplierTransaction(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select p.id,p.status,p.sku,p.supplier_id,s.name,s.approval_status,s.active
      from vyndi_purchase_orders p
      left join vyndi_suppliers s on s.id=p.supplier_id
     where p.status in ('pending_approval','approved','issued','part_received','received')
       and (p.supplier_id is null or s.id is null or s.active is distinct from true or s.approval_status<>'approved')
     order by p.id
  `);
  if (!rows.length) return "Active-procurement supplier approval control: PASS — every non-draft active/received PO references an active approved supplier.";
  return lines(
    `Active-procurement supplier approval control: FAIL — ${rows.length} PO${rows.length === 1 ? "" : "s"} reference missing, inactive or unapproved suppliers.`,
    rows.map((row) => `${text(row.id)} · ${text(row.sku)} · ${text(row.status)} · supplier ${text(row.name) || text(row.supplier_id) || "MISSING"} · approval ${text(row.approval_status) || "MISSING"}`).join("; "),
  );
}

async function criticalSkuApprovedSupplier(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    with shortage as (
      select distinct sku from vyndi_committed_procurement_requirements where net_committed_shortage>0
    )
    select s.sku
      from shortage s
     where not exists (
       select 1 from vyndi_supplier_lane_revisions l
       join vyndi_suppliers v on v.id=l.supplier_id and v.active=true and v.approval_status='approved'
       where l.sku=s.sku and l.status='approved' and l.effective_from<=current_date and (l.effective_to is null or l.effective_to>=current_date)
     )
       and not exists (
       select 1 from vyndi_procurement_prices p
       join vyndi_suppliers v on v.id=p.supplier_id and v.active=true and v.approval_status='approved'
       where p.sku=s.sku and p.price_type='supplier' and p.status='approved' and p.effective_from<=current_date and (p.effective_to is null or p.effective_to>=current_date)
     )
     order by s.sku
  `);
  if (!rows.length) return "Production-critical supplier coverage: PASS — every currently short committed SKU has an approved supplier-lane or approved supplier-price source authority.";
  return lines(
    `Production-critical supplier coverage: FAIL — ${rows.length} short committed SKU${rows.length === 1 ? "" : "s"} have no approved supplier source authority.`,
    rows.map((row) => text(row.sku)).join(", "),
    "Controlled next action: qualify an approved supplier lane/source before issuing procurement commitment.",
  );
}

async function supplierLeadTimeAuthority(sql: Sql) {
  const [planning] = await sql.query<Record<string, unknown>>(`
    select count(*)::int as total,
           count(*) filter (where planning_status='approved')::int as approved,
           count(*) filter (where planning_status='planning-default')::int as defaults
      from vyndi_supply_planning_parameters where planning_status<>'retired'
  `);
  const [lanes] = await sql.query<Record<string, unknown>>(`
    select count(*)::int as approved_lanes,
           count(*) filter (where lead_time_days is not null)::int as lanes_with_lead_time
      from vyndi_supplier_lane_revisions
     where status='approved' and effective_from<=current_date and (effective_to is null or effective_to>=current_date)
  `);
  return lines(
    `Supplier/IBPE lead-time authority: STORED AND USED, WITH AUTHORITY MATURITY EXPOSED.`,
    `Supply-planning parameters: ${n(planning?.total).toFixed(0)} active rows; ${n(planning?.approved).toFixed(0)} approved and ${n(planning?.defaults).toFixed(0)} planning-default. These lead_time_months feed the governed IBPE input.`,
    `Persisted supplier lanes: ${n(lanes?.approved_lanes).toFixed(0)} currently approved lane revision(s), ${n(lanes?.lanes_with_lead_time).toFixed(0)} with explicit lane lead-time evidence.`,
    "Governance: planning-default lead time is planning authority, not supplier-contract truth; firm supplier/CTP conclusions require approved persisted lane evidence.",
  );
}

async function priceAuthorityUsage(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select sku,cost_authority,legacy_reference_price_inr
      from vyndi_procurement_cost_authority
     where active_planning_bom and cost_authority='MISSING'
     order by sku
  `);
  if (!rows.length) return "Procurement price-authority usage: PASS — every active planning-BOM SKU has governed cost authority; legacy/catalogue reference prices are excluded from governed valuation by design.";
  return lines(
    `Procurement price-authority usage: BLOCKED — ${rows.length} active planning-BOM SKU${rows.length === 1 ? "" : "s"} have no governed cost authority.`,
    rows.map((row) => `${text(row.sku)}${n(row.legacy_reference_price_inr) > 0 ? ` (legacy reference ${n(row.legacy_reference_price_inr).toFixed(2)} INR exists but is not authority)` : ""}`).join("; "),
  );
}

async function receivedPoGrnControl(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select p.id,p.sku,p.quantity,p.quantity_received,p.quantity_accepted
      from vyndi_purchase_order_status p
     where p.status='received'
       and (p.quantity_received<=0 or not exists (select 1 from vyndi_goods_receipts g where g.purchase_order_id=p.id))
     order by p.id
  `);
  if (!rows.length) return "Received-PO GRN/inventory-receipt evidence: PASS — every PO marked received has GRN evidence and positive received quantity.";
  return lines(
    `Received-PO GRN/inventory-receipt evidence: FAIL — ${rows.length} received PO${rows.length === 1 ? "" : "s"} lack receipt evidence.`,
    rows.map((row) => `${text(row.id)} · ${text(row.sku)} · ordered ${n(row.quantity).toFixed(1)} · received ${n(row.quantity_received).toFixed(1)} · accepted ${n(row.quantity_accepted).toFixed(1)}`).join("; "),
  );
}

async function supplierInvoicePaymentLinkage(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select p.id as po_id,p.sku,
           count(i.id)::int as invoice_count,
           count(pay.id)::int as payment_count
      from vyndi_purchase_orders p
      left join vyndi_supplier_invoices i on i.purchase_order_id=p.id and i.status<>'void'
      left join vyndi_supplier_payments pay on pay.supplier_invoice_id=i.id
     where p.status='received'
     group by p.id,p.sku
    having count(i.id)=0 or count(pay.id)=0
     order by p.id
  `);
  if (!rows.length) return "Received-procurement AP linkage: PASS — every received PO has supplier-invoice and payment linkage.";
  return lines(
    `Received-procurement AP linkage: INCOMPLETE — ${rows.length} received PO${rows.length === 1 ? "" : "s"} lack invoice and/or payment linkage.`,
    rows.map((row) => `${text(row.po_id)} · ${text(row.sku)} · invoices ${n(row.invoice_count).toFixed(0)} · payments ${n(row.payment_count).toFixed(0)}`).join("; "),
    "An incomplete payable lifecycle is not automatically a control failure if payment is not yet due; VIBPE reports the exact missing downstream evidence rather than assuming completion.",
  );
}

async function workCentreLoad(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    with latest as (
      select result_json from vyndi_ibpe_runs where status='complete' order by created_at desc limit 1
    ), c as (
      select row
        from latest,lateral jsonb_array_elements(coalesce(result_json->'capacity','[]'::jsonb)) row
    )
    select row->>'id' as id,(row->>'period')::int as period,
           coalesce((row->>'requiredUnits')::numeric,0) as required_units,
           coalesce((row->>'availableCapacityUnits')::numeric,0) as available_units,
           coalesce((row->>'shortfallUnits')::numeric,0) as shortfall_units
      from c
     order by case when coalesce((row->>'availableCapacityUnits')::numeric,0)>0
                   then coalesce((row->>'requiredUnits')::numeric,0)/nullif((row->>'availableCapacityUnits')::numeric,0)
                   else 999999 end desc,
              period,id
     limit 12
  `);
  if (!rows.length) return "Work-centre load: UNKNOWN — the latest governed IBPE run contains no capacity rows.";
  return lines(
    "Work-centre load — highest loaded governed capacity rows:",
    rows.map((row) => {
      const available = n(row.available_units);
      const utilisation = available > 0 ? (n(row.required_units) / available) * 100 : 0;
      return `${text(row.id)} M${n(row.period).toFixed(0)}: required ${n(row.required_units).toFixed(1)}, available ${available.toFixed(1)}, utilisation ${utilisation.toFixed(1)}%, shortfall ${n(row.shortfall_units).toFixed(1)}`;
    }).join("; "),
    "Evidence: latest complete governed IBPE capacity rows. Capacity standards are planning evidence; authority maturity is reported separately.",
  );
}

async function workCentreOverload(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    with latest as (select result_json from vyndi_ibpe_runs where status='complete' order by created_at desc limit 1)
    select row->>'id' as id,(row->>'period')::int as period,(row->>'shortfallUnits')::numeric as shortfall_units
      from latest,lateral jsonb_array_elements(coalesce(result_json->'capacity','[]'::jsonb)) row
     where coalesce((row->>'shortfallUnits')::numeric,0)>0
     order by period,id
  `);
  if (!rows.length) return "Work-centre overload reconciliation: PASS — no capacity row has positive shortfallUnits; zero capacity-shortfall months is internally consistent with the latest governed capacity rows.";
  return lines(
    `Work-centre overload reconciliation: FAIL — ${rows.length} capacity row${rows.length === 1 ? "" : "s"} have positive shortfall despite any zero-shortfall summary claim.`,
    rows.map((row) => `${text(row.id)} M${n(row.period).toFixed(0)}: ${n(row.shortfall_units).toFixed(1)} short`).join("; "),
  );
}

async function routingCoverage(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    with products as (
      select distinct product_id from vyndi_sales_orders where status in ('lead','confirmed') and product_id is not null
    )
    select p.product_id,
           r.id as routing_revision_id,r.revision_code
      from products p
      left join lateral (
        select id,revision_code from vyndi_routing_revisions rr
         where rr.product_id=p.product_id and rr.status='approved'
           and rr.effective_from<=current_date and (rr.effective_to is null or rr.effective_to>=current_date)
         order by rr.effective_from desc,rr.approved_at desc nulls last limit 1
      ) r on true
     order by p.product_id
  `);
  const missing = rows.filter((row) => !text(row.routing_revision_id));
  if (!missing.length) return `Manufacturing-routing coverage: PASS — all ${rows.length} commercially active product${rows.length === 1 ? "" : "s"} have an effective approved persisted routing revision.`;
  return lines(
    `Manufacturing-routing coverage: FAIL — ${missing.length} of ${rows.length} commercially active product${rows.length === 1 ? "" : "s"} lack an effective approved persisted routing revision.`,
    `Missing: ${missing.map((row) => text(row.product_id)).join(", ")}.`,
    "Scope: products present in current lead/confirmed commercial demand. A broader product-master definition should use its own active-product authority when available.",
  );
}

async function routingPersistence(sql: Sql) {
  const [routing] = await sql.query<Record<string, unknown>>(`
    select count(*) filter (where status='approved' and effective_from<=current_date and (effective_to is null or effective_to>=current_date))::int as approved,
           count(*) filter (where status='draft')::int as draft
      from vyndi_routing_revisions
  `);
  const [capacity] = await sql.query<Record<string, unknown>>(`
    select count(*)::int as total,count(*) filter (where planning_status='approved')::int as approved
      from vyndi_capacity_standards where planning_status<>'retired'
  `);
  return lines(
    `Routing authority state: ${n(routing?.approved)>0 ? "persisted approved routing revisions exist" : "routing remains provisional/capacity-standard-derived for planning where no approved persisted routing exists"}.`,
    `Persisted routing revisions: ${n(routing?.approved).toFixed(0)} effective approved, ${n(routing?.draft).toFixed(0)} draft. Capacity standards: ${n(capacity?.approved).toFixed(0)}/${n(capacity?.total).toFixed(0)} approved.`,
    "Governance: capacity standards can support provisional routing derivation, but they are not equivalent to an approved persisted manufacturing routing revision.",
  );
}

async function capacityStandardsApproval(sql: Sql) {
  const rows = await sql.query<Record<string, unknown>>(`
    select work_centre_id,work_centre_name,planning_status,source_ref
      from vyndi_capacity_standards
     where planning_status<>'retired'
     order by sequence,work_centre_id
  `);
  const unapproved = rows.filter((row) => text(row.planning_status) !== "approved");
  if (!unapproved.length) return `Capacity-standard authority: PASS — all ${rows.length} active capacity standards are approved.`;
  return lines(
    `Capacity-standard authority: FAIL — ${unapproved.length} of ${rows.length} active capacity standards are not approved.`,
    unapproved.map((row) => `${text(row.work_centre_id)} · ${text(row.work_centre_name)} · ${text(row.planning_status)} · ${text(row.source_ref)}`).join("; "),
    "Decision consequence: capacity results using non-approved standards remain planning/provisional evidence and must not be presented as firm CTP authority.",
  );
}

async function firmCtpEligibility(sql: Sql) {
  const [capacity] = await sql.query<Record<string, unknown>>(`
    select count(*)::int as total,count(*) filter (where planning_status='approved')::int as approved
      from vyndi_capacity_standards where planning_status<>'retired'
  `);
  const [routing] = await sql.query<Record<string, unknown>>(`
    select count(*) filter (where status='approved' and effective_from<=current_date and (effective_to is null or effective_to>=current_date))::int as approved
      from vyndi_routing_revisions
  `);
  const [lanes] = await sql.query<Record<string, unknown>>(`
    select count(*) filter (where status='approved' and effective_from<=current_date and (effective_to is null or effective_to>=current_date))::int as approved
      from vyndi_supplier_lane_revisions
  `);
  const missing: string[] = [];
  if (n(capacity?.approved) < n(capacity?.total)) missing.push(`${n(capacity?.total)-n(capacity?.approved)} unapproved capacity standard(s)`);
  if (n(routing?.approved) === 0) missing.push("no effective approved persisted routing revision");
  if (n(lanes?.approved) === 0) missing.push("no effective approved persisted supplier-lane revision");
  return lines(
    "Firm capable-to-promise (CTP): NOT YET ELIGIBLE under the current advanced-planning authority contract.",
    `Current authority evidence: capacity standards ${n(capacity?.approved).toFixed(0)}/${n(capacity?.total).toFixed(0)} approved; effective approved routing revisions ${n(routing?.approved).toFixed(0)}; effective approved supplier-lane revisions ${n(lanes?.approved).toFixed(0)}.`,
    `Exact missing/remaining authority: ${missing.length ? missing.join("; ") : "the firm-CTP capability gate itself remains disabled even though the queried authority tables are populated; release requires the constrained-CTP governance gate to be explicitly enabled and validated"}.`,
    "VIBPE may provide advisory feasibility/period evidence, but it must not state a firm customer promise date until this gate is eligible.",
  );
}

async function capacityExpansionBlocker(sql: Sql) {
  const [run] = await sql.query<Record<string, unknown>>(`
    select coalesce((result_json->'summary'->>'capacityShortfallMonths')::numeric,0) as capacity_shortfall_months
      from vyndi_ibpe_runs where status='complete' order by created_at desc limit 1
  `);
  const [mat] = await sql.query<Record<string, unknown>>(`
    select coalesce(sum(net_committed_shortage),0)::numeric as shortage_qty,
           count(distinct sku) filter (where net_committed_shortage>0)::int as shortage_skus
      from vyndi_committed_procurement_requirements
  `);
  const cap = n(run?.capacity_shortfall_months);
  const shortage = n(mat?.shortage_qty);
  return lines(
    `Capacity-expansion test: ${cap === 0 && shortage > 0 ? "NO — increasing production capacity would not solve the current confirmed-order blocker" : cap > 0 ? "CAPACITY MAY BE PART OF THE BLOCKER" : "NO CURRENT CAPACITY OR COMMITTED-MATERIAL BLOCKER IS EVIDENCED"}.`,
    `Latest governed capacity shortfall months: ${cap.toFixed(0)}. Exact committed material shortage: ${shortage.toFixed(1)} component units across ${n(mat?.shortage_skus).toFixed(0)} SKU(s).`,
    cap === 0 && shortage > 0 ? "Primary corrective action is material/supplier coverage, not added plant capacity." : "Use the exact work-centre and material exception rows to determine the corrective action; do not infer one constraint from the other.",
  );
}

export async function tryVibpeOperationalControlAudit(sql: Sql, question: string): Promise<string | undefined> {
  const q = qn(question);

  if (/current revision/.test(q) && /job[- ]?card/.test(q) && /sales order|originating/.test(q)) return orderRevisionControl(sql);
  if (/job[- ]?cards?/.test(q) && /(cancelled|superseded|non-confirmed)/.test(q) && /sales orders?/.test(q)) return invalidOrderStateJobCards(sql);
  if (/sales[- ]?order quantities|sales order quantities/.test(q) && /job[- ]?card/.test(q) && /reconcil/.test(q)) return orderJobQuantityReconciliation(sql);
  if (/orders?/.test(q) && /duplicated|more than one active job card/.test(q)) return duplicateActiveJobCards(sql);
  if (/complete workflow state/.test(q) && /confirmed order/.test(q)) return confirmedOrderWorkflowState(sql);

  if (/bom/.test(q) && /job[- ]?card/.test(q) && /(released|complete|consistent|explosion|match)/.test(q)) return bomCompliance(sql);
  if (/job[- ]?card material rows?/.test(q) && /missing a sku|missing sku/.test(q)) return missingRequirementSku(sql);
  if (/required material quantities/.test(q) && /(zero|negative)/.test(q)) return nonPositiveRequirement(sql);
  if (/material requirements?/.test(q) && /master inventory/.test(q)) return invalidMasterInventoryRequirement(sql);

  if (/physical stock/.test(q) && /reserved stock/.test(q) && /atp/.test(q)) return committedInventoryPosition(sql);
  if (/reservations?/.test(q) && /greater than physical stock/.test(q)) return overReservationControl(sql);
  if (/negative atp/.test(q)) return negativeAtpControl(sql);
  if (/covered by stock/.test(q) && /not reserved/.test(q)) return stockCoveredButUnreserved(sql);
  if (/reservations?/.test(q) && /(cancelled|obsolete) demand/.test(q)) return obsoleteReservationControl(sql);
  if (/job[- ]?card reservation/.test(q) && /procurement reservation/.test(q)) return reservationReconciliation(sql);
  if (/physically available/.test(q) && /shown as shortages?/.test(q)) return physicalStockStillShort(sql);
  if (/inventory reconcile/.test(q) && /(opening stock|receipts|issues|adjustments)/.test(q)) return inventoryLedgerArithmetic(sql);

  if (/draft (?:purchase orders?|pos?)/.test(q) && /no approved price|without approved price/.test(q)) return draftPoPriceAuthority(sql);
  if (/draft (?:purchase orders?|pos?)/.test(q) && /no expected receipt date|without expected receipt date/.test(q)) return draftPoReceiptDate(sql);
  if (/purchase orders?|\bpos?\b/.test(q) && /(duplicated|larger than the actual uncovered|excess)/.test(q)) return duplicateOrExcessPo(sql);
  if (/\bpos?\b|purchase orders?/.test(q) && /shortages? that no longer exist/.test(q)) return obsoletePoShortage(sql);
  if (/suppliers?/.test(q) && /not approved/.test(q) && /(active procurement|transaction)/.test(q)) return unapprovedSupplierTransaction(sql);
  if (/production-critical skus?/.test(q) && /no approved supplier/.test(q)) return criticalSkuApprovedSupplier(sql);
  if (/supplier lead times?/.test(q) && /(stored|used)/.test(q) && /procurement recommendations?/.test(q)) return supplierLeadTimeAuthority(sql);
  if (/supplier prices?/.test(q) && /without approved price authority/.test(q)) return priceAuthorityUsage(sql);
  if (/received (?:purchase orders?|pos?)/.test(q) && /(missing grn|inventory receipt evidence)/.test(q)) return receivedPoGrnControl(sql);
  if (/received supplier transactions?/.test(q) && /(invoice|payment linkage)/.test(q)) return supplierInvoicePaymentLinkage(sql);

  if (/work centres?/.test(q) && /most heavily loaded/.test(q)) return workCentreLoad(sql);
  if (/work centres?/.test(q) && /overloaded/.test(q)) return workCentreOverload(sql);
  if (/every active product/.test(q) && /approved manufacturing routing/.test(q)) return routingCoverage(sql);
  if (/routing operations?/.test(q) && /(persisted|derived provisionally|controlled revisions)/.test(q)) return routingPersistence(sql);
  if (/all capacity standards/.test(q) && /approved/.test(q)) return capacityStandardsApproval(sql);
  if (/firm capable[- ]to[- ]promise|firm ctp/.test(q)) return firmCtpEligibility(sql);
  if (/increasing production capacity/.test(q) && /confirmed-order blocker|current confirmed/.test(q)) return capacityExpansionBlocker(sql);

  return undefined;
}
