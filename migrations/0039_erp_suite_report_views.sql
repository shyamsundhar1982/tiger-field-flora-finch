-- VYNDI ERP Suite — Report views (read-only, exportable)
-- Generated for Custom VYNDI ERP Suite packaging.
-- All views are report-only: they never post, delete, reverse or mutate stock/finance truth.
-- Depends on prior canonical migrations (0023–0038): inventory, sales, production,
-- reservations, procure-to-pay, actuals, audit events, BOM mappings, etc.

-- ---------------------------------------------------------------------------
-- 1. Inventory & Supply
-- ---------------------------------------------------------------------------

-- 1a. Cutover already exists as vyndi_master_inventory_cutover_report (0026).
-- 1b. ATP already exists as vyndi_inventory_available_to_promise (0024).

-- Reservation health: active reservations vs physical stock
create or replace view vyndi_report_reservation_health as
select
  r.id as reservation_id,
  r.sku,
  vyndi_canonical_unit(r.unit) as unit,
  r.quantity_reserved,
  r.status,
  r.job_card_id,
  r.sales_order_id,
  r.created_at,
  coalesce(b.quantity_balance, 0) as physical_quantity,
  coalesce(atp.available_to_promise, 0) as available_to_promise,
  case
    when r.quantity_reserved <= 0 then 'INVALID'
    when coalesce(b.quantity_balance, 0) < r.quantity_reserved then 'OVER_RESERVED'
    else 'OK'
  end as health
from epr_inventory_reservations r
left join vyndi_inventory_balance b
  on b.sku = r.sku and b.unit = vyndi_canonical_unit(r.unit)
left join vyndi_inventory_available_to_promise atp
  on atp.sku = r.sku and atp.unit = vyndi_canonical_unit(r.unit)
where r.status = 'active';

comment on view vyndi_report_reservation_health is
  'Active production reservations with physical vs ATP health flags. Report-only.';

-- MSL / forecast health
create or replace view vyndi_report_msl_health as
select
  i.id as item_id,
  i.ledger_id,
  i.sku,
  i.name,
  i.category,
  i.unit,
  i.minimum_stock_level,
  i.planned_monthly_use,
  coalesce(atp.physical_quantity, 0) as physical_quantity,
  coalesce(atp.reserved_quantity, 0) as reserved_quantity,
  coalesce(atp.available_to_promise, 0) as available_to_promise,
  case
    when i.minimum_stock_level > 0 and coalesce(atp.available_to_promise, 0) < i.minimum_stock_level
      then 'BELOW_MSL'
    when i.planned_monthly_use > 0 and coalesce(atp.available_to_promise, 0) < i.planned_monthly_use
      then 'BELOW_MONTHLY_USE'
    when i.minimum_stock_level = 0 and i.planned_monthly_use = 0
      then 'NO_PLAN'
    else 'OK'
  end as health,
  case
    when i.planned_monthly_use > 0
      then round(coalesce(atp.available_to_promise, 0) / nullif(i.planned_monthly_use, 0), 2)
    else null
  end as months_of_cover
from master_inventory_items i
left join vyndi_inventory_available_to_promise atp
  on atp.sku = i.sku and atp.unit = vyndi_canonical_unit(i.unit)
where i.active = true;

comment on view vyndi_report_msl_health is
  'Master Inventory items with MSL and monthly-use coverage vs ATP. Report-only.';

-- FIFO aging
create or replace view vyndi_report_fifo_aging as
select
  f.id as layer_id,
  f.sku,
  vyndi_canonical_unit(f.unit) as unit,
  f.quantity_received,
  f.quantity_remaining,
  f.unit_cost_inr,
  round(f.quantity_remaining * f.unit_cost_inr, 2) as residual_value_inr,
  f.received_at::date as received_on,
  (current_date - f.received_at::date) as age_days,
  case
    when (current_date - f.received_at::date) > 365 then 'OVER_12M'
    when (current_date - f.received_at::date) > 180 then 'OVER_6M'
    when (current_date - f.received_at::date) > 90 then 'OVER_3M'
    else 'FRESH'
  end as aging_bucket
from epr_inventory_fifo_layers f
where f.quantity_remaining > 0
order by f.received_at asc, f.id;

comment on view vyndi_report_fifo_aging is
  'Open FIFO layers with residual value and aging buckets. Report-only.';

-- Procurement net requirement (planned/committed/stock/PO)
create or replace view vyndi_report_procurement_net_requirement as
with open_po as (
  select sku, vyndi_canonical_unit(unit) as unit,
         sum(greatest(quantity - coalesce(quantity_accepted, 0), 0)) as open_po_qty
    from vyndi_purchase_order_status
   where status not in ('cancelled', 'closed', 'fully_received')
   group by sku, vyndi_canonical_unit(unit)
),
committed as (
  select r.sku, vyndi_canonical_unit(r.unit) as unit,
         sum(r.quantity_reserved) as committed_qty
    from epr_inventory_reservations r
   where r.status = 'active'
   group by r.sku, vyndi_canonical_unit(r.unit)
)
select
  i.sku,
  vyndi_canonical_unit(i.unit) as unit,
  i.name,
  i.ledger_id,
  i.minimum_stock_level,
  i.planned_monthly_use,
  coalesce(atp.physical_quantity, 0) as physical_qty,
  coalesce(c.committed_qty, 0) as committed_reserved_qty,
  coalesce(atp.available_to_promise, 0) as atp_qty,
  coalesce(p.open_po_qty, 0) as open_po_qty,
  greatest(
    i.minimum_stock_level - coalesce(atp.available_to_promise, 0) - coalesce(p.open_po_qty, 0),
    0
  ) as net_buy_to_msl,
  greatest(
    i.planned_monthly_use - coalesce(atp.available_to_promise, 0) - coalesce(p.open_po_qty, 0),
    0
  ) as net_buy_to_monthly_use
from master_inventory_items i
left join vyndi_inventory_available_to_promise atp
  on atp.sku = i.sku and atp.unit = vyndi_canonical_unit(i.unit)
left join committed c on c.sku = i.sku and c.unit = vyndi_canonical_unit(i.unit)
left join open_po p on p.sku = i.sku and p.unit = vyndi_canonical_unit(i.unit)
where i.active = true;

comment on view vyndi_report_procurement_net_requirement is
  'SKU net requirement: physical, reserved, ATP, open PO, recommended buy to MSL/monthly use. Report-only.';

-- Receiving / GRN exceptions (from purchase order status where possible)
create or replace view vyndi_report_receiving_exceptions as
select
  p.id as purchase_order_id,
  p.sku,
  p.unit,
  p.quantity as ordered_qty,
  coalesce(p.quantity_received, 0) as quantity_received,
  coalesce(p.quantity_accepted, 0) as quantity_accepted,
  p.status,
  p.supplier_name,
  p.job_card_id,
  case
    when coalesce(p.quantity_received, 0) > coalesce(p.quantity_accepted, 0)
      then 'PENDING_INSPECTION_OR_QUARANTINE'
    when p.status in ('issued', 'partially_received') and coalesce(p.quantity_received, 0) < p.quantity
      then 'OPEN_RECEIPT'
    when p.status = 'draft' then 'UNISSUED_DRAFT'
    else 'OK'
  end as exception_class
from vyndi_purchase_order_status p
where p.status not in ('cancelled', 'closed', 'fully_received')
   or coalesce(p.quantity_received, 0) > coalesce(p.quantity_accepted, 0);

comment on view vyndi_report_receiving_exceptions is
  'Open or mismatched PO/GRN rows needing inspection, acceptance or issue. Report-only.';

-- ---------------------------------------------------------------------------
-- 2. Engineering → Production
-- ---------------------------------------------------------------------------

-- BOM / mapping compliance for job cards
create or replace view vyndi_report_bom_compliance as
select
  c.id as job_card_id,
  c.sales_order_id,
  c.sales_order_revision,
  c.status as job_status,
  c.bom_revision,
  c.model_id,
  c.venture,
  case
    when c.bom_revision is null or c.bom_revision = '' then 'MISSING_BOM_REVISION'
    when not exists (
      select 1 from epr_bom_inventory_mappings m
       where m.venture = c.venture
         and m.model_id = c.model_id
         and m.bom_revision = c.bom_revision
         and m.status = 'active'
         and m.approved_by is not null
    ) then 'NO_APPROVED_MAPPING'
    else 'OK'
  end as compliance
from epr_production_job_cards c
where c.status not in ('cancelled', 'void');

comment on view vyndi_report_bom_compliance is
  'Job cards missing approved BOM revision or active mappings. Report-only.';

-- Production record chain (sales → job → traveller) — enhance existing if present
create or replace view vyndi_report_production_release_gate as
select
  c.id as job_card_id,
  c.sales_order_id,
  c.status,
  c.bom_revision,
  o.status as order_status,
  o.units as order_units,
  o.plan_month,
  case
    when c.status in ('draft', 'pending_release', 'awaiting_approval') then 'AWAITING_RELEASE'
    when c.status = 'released' then 'RELEASED'
    when c.status = 'complete' then 'COMPLETE'
    else upper(c.status)
  end as gate_status
from epr_production_job_cards c
left join vyndi_sales_orders o on o.id = c.sales_order_id;

comment on view vyndi_report_production_release_gate is
  'Production job cards and release gate status relative to sales order. Report-only.';

-- ---------------------------------------------------------------------------
-- 3. Commercial
-- ---------------------------------------------------------------------------

create or replace view vyndi_report_order_book_sync as
select
  o.id as sales_order_id,
  o.revision as order_revision,
  o.status as order_status,
  o.plan_month,
  o.product_id,
  o.units as order_units,
  o.asp_lakh,
  c.id as job_card_id,
  c.sales_order_revision as job_order_revision,
  c.status as job_status,
  case
    when c.id is null and o.status in ('confirmed', 'delivered') then 'MISSING_JOB_CARD'
    when c.id is not null and c.sales_order_revision is distinct from o.revision then 'STALE_JOB_CARD'
    when o.status = 'cancelled' and c.status not in ('cancelled', 'void') then 'CANCELLED_ORDER_ACTIVE_JOB'
    else 'SYNCED'
  end as sync_status
from vyndi_sales_orders o
left join epr_production_job_cards c on c.sales_order_id = o.id;

comment on view vyndi_report_order_book_sync is
  'Sales order vs production job-card revision/status synchronisation. Report-only.';

create or replace view vyndi_report_order_backlog as
select
  o.id as sales_order_id,
  o.revision,
  o.status,
  o.plan_month,
  o.product_id,
  o.variant_name,
  o.units,
  o.asp_lakh,
  o.channel,
  o.updated_at,
  coalesce(shipped.shipped_units, 0) as shipped_units,
  greatest(o.units - coalesce(shipped.shipped_units, 0), 0) as open_units
from vyndi_sales_orders o
left join (
  select sales_order_id, sum(units) as shipped_units
    from vyndi_shipments where status = 'posted'
   group by sales_order_id
) shipped on shipped.sales_order_id = o.id
where o.status in ('lead', 'confirmed');

comment on view vyndi_report_order_backlog is
  'Open commercial backlog with shipped vs remaining units. Report-only.';

-- ---------------------------------------------------------------------------
-- 4. Financial / Actuals
-- ---------------------------------------------------------------------------

-- Monthly transaction actuals already exist: vyndi_monthly_transaction_actuals

create or replace view vyndi_report_receivables_aging as
select
  i.id as invoice_id,
  i.sales_order_id,
  i.plan_month,
  i.amount_lakh as invoiced_lakh,
  coalesce(col.collected_lakh, 0) as collected_lakh,
  greatest(i.amount_lakh - coalesce(col.collected_lakh, 0), 0) as open_lakh,
  i.issued_at::date as issued_on,
  (current_date - i.issued_at::date) as age_days,
  case
    when (current_date - i.issued_at::date) > 90 then 'OVER_90'
    when (current_date - i.issued_at::date) > 60 then 'OVER_60'
    when (current_date - i.issued_at::date) > 30 then 'OVER_30'
    else 'CURRENT'
  end as aging_bucket
from vyndi_invoices i
left join (
  select invoice_id, sum(amount_lakh) as collected_lakh
    from vyndi_collections where status = 'posted'
   group by invoice_id
) col on col.invoice_id = i.id
where i.status = 'issued'
  and greatest(i.amount_lakh - coalesce(col.collected_lakh, 0), 0) > 0;

comment on view vyndi_report_receivables_aging is
  'Open invoices with collection aging buckets. Report-only.';

create or replace view vyndi_report_payables_aging as
select
  p.id as purchase_order_id,
  p.sku,
  p.supplier_name,
  p.quantity,
  p.status,
  p.unit_price_inr,
  round(p.quantity * coalesce(p.unit_price_inr, 0), 2) as ordered_value_inr,
  p.created_at::date as created_on,
  (current_date - p.created_at::date) as age_days,
  case
    when p.status in ('draft') then 'UNISSUED'
    when p.status in ('issued', 'partially_received') then 'OPEN'
    else upper(p.status)
  end as payable_class
from vyndi_purchase_order_status p
where p.status not in ('cancelled', 'closed', 'fully_received');

comment on view vyndi_report_payables_aging is
  'Open purchase orders / payables class and age. Report-only.';

-- ---------------------------------------------------------------------------
-- 5. Governance
-- ---------------------------------------------------------------------------

create or replace view vyndi_report_audit_coverage as
select
  entity_type,
  count(*)::int as event_count,
  count(distinct entity_id)::int as distinct_entities,
  min(created_at) as first_event_at,
  max(created_at) as last_event_at
from vyndi_audit_events
group by entity_type
order by entity_type;

comment on view vyndi_report_audit_coverage is
  'Append-only audit event coverage by entity type. Report-only.';

create or replace view vyndi_report_recent_audit_events as
select
  id,
  entity_type,
  entity_id,
  entity_revision,
  action,
  actor_user_id,
  actor_role,
  source_reference,
  payload_json,
  created_at
from vyndi_audit_events
order by created_at desc
limit 500;

comment on view vyndi_report_recent_audit_events is
  'Most recent 500 business audit events for Control Tower. Report-only.';

-- ---------------------------------------------------------------------------
-- 6. Cross-cutting S&OP snapshot (summary KPIs)
-- ---------------------------------------------------------------------------

create or replace view vyndi_report_sop_snapshot as
select
  (select count(*)::int from vyndi_sales_orders where status in ('lead', 'confirmed')) as open_orders,
  (select coalesce(sum(units), 0) from vyndi_sales_orders where status in ('lead', 'confirmed')) as open_order_units,
  (select count(*)::int from epr_production_job_cards where status not in ('complete', 'cancelled', 'void')) as open_job_cards,
  (select count(*)::int from epr_inventory_reservations where status = 'active') as active_reservations,
  (select coalesce(sum(quantity_reserved), 0) from epr_inventory_reservations where status = 'active') as reserved_units,
  (select count(*)::int from master_inventory_items i
     left join vyndi_inventory_available_to_promise atp on atp.sku = i.sku and atp.unit = vyndi_canonical_unit(i.unit)
    where i.active and i.minimum_stock_level > 0 and coalesce(atp.available_to_promise, 0) < i.minimum_stock_level
  ) as skus_below_msl,
  (select count(*)::int from vyndi_purchase_order_status where status not in ('cancelled', 'closed', 'fully_received')) as open_pos,
  (select coalesce(sum(open_lakh), 0) from (
     select greatest(i.amount_lakh - coalesce(c.collected, 0), 0) as open_lakh
       from vyndi_invoices i
       left join (select invoice_id, sum(amount_lakh) collected from vyndi_collections where status = 'posted' group by invoice_id) c
         on c.invoice_id = i.id
      where i.status = 'issued'
   ) x) as open_receivables_lakh,
  (select count(*)::int from vyndi_audit_events where created_at > now() - interval '7 days') as audit_events_7d;

comment on view vyndi_report_sop_snapshot is
  'Single-row S&OP / Control Tower KPI snapshot. Report-only.';
