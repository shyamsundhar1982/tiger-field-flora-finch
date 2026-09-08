-- Close the governed recommendation -> purchase -> receipt -> payable loop.
-- Planning actions remain advisory lineage. These tables own authorised
-- supplier, purchase-order, goods-receipt, invoice and payment transactions.

create table if not exists vyndi_suppliers (
  id text primary key,
  name text not null,
  currency text not null default 'INR',
  payment_terms_days integer not null default 30 check (payment_terms_days between 0 and 365),
  lead_time_days integer not null default 30 check (lead_time_days between 0 and 730),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','suspended')),
  quality_rating numeric(5,2) check (quality_rating between 0 and 100),
  delivery_rating numeric(5,2) check (delivery_rating between 0 and 100),
  source_reference text not null,
  active boolean not null default true,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create table if not exists vyndi_purchase_orders (
  id text primary key,
  supplier_id text not null references vyndi_suppliers(id) on delete restrict,
  source_action_id text references epr_procurement_sku_actions(id) on delete restrict,
  requirement_month integer not null check (requirement_month between 1 and 36),
  sku text not null check (sku=upper(sku)),
  unit text not null,
  quantity numeric(14,4) not null check (quantity > 0),
  unit_price_inr numeric(14,2) not null check (unit_price_inr >= 0),
  order_date date not null,
  expected_receipt_on date not null,
  payment_terms_days integer not null check (payment_terms_days between 0 and 365),
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','issued','part_received','received','cancelled')),
  source_reference text not null,
  notes text not null default '',
  created_by text not null,
  created_at timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz,
  issued_by text,
  issued_at timestamptz,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  check (expected_receipt_on >= order_date)
);

create index if not exists vyndi_purchase_orders_status_idx
  on vyndi_purchase_orders(status,expected_receipt_on,sku);

create table if not exists vyndi_goods_receipts (
  id text primary key,
  purchase_order_id text not null references vyndi_purchase_orders(id) on delete restrict,
  received_on date not null,
  quantity_received numeric(14,4) not null check (quantity_received > 0),
  quantity_accepted numeric(14,4) not null check (quantity_accepted >= 0),
  quantity_quarantined numeric(14,4) not null default 0 check (quantity_quarantined >= 0),
  quantity_rejected numeric(14,4) not null check (quantity_rejected >= 0),
  inspection_status text not null check (inspection_status in ('accepted','quarantine','rejected')),
  source_reference text not null,
  notes text not null default '',
  inventory_movement_id text unique,
  resolution_reference text,
  resolved_by text,
  resolved_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  check (quantity_received=quantity_accepted+quantity_quarantined+quantity_rejected),
  check ((inspection_status='accepted' and quantity_accepted>0 and quantity_quarantined=0) or
         (inspection_status='quarantine' and quantity_accepted=0 and quantity_quarantined>0 and quantity_rejected=0) or
         (inspection_status='rejected' and quantity_accepted=0 and quantity_quarantined=0 and quantity_rejected>0))
);

create table if not exists vyndi_supplier_invoices (
  id text primary key,
  purchase_order_id text not null references vyndi_purchase_orders(id) on delete restrict,
  invoice_number text not null,
  invoice_on date not null,
  due_on date not null,
  quantity_invoiced numeric(14,4) not null check (quantity_invoiced > 0),
  amount_ex_gst_inr numeric(16,2) not null check (amount_ex_gst_inr >= 0),
  gst_inr numeric(16,2) not null default 0 check (gst_inr >= 0),
  status text not null check (status in ('matched','blocked','approved','part_paid','paid','void')),
  match_message text not null,
  source_reference text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (purchase_order_id,invoice_number),
  check (due_on >= invoice_on)
);

create table if not exists vyndi_supplier_payments (
  id text primary key,
  supplier_invoice_id text not null references vyndi_supplier_invoices(id) on delete restrict,
  paid_on date not null,
  amount_inr numeric(16,2) not null check (amount_inr > 0),
  source_reference text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create or replace view vyndi_purchase_order_status as
select p.*,
       s.name as supplier_name,s.currency,
       coalesce(r.quantity_received,0) as quantity_received,
       coalesce(r.quantity_accepted,0) as quantity_accepted,
       greatest(p.quantity-coalesce(r.quantity_accepted,0),0) as quantity_open,
       p.quantity*p.unit_price_inr as order_value_inr
  from vyndi_purchase_orders p
  join vyndi_suppliers s on s.id=p.supplier_id
  left join (
    select purchase_order_id,sum(quantity_received) quantity_received,sum(quantity_accepted) quantity_accepted
      from vyndi_goods_receipts group by purchase_order_id
  ) r on r.purchase_order_id=p.id;

create or replace view vyndi_accounts_payable as
select i.id,i.purchase_order_id,p.supplier_id,s.name as supplier_name,i.invoice_number,
       i.invoice_on,i.due_on,i.quantity_invoiced,i.amount_ex_gst_inr,i.gst_inr,
       (i.amount_ex_gst_inr+i.gst_inr) as invoice_total_inr,
       coalesce(pay.amount_paid_inr,0) as amount_paid_inr,
       greatest(i.amount_ex_gst_inr+i.gst_inr-coalesce(pay.amount_paid_inr,0),0) as amount_open_inr,
       i.status,i.match_message,i.source_reference
  from vyndi_supplier_invoices i
  join vyndi_purchase_orders p on p.id=i.purchase_order_id
  join vyndi_suppliers s on s.id=p.supplier_id
  left join (
    select supplier_invoice_id,sum(amount_inr) amount_paid_inr
      from vyndi_supplier_payments group by supplier_invoice_id
  ) pay on pay.supplier_invoice_id=i.id;

-- Runtime MRP must consume only authorised, issued purchase commitments.
create or replace view vyndi_open_purchase_orders as
select 'base'::text as scenario,requirement_month,sku,vyndi_canonical_unit(unit) as unit,
       sum(greatest(quantity-quantity_accepted,0)) as open_po_quantity
  from vyndi_purchase_order_status
 where status in ('approved','issued','part_received')
 group by requirement_month,sku,vyndi_canonical_unit(unit);

create or replace function upsert_vyndi_supplier(
  p_id text,p_name text,p_currency text,p_payment_terms_days integer,p_lead_time_days integer,
  p_approval_status text,p_quality_rating numeric,p_delivery_rating numeric,p_source_reference text,
  p_actor_user_id text,p_actor_role text,p_audit_id text
) returns text language plpgsql as $$
begin
  insert into vyndi_suppliers
    (id,name,currency,payment_terms_days,lead_time_days,approval_status,quality_rating,delivery_rating,
     source_reference,created_by,updated_by)
  values
    (upper(trim(p_id)),p_name,upper(trim(p_currency)),p_payment_terms_days,p_lead_time_days,p_approval_status,
     p_quality_rating,p_delivery_rating,p_source_reference,p_actor_user_id,p_actor_user_id)
  on conflict (id) do update set name=excluded.name,currency=excluded.currency,
    payment_terms_days=excluded.payment_terms_days,lead_time_days=excluded.lead_time_days,
    approval_status=excluded.approval_status,quality_rating=excluded.quality_rating,
    delivery_rating=excluded.delivery_rating,source_reference=excluded.source_reference,
    active=true,updated_by=excluded.updated_by,updated_at=now();
  insert into vyndi_audit_events
    (id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    (p_audit_id,'supplier',upper(trim(p_id)),'upserted',p_actor_user_id,p_actor_role,p_source_reference,
     jsonb_build_object('name',p_name,'currency',upper(trim(p_currency)),'approvalStatus',p_approval_status,
       'paymentTermsDays',p_payment_terms_days,'leadTimeDays',p_lead_time_days));
  return upper(trim(p_id));
end; $$;

create or replace function create_vyndi_purchase_order(
  p_id text,p_supplier_id text,p_source_action_id text,p_requirement_month integer,
  p_sku text,p_unit text,p_quantity numeric,p_unit_price_inr numeric,p_order_date date,
  p_expected_receipt_on date,p_payment_terms_days integer,p_source_reference text,p_notes text,
  p_actor_user_id text,p_actor_role text
) returns text language plpgsql as $$
begin
  if trim(coalesce(p_source_reference,''))='' then raise exception 'Purchase-order evidence reference is required.'; end if;
  if not exists(select 1 from vyndi_suppliers where id=p_supplier_id and active=true and approval_status='approved') then
    raise exception 'Purchase order requires an active approved supplier.';
  end if;
  if not exists(select 1 from master_inventory_items where sku=upper(trim(p_sku)) and active=true) then
    raise exception 'Purchase order SKU is not in controlled Master Inventory.';
  end if;
  if trim(coalesce(p_source_action_id,''))<>'' and not exists(
    select 1 from epr_procurement_sku_actions
     where id=p_source_action_id and scenario='base' and sku=upper(trim(p_sku))
       and vyndi_canonical_unit(unit)=vyndi_canonical_unit(p_unit)
       and requirement_month=p_requirement_month and status<>'cancelled'
  ) then
    raise exception 'Purchase-order lineage does not match the selected governed material action.';
  end if;
  insert into vyndi_purchase_orders
    (id,supplier_id,source_action_id,requirement_month,sku,unit,quantity,unit_price_inr,order_date,
     expected_receipt_on,payment_terms_days,status,source_reference,notes,created_by,updated_by)
  values
    (p_id,p_supplier_id,nullif(trim(coalesce(p_source_action_id,'')),''),p_requirement_month,upper(trim(p_sku)),
     vyndi_canonical_unit(p_unit),p_quantity,p_unit_price_inr,p_order_date,p_expected_receipt_on,
     p_payment_terms_days,'pending_approval',p_source_reference,coalesce(p_notes,''),p_actor_user_id,p_actor_user_id);
  insert into vyndi_audit_events
    (id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    ('AUD-'||p_id,'purchase_order',p_id,'submitted_for_approval',p_actor_user_id,p_actor_role,p_source_reference,
     jsonb_build_object('supplierId',p_supplier_id,'sku',upper(trim(p_sku)),'quantity',p_quantity,'unitPriceInr',p_unit_price_inr));
  return p_id;
end; $$;

create or replace function transition_vyndi_purchase_order(
  p_id text,p_next_status text,p_source_reference text,p_actor_user_id text,p_actor_role text
) returns text language plpgsql as $$
declare v_current text;
begin
  select status into v_current from vyndi_purchase_orders where id=p_id for update;
  if v_current is null then raise exception 'Purchase order not found.'; end if;
  if not ((v_current='pending_approval' and p_next_status in ('approved','cancelled')) or
          (v_current='approved' and p_next_status in ('issued','cancelled')) or
          (v_current in ('issued','part_received') and p_next_status='cancelled')) then
    raise exception 'Purchase order transition % -> % is not allowed.',v_current,p_next_status;
  end if;
  if p_next_status='approved' and exists(select 1 from vyndi_purchase_orders where id=p_id and created_by=p_actor_user_id) then
    raise exception 'Purchase-order approval requires a different authorised user.';
  end if;
  update vyndi_purchase_orders set status=p_next_status,
    approved_by=case when p_next_status='approved' then p_actor_user_id else approved_by end,
    approved_at=case when p_next_status='approved' then now() else approved_at end,
    issued_by=case when p_next_status='issued' then p_actor_user_id else issued_by end,
    issued_at=case when p_next_status='issued' then now() else issued_at end,
    updated_by=p_actor_user_id,updated_at=now() where id=p_id;
  insert into vyndi_audit_events
    (id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    ('AUD-'||p_id||'-'||p_next_status,'purchase_order',p_id,p_next_status,p_actor_user_id,p_actor_role,p_source_reference,
     jsonb_build_object('from',v_current,'to',p_next_status));
  return p_id;
end; $$;

create or replace function post_vyndi_goods_receipt(
  p_id text,p_purchase_order_id text,p_received_on date,p_quantity_received numeric,
  p_quantity_accepted numeric,p_quantity_rejected numeric,p_inspection_status text,
  p_source_reference text,p_notes text,p_actor_user_id text,p_actor_role text
) returns text language plpgsql as $$
declare p record; v_prior numeric; v_quarantined numeric; v_movement text; v_ledger text; v_total_accepted numeric;
begin
  select * into p from vyndi_purchase_orders where id=p_purchase_order_id for update;
  if p.id is null then raise exception 'Purchase order not found.'; end if;
  if p.status not in ('issued','part_received') then raise exception 'Goods receipt requires an issued purchase order.'; end if;
  select coalesce(sum(quantity_accepted),0) into v_prior from vyndi_goods_receipts where purchase_order_id=p.id;
  if v_prior+p_quantity_accepted>p.quantity then raise exception 'Accepted receipt exceeds open purchase-order quantity.'; end if;
  v_quarantined:=case when p_inspection_status='quarantine' then p_quantity_received else 0 end;
  if p_quantity_received<>p_quantity_accepted+v_quarantined+p_quantity_rejected then raise exception 'Accepted, quarantined and rejected quantities must equal received quantity.'; end if;
  if p_inspection_status='accepted' and p_quantity_accepted<=0 then raise exception 'Accepted receipt requires accepted quantity.'; end if;
  if p_inspection_status='quarantine' and (p_quantity_accepted<>0 or p_quantity_rejected<>0) then raise exception 'Quarantine receipt must keep the full quantity outside stock.'; end if;
  if p_inspection_status='rejected' and (p_quantity_accepted<>0 or p_quantity_rejected<>p_quantity_received) then raise exception 'Rejected receipt must reject the full quantity.'; end if;
  v_movement:=case when p_quantity_accepted>0 then 'REC-'||p_id else null end;
  v_ledger:=case when p_quantity_accepted>0 then 'LED-'||p_id else null end;
  if p_quantity_accepted>0 then
    perform post_vyndi_inventory_receipt(v_movement,v_ledger,p.sku,p_quantity_accepted,p.unit,p.unit_price_inr,
      p_received_on,p_source_reference,'PO '||p.id||' · GRN '||p_id||' · '||coalesce(p_notes,''),p_actor_user_id,p_actor_role);
  end if;
  insert into vyndi_goods_receipts
    (id,purchase_order_id,received_on,quantity_received,quantity_accepted,quantity_quarantined,quantity_rejected,inspection_status,
     source_reference,notes,inventory_movement_id,created_by)
  values
    (p_id,p.id,p_received_on,p_quantity_received,p_quantity_accepted,v_quarantined,p_quantity_rejected,p_inspection_status,
     p_source_reference,coalesce(p_notes,''),v_movement,p_actor_user_id);
  select coalesce(sum(quantity_accepted),0) into v_total_accepted from vyndi_goods_receipts where purchase_order_id=p.id;
  update vyndi_purchase_orders set status=case when v_total_accepted>=quantity then 'received' else 'part_received' end,
    updated_by=p_actor_user_id,updated_at=now() where id=p.id;
  insert into vyndi_audit_events
    (id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    ('AUD-'||p_id,'goods_receipt',p_id,case when p_quantity_accepted>0 then 'accepted_and_posted' else p_inspection_status end,
     p_actor_user_id,p_actor_role,p_source_reference,jsonb_build_object('purchaseOrderId',p.id,'received',p_quantity_received,'accepted',p_quantity_accepted,'quarantined',v_quarantined,'rejected',p_quantity_rejected,'inventoryMovementId',v_movement));
  return p_id;
end; $$;

create or replace function resolve_vyndi_goods_receipt(
  p_id text,p_resolution text,p_resolved_on date,p_source_reference text,p_actor_user_id text,p_actor_role text
) returns text language plpgsql as $$
declare r record; p record; v_movement text; v_ledger text; v_total_accepted numeric;
begin
  select * into r from vyndi_goods_receipts where id=p_id for update;
  if r.id is null then raise exception 'Goods receipt not found.'; end if;
  if r.inspection_status<>'quarantine' then raise exception 'Only a quarantined receipt may be resolved.'; end if;
  if p_resolution not in ('accepted','rejected') then raise exception 'Quarantine resolution must be accepted or rejected.'; end if;
  if trim(coalesce(p_source_reference,''))='' then raise exception 'Quarantine disposition evidence is required.'; end if;
  select * into p from vyndi_purchase_orders where id=r.purchase_order_id for update;
  v_movement:=case when p_resolution='accepted' then 'REC-RESOLVE-'||p_id else null end;
  v_ledger:=case when p_resolution='accepted' then 'LED-RESOLVE-'||p_id else null end;
  if p_resolution='accepted' then
    perform post_vyndi_inventory_receipt(v_movement,v_ledger,p.sku,r.quantity_quarantined,p.unit,p.unit_price_inr,
      p_resolved_on,p_source_reference,'Quarantine disposition · GRN '||p_id,p_actor_user_id,p_actor_role);
  end if;
  update vyndi_goods_receipts set
    quantity_accepted=case when p_resolution='accepted' then quantity_quarantined else 0 end,
    quantity_rejected=case when p_resolution='rejected' then quantity_quarantined else 0 end,
    quantity_quarantined=0,inspection_status=p_resolution,inventory_movement_id=v_movement,
    resolution_reference=p_source_reference,resolved_by=p_actor_user_id,resolved_at=now()
   where id=p_id;
  select coalesce(sum(quantity_accepted),0) into v_total_accepted from vyndi_goods_receipts where purchase_order_id=p.id;
  update vyndi_purchase_orders set status=case when v_total_accepted>=quantity then 'received' else 'part_received' end,
    updated_by=p_actor_user_id,updated_at=now() where id=p.id;
  insert into vyndi_audit_events
    (id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    ('AUD-'||p_id||'-resolved','goods_receipt',p_id,'quarantine_'||p_resolution,p_actor_user_id,p_actor_role,
     p_source_reference,jsonb_build_object('purchaseOrderId',p.id,'quantity',r.quantity_quarantined,'inventoryMovementId',v_movement));
  return p_id;
end; $$;

create or replace function post_vyndi_supplier_invoice(
  p_id text,p_purchase_order_id text,p_invoice_number text,p_invoice_on date,p_quantity_invoiced numeric,
  p_amount_ex_gst_inr numeric,p_gst_inr numeric,p_source_reference text,p_actor_user_id text,p_actor_role text
) returns table(invoice_id text,match_status text,match_message text) language plpgsql as $$
declare p record; v_accepted numeric; v_already_invoiced numeric; v_expected numeric; v_status text; v_message text; v_due date;
begin
  select * into p from vyndi_purchase_orders where id=p_purchase_order_id for update;
  if p.id is null then raise exception 'Purchase order not found.'; end if;
  select coalesce(sum(quantity_accepted),0) into v_accepted from vyndi_goods_receipts where purchase_order_id=p.id;
  select coalesce(sum(quantity_invoiced),0) into v_already_invoiced from vyndi_supplier_invoices
   where purchase_order_id=p.id and status<>'void';
  v_expected:=round(p_quantity_invoiced*p.unit_price_inr,2);
  if v_already_invoiced+p_quantity_invoiced>v_accepted then v_status:='blocked';v_message:='Cumulative invoice quantity exceeds accepted GRN quantity.';
  elsif abs(p_amount_ex_gst_inr-v_expected)>0.01 then v_status:='blocked';v_message:='Invoice value does not match PO quantity × controlled unit price.';
  else v_status:='matched';v_message:='Three-way match passed: PO, accepted GRN and invoice agree.'; end if;
  v_due:=p_invoice_on+p.payment_terms_days;
  insert into vyndi_supplier_invoices
    (id,purchase_order_id,invoice_number,invoice_on,due_on,quantity_invoiced,amount_ex_gst_inr,gst_inr,status,
     match_message,source_reference,created_by)
  values
    (p_id,p.id,p_invoice_number,p_invoice_on,v_due,p_quantity_invoiced,p_amount_ex_gst_inr,p_gst_inr,v_status,
     v_message,p_source_reference,p_actor_user_id);
  insert into vyndi_audit_events
    (id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    ('AUD-'||p_id,'supplier_invoice',p_id,v_status,p_actor_user_id,p_actor_role,p_source_reference,
     jsonb_build_object('purchaseOrderId',p.id,'quantity',p_quantity_invoiced,'amountExGstInr',p_amount_ex_gst_inr,'message',v_message));
  return query select p_id,v_status,v_message;
end; $$;

create or replace function approve_vyndi_supplier_invoice(
  p_id text,p_actor_user_id text,p_actor_role text
) returns text language plpgsql as $$
begin
  if exists(select 1 from vyndi_supplier_invoices where id=p_id and created_by=p_actor_user_id) then
    raise exception 'Supplier-invoice approval requires a different authorised user.';
  end if;
  update vyndi_supplier_invoices set status='approved',approved_by=p_actor_user_id,approved_at=now(),updated_at=now()
   where id=p_id and status='matched';
  if not found then raise exception 'Only a three-way-matched invoice may be approved.'; end if;
  insert into vyndi_audit_events(id,entity_type,entity_id,action,actor_user_id,actor_role,payload_json)
  values('AUD-'||p_id||'-approved','supplier_invoice',p_id,'approved',p_actor_user_id,p_actor_role,'{}'::jsonb);
  return p_id;
end; $$;

create or replace function post_vyndi_supplier_payment(
  p_id text,p_supplier_invoice_id text,p_paid_on date,p_amount_inr numeric,p_source_reference text,
  p_actor_user_id text,p_actor_role text
) returns text language plpgsql as $$
declare i record; v_paid numeric; v_open numeric;
begin
  select * into i from vyndi_supplier_invoices where id=p_supplier_invoice_id for update;
  if i.id is null then raise exception 'Supplier invoice not found.'; end if;
  if i.status not in ('approved','part_paid') then raise exception 'Payment requires an approved supplier invoice.'; end if;
  select coalesce(sum(amount_inr),0) into v_paid from vyndi_supplier_payments where supplier_invoice_id=i.id;
  v_open:=i.amount_ex_gst_inr+i.gst_inr-v_paid;
  if p_amount_inr>v_open then raise exception 'Payment exceeds open supplier invoice amount.'; end if;
  insert into vyndi_supplier_payments(id,supplier_invoice_id,paid_on,amount_inr,source_reference,created_by)
  values(p_id,i.id,p_paid_on,p_amount_inr,p_source_reference,p_actor_user_id);
  update vyndi_supplier_invoices set status=case when p_amount_inr>=v_open then 'paid' else 'part_paid' end,updated_at=now() where id=i.id;
  insert into vyndi_audit_events(id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
  values('AUD-'||p_id,'supplier_payment',p_id,'posted',p_actor_user_id,p_actor_role,p_source_reference,
    jsonb_build_object('supplierInvoiceId',i.id,'amountInr',p_amount_inr));
  return p_id;
end; $$;

comment on table vyndi_purchase_orders is 'Canonical authorised purchase commitments. IBPE and planning actions may recommend but never write this table directly.';
comment on table vyndi_goods_receipts is 'Controlled GRN and incoming-inspection evidence; accepted quantity posts canonical FIFO inventory.';
comment on view vyndi_accounts_payable is 'Supplier invoice and payment truth derived from three-way-matched procure-to-pay transactions.';
