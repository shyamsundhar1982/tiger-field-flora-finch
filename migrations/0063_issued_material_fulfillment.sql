-- A consumed Production reservation is material already issued to WIP/traveller genealogy.
-- It must never reappear as an open stock shortage merely because the physical FIFO layer
-- has left stores and the reservation is no longer active.
--
-- The original live view subtracted only ACTIVE reservations and free ATP. After a full
-- FIFO issue, both values become zero, so the same fulfilled line incorrectly returned as
-- a shortage. Keep original requirement truth, but make an issued line operationally
-- fulfilled and remove it from outstanding committed procurement demand.

create or replace view vyndi_live_job_card_requirements as
select
  c.id as job_card_id,
  c.sales_order_id,
  c.sales_order_revision,
  c.product_id,
  c.product_label,
  c.variant_id,
  c.bom_revision,
  c.units,
  c.due_month,
  c.status as job_card_status,
  l.id as job_card_line_id,
  l.bom_mapping_id,
  l.sku,
  l.category,
  l.item,
  vyndi_canonical_unit(l.unit) as unit,
  l.quantity as required_quantity,
  coalesce(r.quantity_reserved,0) as reserved_quantity,
  case
    when l.issue_status='issued' then 0::numeric
    else greatest(l.quantity-coalesce(r.quantity_reserved,0)-coalesce(atp.available_to_promise,0),0)
  end as shortage_quantity,
  coalesce(atp.physical_quantity,0) as physical_quantity,
  coalesce(atp.available_to_promise,0) as available_to_promise,
  l.issue_status
from epr_production_job_cards c
join epr_production_job_card_lines l on l.job_card_id=c.id
left join epr_inventory_reservations r
  on r.job_card_line_id=l.id and r.status='active'
left join vyndi_inventory_available_to_promise atp
  on atp.sku=l.sku and atp.unit=vyndi_canonical_unit(l.unit);

-- Procurement must plan only the material still outstanding for released/in-progress
-- Production. Once a line has been physically issued, its original BOM requirement remains
-- visible in the live job-card view for genealogy, but it is no longer a buy requirement.
create or replace view vyndi_committed_procurement_requirements as
select
  due_month as requirement_month,
  sku,
  unit,
  sum(required_quantity) as committed_requirement,
  sum(reserved_quantity) as reserved_quantity,
  max(physical_quantity) as physical_quantity,
  max(available_to_promise) as available_to_promise,
  greatest(sum(required_quantity)-max(physical_quantity),0) as net_committed_shortage,
  count(distinct sales_order_id)::int as committed_order_count
from vyndi_live_job_card_requirements
where job_card_status in ('released','in_progress')
  and sku is not null
  and issue_status<>'issued'
group by due_month,sku,unit;

-- Repair any legacy line snapshot that was already issued but subsequently surfaced with a
-- stale shortage value. The live view above is authoritative, while this keeps the persisted
-- line snapshot internally coherent for reports that still read the base table directly.
update epr_production_job_card_lines
   set shortage_quantity=0,
       available_quantity=0
 where issue_status='issued'
   and shortage_quantity<>0;
