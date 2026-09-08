-- Preserve the original vyndi_purchase_order_status column contract before
-- PR #42 appends job_card_id and auto_generated to vyndi_purchase_orders.
-- This file intentionally runs before 0037_production_batch_auto_procurement.sql.
-- It is safe when the production migration has already been applied because the
-- PR #42 status view already exists with the appended columns.

do $$
declare
  v_production_applied boolean := false;
begin
  if to_regclass('_migrations') is not null then
    execute $q$
      select exists (
        select 1 from _migrations
         where name = '0037_production_batch_auto_procurement.sql'
      )
    $q$ into v_production_applied;
  end if;

  if not v_production_applied then
    create or replace view vyndi_purchase_order_status as
    select p.id,
           p.supplier_id,
           p.source_action_id,
           p.requirement_month,
           p.sku,
           p.unit,
           p.quantity,
           p.unit_price_inr,
           p.order_date,
           p.expected_receipt_on,
           p.payment_terms_days,
           p.status,
           p.source_reference,
           p.notes,
           p.created_by,
           p.created_at,
           p.approved_by,
           p.approved_at,
           p.issued_by,
           p.issued_at,
           p.updated_by,
           p.updated_at,
           coalesce(s.name,'Supplier not assigned') as supplier_name,
           coalesce(s.currency,'INR') as currency,
           coalesce(r.quantity_received,0) as quantity_received,
           coalesce(r.quantity_accepted,0) as quantity_accepted,
           greatest(p.quantity-coalesce(r.quantity_accepted,0),0) as quantity_open,
           p.quantity*p.unit_price_inr as order_value_inr
      from vyndi_purchase_orders p
      left join vyndi_suppliers s on s.id=p.supplier_id
      left join (
        select purchase_order_id,
               sum(quantity_received) quantity_received,
               sum(quantity_accepted) quantity_accepted
          from vyndi_goods_receipts
         group by purchase_order_id
      ) r on r.purchase_order_id=p.id;
  end if;
end;
$$;
