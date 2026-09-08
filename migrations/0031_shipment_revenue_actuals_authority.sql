-- VYNDI Stage 2 transaction authority: KD-02 + KD-03.
-- Canonical chain: confirmed order -> completed production -> shipment -> invoice
-- -> receivable -> collection. Revenue/units/receivables are derived from these
-- controlled transactions, not entered as independent accounting truth.

create table if not exists vyndi_shipments (
  id text primary key,
  sales_order_id text not null references vyndi_sales_orders(id) on delete restrict,
  plan_month integer not null check (plan_month between 1 and 36),
  units numeric(14,4) not null check (units > 0),
  status text not null default 'posted' check (status in ('posted','reversed')),
  source_reference text not null,
  revision integer not null default 1 check (revision > 0),
  posted_by text not null,
  posted_at timestamptz not null default now(),
  reversed_by text,
  reversed_at timestamptz,
  reversal_reason text
);
create index if not exists vyndi_shipments_order_idx on vyndi_shipments(sales_order_id,status,plan_month);

create table if not exists vyndi_invoices (
  id text primary key,
  shipment_id text not null unique references vyndi_shipments(id) on delete restrict,
  sales_order_id text not null references vyndi_sales_orders(id) on delete restrict,
  plan_month integer not null check (plan_month between 1 and 36),
  units numeric(14,4) not null check (units > 0),
  asp_lakh numeric(14,4) not null check (asp_lakh >= 0),
  amount_lakh numeric(18,4) not null check (amount_lakh >= 0),
  status text not null default 'issued' check (status in ('issued','void')),
  source_reference text not null,
  revision integer not null default 1 check (revision > 0),
  issued_by text not null,
  issued_at timestamptz not null default now(),
  voided_by text,
  voided_at timestamptz,
  void_reason text
);
create index if not exists vyndi_invoices_month_idx on vyndi_invoices(plan_month,status);

create table if not exists vyndi_collections (
  id text primary key,
  invoice_id text not null references vyndi_invoices(id) on delete restrict,
  plan_month integer not null check (plan_month between 1 and 36),
  amount_lakh numeric(18,4) not null check (amount_lakh > 0),
  status text not null default 'posted' check (status in ('posted','reversed')),
  source_reference text not null,
  revision integer not null default 1 check (revision > 0),
  posted_by text not null,
  posted_at timestamptz not null default now(),
  reversed_by text,
  reversed_at timestamptz,
  reversal_reason text
);
create index if not exists vyndi_collections_invoice_idx on vyndi_collections(invoice_id,status,plan_month);

create or replace function post_vyndi_shipment(
  p_id text,p_sales_order_id text,p_plan_month integer,p_units numeric,p_source_reference text,
  p_actor_user_id text,p_actor_role text
) returns text
language plpgsql
as $$
declare v_order_status text; v_order_units numeric; v_job_status text; v_shipped numeric; v_snapshot jsonb;
begin
  if trim(coalesce(p_source_reference,''))='' then raise exception 'Shipment source reference is required.'; end if;
  perform pg_advisory_xact_lock(hashtext('shipment|' || p_id)::bigint);
  if exists(select 1 from vyndi_shipments where id=p_id) then
    if exists(select 1 from vyndi_shipments where id=p_id and sales_order_id=p_sales_order_id and plan_month=p_plan_month and units=p_units and status='posted') then return p_id; end if;
    raise exception 'Shipment id already exists with different state.';
  end if;
  select o.status,o.units,c.status into v_order_status,v_order_units,v_job_status
    from vyndi_sales_orders o left join epr_production_job_cards c on c.sales_order_id=o.id
   where o.id=p_sales_order_id limit 1;
  if not found then raise exception 'Sales order not found.'; end if;
  if v_order_status not in ('confirmed','delivered') then raise exception 'Shipment requires a confirmed sales order.'; end if;
  if v_job_status is distinct from 'complete' then raise exception 'Shipment requires the linked production job card to be complete.'; end if;
  select coalesce(sum(units),0) into v_shipped from vyndi_shipments where sales_order_id=p_sales_order_id and status='posted';
  if p_units<=0 or v_shipped+p_units>v_order_units then raise exception 'Shipment quantity exceeds remaining confirmed order quantity.'; end if;
  insert into vyndi_shipments(id,sales_order_id,plan_month,units,source_reference,posted_by)
  values(p_id,p_sales_order_id,p_plan_month,p_units,p_source_reference,p_actor_user_id);
  v_snapshot:=jsonb_build_object('shipmentId',p_id,'salesOrderId',p_sales_order_id,'planMonth',p_plan_month,'units',p_units,'sourceReference',p_source_reference);
  insert into vyndi_audit_events(id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
  values('AUD-SHIP-'||p_id||'-R1','shipment',p_id,1,'posted',p_actor_user_id,p_actor_role,p_source_reference,v_snapshot);
  return p_id;
end;
$$;

create or replace function reverse_vyndi_shipment(
  p_id text,p_reason text,p_actor_user_id text,p_actor_role text
) returns integer
language plpgsql
as $$
declare v_revision integer;
begin
  if trim(coalesce(p_reason,''))='' then raise exception 'Shipment reversal reason is required.'; end if;
  perform pg_advisory_xact_lock(hashtext('shipment|' || p_id)::bigint);
  if exists(select 1 from vyndi_invoices where shipment_id=p_id and status='issued') then raise exception 'Void the linked invoice before reversing shipment.'; end if;
  update vyndi_shipments set status='reversed',revision=revision+1,reversed_by=p_actor_user_id,reversed_at=now(),reversal_reason=p_reason
   where id=p_id and status='posted' returning revision into v_revision;
  if not found then
    select revision into v_revision from vyndi_shipments where id=p_id and status='reversed';
    if not found then raise exception 'Posted shipment not found.'; end if;
    return v_revision;
  end if;
  insert into vyndi_audit_events(id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,payload_json)
  values('AUD-SHIP-'||p_id||'-R'||v_revision,'shipment',p_id,v_revision,'reversed',p_actor_user_id,p_actor_role,jsonb_build_object('reason',p_reason));
  return v_revision;
end;
$$;

create or replace function issue_vyndi_invoice(
  p_id text,p_shipment_id text,p_source_reference text,p_actor_user_id text,p_actor_role text
) returns table(invoice_id text, amount_lakh numeric)
language plpgsql
as $$
declare v_order text; v_month integer; v_units numeric; v_asp numeric; v_amount numeric; v_snapshot jsonb;
begin
  if trim(coalesce(p_source_reference,''))='' then raise exception 'Invoice source reference is required.'; end if;
  perform pg_advisory_xact_lock(hashtext('invoice|' || p_id)::bigint);
  if exists(select 1 from vyndi_invoices where id=p_id) then
    return query select i.id,i.amount_lakh from vyndi_invoices i where i.id=p_id and i.shipment_id=p_shipment_id and i.status='issued';
    if found then return; end if;
    raise exception 'Invoice id already exists with different state.';
  end if;
  select s.sales_order_id,s.plan_month,s.units,o.asp_lakh into v_order,v_month,v_units,v_asp
    from vyndi_shipments s join vyndi_sales_orders o on o.id=s.sales_order_id
   where s.id=p_shipment_id and s.status='posted';
  if not found then raise exception 'Posted shipment not found.'; end if;
  if exists(select 1 from vyndi_invoices where shipment_id=p_shipment_id) then raise exception 'Shipment already has an invoice record.'; end if;
  v_amount:=round(v_units*v_asp,4);
  insert into vyndi_invoices(id,shipment_id,sales_order_id,plan_month,units,asp_lakh,amount_lakh,source_reference,issued_by)
  values(p_id,p_shipment_id,v_order,v_month,v_units,v_asp,v_amount,p_source_reference,p_actor_user_id);
  v_snapshot:=jsonb_build_object('invoiceId',p_id,'shipmentId',p_shipment_id,'salesOrderId',v_order,'planMonth',v_month,'units',v_units,'aspLakh',v_asp,'amountLakh',v_amount);
  insert into vyndi_audit_events(id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
  values('AUD-INV-'||p_id||'-R1','invoice',p_id,1,'issued',p_actor_user_id,p_actor_role,p_source_reference,v_snapshot);
  return query select p_id,v_amount;
end;
$$;

create or replace function void_vyndi_invoice(
  p_id text,p_reason text,p_actor_user_id text,p_actor_role text
) returns integer
language plpgsql
as $$
declare v_revision integer;
begin
  if trim(coalesce(p_reason,''))='' then raise exception 'Invoice void reason is required.'; end if;
  perform pg_advisory_xact_lock(hashtext('invoice|' || p_id)::bigint);
  if exists(select 1 from vyndi_collections where invoice_id=p_id and status='posted') then raise exception 'Reverse posted collections before voiding invoice.'; end if;
  update vyndi_invoices set status='void',revision=revision+1,voided_by=p_actor_user_id,voided_at=now(),void_reason=p_reason
   where id=p_id and status='issued' returning revision into v_revision;
  if not found then
    select revision into v_revision from vyndi_invoices where id=p_id and status='void';
    if not found then raise exception 'Issued invoice not found.'; end if;
    return v_revision;
  end if;
  insert into vyndi_audit_events(id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,payload_json)
  values('AUD-INV-'||p_id||'-R'||v_revision,'invoice',p_id,v_revision,'voided',p_actor_user_id,p_actor_role,jsonb_build_object('reason',p_reason));
  return v_revision;
end;
$$;

create or replace function post_vyndi_collection(
  p_id text,p_invoice_id text,p_plan_month integer,p_amount_lakh numeric,p_source_reference text,
  p_actor_user_id text,p_actor_role text
) returns text
language plpgsql
as $$
declare v_invoice_amount numeric; v_collected numeric; v_snapshot jsonb;
begin
  if trim(coalesce(p_source_reference,''))='' then raise exception 'Collection source reference is required.'; end if;
  perform pg_advisory_xact_lock(hashtext('collection|' || p_id)::bigint);
  if exists(select 1 from vyndi_collections where id=p_id) then
    if exists(select 1 from vyndi_collections where id=p_id and invoice_id=p_invoice_id and plan_month=p_plan_month and amount_lakh=p_amount_lakh and status='posted') then return p_id; end if;
    raise exception 'Collection id already exists with different state.';
  end if;
  select amount_lakh into v_invoice_amount from vyndi_invoices where id=p_invoice_id and status='issued';
  if not found then raise exception 'Issued invoice not found.'; end if;
  select coalesce(sum(amount_lakh),0) into v_collected from vyndi_collections where invoice_id=p_invoice_id and status='posted';
  if p_amount_lakh<=0 or v_collected+p_amount_lakh>v_invoice_amount then raise exception 'Collection exceeds open invoice receivable.'; end if;
  insert into vyndi_collections(id,invoice_id,plan_month,amount_lakh,source_reference,posted_by)
  values(p_id,p_invoice_id,p_plan_month,p_amount_lakh,p_source_reference,p_actor_user_id);
  v_snapshot:=jsonb_build_object('collectionId',p_id,'invoiceId',p_invoice_id,'planMonth',p_plan_month,'amountLakh',p_amount_lakh);
  insert into vyndi_audit_events(id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
  values('AUD-COL-'||p_id||'-R1','collection',p_id,1,'posted',p_actor_user_id,p_actor_role,p_source_reference,v_snapshot);
  return p_id;
end;
$$;

create or replace function reverse_vyndi_collection(
  p_id text,p_reason text,p_actor_user_id text,p_actor_role text
) returns integer
language plpgsql
as $$
declare v_revision integer;
begin
  if trim(coalesce(p_reason,''))='' then raise exception 'Collection reversal reason is required.'; end if;
  perform pg_advisory_xact_lock(hashtext('collection|' || p_id)::bigint);
  update vyndi_collections set status='reversed',revision=revision+1,reversed_by=p_actor_user_id,reversed_at=now(),reversal_reason=p_reason
   where id=p_id and status='posted' returning revision into v_revision;
  if not found then
    select revision into v_revision from vyndi_collections where id=p_id and status='reversed';
    if not found then raise exception 'Posted collection not found.'; end if;
    return v_revision;
  end if;
  insert into vyndi_audit_events(id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,payload_json)
  values('AUD-COL-'||p_id||'-R'||v_revision,'collection',p_id,v_revision,'reversed',p_actor_user_id,p_actor_role,jsonb_build_object('reason',p_reason));
  return v_revision;
end;
$$;

-- Monthly controlled transaction truth. Revenue and units are recognized from issued
-- invoices; receivables are the cumulative open invoiced balance at each plan month.
create or replace view vyndi_monthly_transaction_actuals as
with months as (select generate_series(1,36)::integer as plan_month),
invoice_month as (
  select plan_month,sum(amount_lakh)::numeric(18,4) revenue,sum(units)::numeric(14,4) units
    from vyndi_invoices where status='issued' group by plan_month
),
invoice_cume as (
  select m.plan_month,coalesce((select sum(i.amount_lakh) from vyndi_invoices i where i.status='issued' and i.plan_month<=m.plan_month),0)::numeric(18,4) invoiced
    from months m
),
collection_cume as (
  select m.plan_month,coalesce((select sum(c.amount_lakh) from vyndi_collections c where c.status='posted' and c.plan_month<=m.plan_month),0)::numeric(18,4) collected
    from months m
)
select m.plan_month,coalesce(im.revenue,0)::numeric(18,4) revenue,coalesce(im.units,0)::numeric(14,4) units,
       greatest(ic.invoiced-cc.collected,0)::numeric(18,4) receivables
  from months m left join invoice_month im using(plan_month)
  join invoice_cume ic using(plan_month) join collection_cume cc using(plan_month);

comment on view vyndi_monthly_transaction_actuals is
  'Canonical KD-03 transaction-derived revenue, units and receivables. Manual monthly actuals may reconcile to but may not override these fields.';
