-- ---------------------------------------------------------------------------
-- 6. Report-only cutover evidence. No legacy quantity is silently copied into
--    the authoritative EPR ledger and no seed lot is auto-deleted.
-- ---------------------------------------------------------------------------
create or replace view vyndi_master_inventory_cutover_report as
select
  i.id as item_id,
  i.ledger_id,
  i.sku,
  i.name,
  i.unit,
  l.id as legacy_lot_id,
  l.quantity_received,
  l.quantity_remaining,
  l.unit_cost_inr,
  l.received_on,
  l.reference,
  l.created_by,
  case
    when l.created_by='catalogue-seed' or l.id like 'component-seed-%' then 'CATALOGUE_SEED_REVIEW'
    else 'USER_RECEIPT_REVIEW'
  end as reconciliation_class,
  coalesce(b.quantity_balance,0) as authoritative_epr_quantity
from master_inventory_items i
join master_inventory_lots l on l.item_id=i.id
left join vyndi_inventory_balance b on b.sku=i.sku and b.unit=vyndi_canonical_unit(i.unit)
where l.quantity_remaining > 0
order by reconciliation_class,i.ledger_id,i.sku,l.received_on,l.id;

comment on view vyndi_master_inventory_cutover_report is
  'Report-only legacy Master Inventory lots requiring explicit reviewed cutover. It never posts, deletes, reverses or copies quantity.';
comment on view vyndi_inventory_available_to_promise is
  'Canonical ATP = physical quantity in the EPR append-only ledger less active production reservations.';
comment on table vyndi_sales_orders is
  'Server-backed Commercial order authority. Production is a synchronized projection of the current order revision.';
comment on table vyndi_plan_revisions is
  'Versioned multi-user planning/finance authority. Browser state is draft/cache only once UI wiring is enabled.';
