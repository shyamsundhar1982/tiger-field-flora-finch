-- Governed Procurement Cost Authority.
-- Catalogue / legacy reference prices are explicitly excluded from IBPE valuation.
-- Authority order: positive FIFO actual -> approved PO/supplier price -> approved planning price -> missing-cost exception.

create table if not exists vyndi_procurement_prices (
  id text primary key,
  sku text not null check (sku = upper(sku)),
  supplier_id text references vyndi_suppliers(id) on delete restrict,
  price_type text not null check (price_type in ('supplier','planning')),
  unit text not null default 'ea',
  unit_price_inr numeric(14,2) not null check (unit_price_inr > 0),
  currency text not null default 'INR' check (currency = upper(currency)),
  effective_from date not null default current_date,
  effective_to date,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  source_reference text not null,
  notes text not null default '',
  created_by text not null,
  created_at timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  check ((price_type='supplier' and supplier_id is not null) or (price_type='planning' and supplier_id is null))
);

create index if not exists vyndi_procurement_prices_sku_status_idx
  on vyndi_procurement_prices(sku,status,price_type,effective_from desc,updated_at desc);

comment on table vyndi_procurement_prices is
  'Governed supplier and planning procurement prices. Draft/reference values never feed IBPE until explicitly approved.';
comment on column vyndi_procurement_prices.price_type is
  'supplier = approved supplier quotation/price agreement; planning = approved non-supplier planning procurement price.';

create or replace function upsert_vyndi_procurement_price_draft(
  p_id text,p_sku text,p_supplier_id text,p_price_type text,p_unit text,p_unit_price_inr numeric,
  p_currency text,p_effective_from date,p_effective_to date,p_source_reference text,p_notes text,
  p_actor_user_id text,p_actor_role text
) returns text language plpgsql as $$
declare v_sku text:=upper(trim(p_sku)); v_supplier text:=nullif(upper(trim(coalesce(p_supplier_id,''))), '');
begin
  if p_price_type not in ('supplier','planning') then raise exception 'Procurement price type must be supplier or planning.'; end if;
  if p_unit_price_inr is null or p_unit_price_inr<=0 then raise exception 'Procurement price must be positive.'; end if;
  if trim(coalesce(p_source_reference,''))='' then raise exception 'Procurement price evidence/source reference is required.'; end if;
  if not exists(select 1 from master_inventory_items where sku=v_sku and active=true) then
    raise exception 'Procurement price SKU is not an active controlled Master Inventory item.';
  end if;
  if p_price_type='supplier' then
    if v_supplier is null or not exists(select 1 from vyndi_suppliers where id=v_supplier and active=true and approval_status='approved') then
      raise exception 'Supplier procurement price requires an active approved supplier.';
    end if;
  else
    v_supplier:=null;
  end if;

  insert into vyndi_procurement_prices
    (id,sku,supplier_id,price_type,unit,unit_price_inr,currency,effective_from,effective_to,status,
     source_reference,notes,created_by,updated_by)
  values
    (p_id,v_sku,v_supplier,p_price_type,vyndi_canonical_unit(p_unit),p_unit_price_inr,upper(trim(coalesce(p_currency,'INR'))),
     p_effective_from,p_effective_to,'draft',p_source_reference,coalesce(p_notes,''),p_actor_user_id,p_actor_user_id)
  on conflict (id) do update set
    sku=excluded.sku,supplier_id=excluded.supplier_id,price_type=excluded.price_type,unit=excluded.unit,
    unit_price_inr=excluded.unit_price_inr,currency=excluded.currency,effective_from=excluded.effective_from,
    effective_to=excluded.effective_to,status='draft',source_reference=excluded.source_reference,notes=excluded.notes,
    approved_by=null,approved_at=null,updated_by=excluded.updated_by,updated_at=now();

  insert into vyndi_audit_events
    (id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    ('AUD-'||p_id||'-DRAFT-'||md5(random()::text||clock_timestamp()::text),'procurement_price',p_id,'drafted',
     p_actor_user_id,p_actor_role,p_source_reference,
     jsonb_build_object('sku',v_sku,'supplierId',v_supplier,'priceType',p_price_type,'unitPriceInr',p_unit_price_inr,
       'currency',upper(trim(coalesce(p_currency,'INR'))),'effectiveFrom',p_effective_from,'effectiveTo',p_effective_to));
  return p_id;
end; $$;

create or replace function approve_vyndi_procurement_price(
  p_id text,p_source_reference text,p_actor_user_id text,p_actor_role text
) returns text language plpgsql as $$
declare v_price vyndi_procurement_prices%rowtype;
begin
  select * into v_price from vyndi_procurement_prices where id=p_id for update;
  if v_price.id is null then raise exception 'Procurement price not found.'; end if;
  if v_price.status<>'draft' then raise exception 'Only a draft procurement price can be approved.'; end if;
  if v_price.created_by=p_actor_user_id then raise exception 'Procurement-price approval requires a different authorised user.'; end if;
  if trim(coalesce(p_source_reference,''))='' then raise exception 'Procurement-price approval evidence is required.'; end if;

  update vyndi_procurement_prices
     set status='retired',effective_to=greatest(effective_from,current_date-1),updated_by=p_actor_user_id,updated_at=now()
   where id<>p_id and sku=v_price.sku and price_type=v_price.price_type
     and coalesce(supplier_id,'')=coalesce(v_price.supplier_id,'') and status='approved' and effective_to is null;

  update vyndi_procurement_prices
     set status='approved',approved_by=p_actor_user_id,approved_at=now(),updated_by=p_actor_user_id,updated_at=now()
   where id=p_id;

  insert into vyndi_audit_events
    (id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    ('AUD-'||p_id||'-APPROVE-'||md5(random()::text||clock_timestamp()::text),'procurement_price',p_id,'approved',
     p_actor_user_id,p_actor_role,p_source_reference,
     jsonb_build_object('sku',v_price.sku,'supplierId',v_price.supplier_id,'priceType',v_price.price_type,
       'unitPriceInr',v_price.unit_price_inr,'currency',v_price.currency));
  return p_id;
end; $$;

create or replace function retire_vyndi_procurement_price(
  p_id text,p_source_reference text,p_actor_user_id text,p_actor_role text
) returns text language plpgsql as $$
begin
  if trim(coalesce(p_source_reference,''))='' then raise exception 'Procurement-price retirement evidence is required.'; end if;
  if not exists(select 1 from vyndi_procurement_prices where id=p_id) then raise exception 'Procurement price not found.'; end if;
  update vyndi_procurement_prices
     set status='retired',effective_to=coalesce(effective_to,current_date),updated_by=p_actor_user_id,updated_at=now()
   where id=p_id;
  insert into vyndi_audit_events
    (id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    ('AUD-'||p_id||'-RETIRE-'||md5(random()::text||clock_timestamp()::text),'procurement_price',p_id,'retired',
     p_actor_user_id,p_actor_role,p_source_reference,'{}'::jsonb);
  return p_id;
end; $$;

create or replace view vyndi_procurement_cost_authority as
with planning_bom as (
  select distinct m.sku
    from epr_bom_inventory_mappings m
   where m.model_id in ('core','pro','apex')
     and m.status='active' and m.configuration_option_id is null
     and m.approved_by is not null and m.approved_at is not null
     and m.effective_from<=now() and (m.effective_to is null or m.effective_to>now())
)
select i.sku,
       vyndi_canonical_unit(i.unit) as unit,
       (b.sku is not null) as active_planning_bom,
       fifo.unit_cost_inr as fifo_actual_cost_inr,
       po.unit_price_inr as approved_purchase_price_inr,
       po.purchase_order_id as approved_purchase_price_ref,
       supplier.unit_price_inr as approved_supplier_price_inr,
       supplier.price_id as approved_supplier_price_ref,
       planning.unit_price_inr as approved_planning_price_inr,
       planning.price_id as approved_planning_price_ref,
       legacy.unit_price_inr as legacy_reference_price_inr,
       coalesce(fifo.unit_cost_inr,po.unit_price_inr,supplier.unit_price_inr,planning.unit_price_inr) as governed_cost_inr,
       case
         when fifo.unit_cost_inr is not null then 'EPR-FIFO-ACTUAL'
         when po.unit_price_inr is not null then 'APPROVED-PURCHASE-ORDER'
         when supplier.unit_price_inr is not null then 'APPROVED-SUPPLIER-PRICE'
         when planning.unit_price_inr is not null then 'APPROVED-PLANNING-PROCUREMENT-PRICE'
         else 'MISSING'
       end as cost_authority
  from master_inventory_items i
  left join planning_bom b on b.sku=i.sku
  left join lateral (
    select sum(f.quantity_remaining*f.unit_cost_inr)/nullif(sum(f.quantity_remaining),0) as unit_cost_inr
      from epr_inventory_fifo_layers f
     where f.sku=i.sku and f.quantity_remaining>0 and f.unit_cost_inr>0
  ) fifo on true
  left join lateral (
    select p.unit_price_inr,p.id as purchase_order_id
      from vyndi_purchase_orders p
      join vyndi_suppliers s on s.id=p.supplier_id and s.active=true and s.approval_status='approved'
     where p.sku=i.sku and p.unit_price_inr>0
       and p.status in ('approved','issued','part_received','received')
     order by coalesce(p.issued_at,p.approved_at,p.updated_at) desc,p.id desc
     limit 1
  ) po on true
  left join lateral (
    select p.unit_price_inr,p.id as price_id
      from vyndi_procurement_prices p
      join vyndi_suppliers s on s.id=p.supplier_id and s.active=true and s.approval_status='approved'
     where p.sku=i.sku and p.price_type='supplier' and p.status='approved'
       and p.unit_price_inr>0 and p.effective_from<=current_date
       and (p.effective_to is null or p.effective_to>=current_date)
     order by p.effective_from desc,p.approved_at desc nulls last,p.updated_at desc
     limit 1
  ) supplier on true
  left join lateral (
    select p.unit_price_inr,p.id as price_id
      from vyndi_procurement_prices p
     where p.sku=i.sku and p.price_type='planning' and p.status='approved'
       and p.unit_price_inr>0 and p.effective_from<=current_date
       and (p.effective_to is null or p.effective_to>=current_date)
     order by p.effective_from desc,p.approved_at desc nulls last,p.updated_at desc
     limit 1
  ) planning on true
  left join lateral (
    select nullif((m.attributes->>'legacyPriceInr')::numeric,0) as unit_price_inr
      from master_data_records m
     where m.domain='inventory' and m.status='approved' and m.code=i.sku
     order by m.revision desc limit 1
  ) legacy on true
 where i.active=true;

comment on view vyndi_procurement_cost_authority is
  'IBPE procurement valuation authority. legacy_reference_price_inr is visible for reconciliation only and is never selected as governed_cost_inr.';
