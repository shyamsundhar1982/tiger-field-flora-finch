-- 4. One physical inventory ledger underneath all operational stock surfaces.
--    epr_inventory_ledger remains the transaction authority. This shared balance
--    aggregates physical stock across venture accounting labels by SKU/unit.
-- ---------------------------------------------------------------------------
-- Physical stock is a shared company pool. Venture remains on EPR transactions
-- for product traceability, but receipts that are not yet pegged to a traveller
-- are recorded as shared stock. All canonical ATP/FIFO logic is SKU+unit based.
alter table epr_inventory_movements drop constraint if exists epr_inventory_movements_venture_check;
alter table epr_inventory_movements add constraint epr_inventory_movements_venture_check
  check (venture in ('shared','carbon','aluminium'));
alter table epr_inventory_movements drop constraint if exists epr_inventory_movements_movement_type_check;
alter table epr_inventory_movements add constraint epr_inventory_movements_movement_type_check
  check (movement_type in ('receipt','reserve','issue','return','consume','opening_balance','adjust'));

alter table epr_inventory_ledger drop constraint if exists epr_inventory_ledger_venture_check;
alter table epr_inventory_ledger add constraint epr_inventory_ledger_venture_check
  check (venture in ('shared','carbon','aluminium'));

alter table epr_inventory_cost_ledger drop constraint if exists epr_inventory_cost_ledger_venture_check;
alter table epr_inventory_cost_ledger add constraint epr_inventory_cost_ledger_venture_check
  check (venture in ('shared','carbon','aluminium'));

alter table epr_inventory_fifo_layers drop constraint if exists epr_inventory_fifo_layers_venture_check;
alter table epr_inventory_fifo_layers add constraint epr_inventory_fifo_layers_venture_check
  check (venture in ('shared','carbon','aluminium'));

alter table epr_inventory_movements add column if not exists effective_on date not null default current_date;
alter table epr_inventory_ledger add column if not exists effective_on date not null default current_date;

-- Canonicalize legacy quantity-unit aliases without rewriting historical rows.
-- Existing EPR seeds/mappings used `unit`; Master Inventory uses `ea`. Both mean
-- one each and must participate in the same physical balance, reservation and FIFO pool.
create or replace function vyndi_canonical_unit(p_unit text)
returns text
language sql
immutable
strict
as $$
  select case lower(trim(p_unit))
    when 'unit' then 'ea'
    when 'each' then 'ea'
    else lower(trim(p_unit))
  end;
$$;

create table if not exists vyndi_inventory_receipt_metadata (
  movement_id text primary key references epr_inventory_movements(id) on delete restrict,
  master_inventory_item_id text not null references master_inventory_items(id) on delete restrict,
  expiry_on date,
  next_inspection_on date,
  recorded_by text not null,
  created_at timestamptz not null default now()
);

-- Replace the old venture-partitioned FIFO picker. Physical stock is shared, so
-- the oldest layer for a SKU/unit is consumed regardless of accounting venture.
create or replace function allocate_epr_inventory_fifo(
  p_issue_ledger_id text,
  p_venture text,
  p_sku text,
  p_unit text,
  p_quantity numeric
) returns numeric
language plpgsql
as $$
declare
  layer record;
  remaining numeric := p_quantity;
  take_qty numeric;
  total_cost numeric := 0;
begin
  if p_quantity <= 0 then raise exception 'FIFO issue quantity must be greater than zero.'; end if;

  for layer in
    select id,quantity_remaining,unit_cost_inr
      from epr_inventory_fifo_layers
     where sku=upper(trim(p_sku)) and vyndi_canonical_unit(unit)=vyndi_canonical_unit(p_unit) and quantity_remaining>0
     order by received_at asc,id asc
     for update
  loop
    exit when remaining<=0;
    take_qty:=least(remaining,layer.quantity_remaining);
    insert into epr_inventory_fifo_allocations
      (id,issue_ledger_id,layer_id,quantity,unit_cost_inr,extended_cost_inr)
    values
      (p_issue_ledger_id || '-' || layer.id,p_issue_ledger_id,layer.id,take_qty,layer.unit_cost_inr,round(take_qty*layer.unit_cost_inr,2));
    update epr_inventory_fifo_layers set quantity_remaining=quantity_remaining-take_qty where id=layer.id;
    total_cost:=total_cost+(take_qty*layer.unit_cost_inr);
    remaining:=remaining-take_qty;
  end loop;

  if remaining>0 then raise exception 'FIFO allocation failed for %: % units remain unallocated.',p_sku,remaining; end if;
  return round(total_cost,2);
end;
$$;

create or replace function epr_inventory_fifo_ledger_trigger()
returns trigger
language plpgsql
as $$
begin
  if new.quantity_delta > 0 then
    insert into epr_inventory_fifo_layers
      (id,venture,sku,unit,source_ledger_id,received_at,quantity_received,quantity_remaining,unit_cost_inr)
    values
      ('FIFO-' || new.id,new.venture,new.sku,new.unit,new.id,new.effective_on::timestamptz,
       new.quantity_delta,new.quantity_delta,new.unit_cost_inr)
    on conflict (source_ledger_id) do nothing;
  else
    perform allocate_epr_inventory_fifo(new.id,new.venture,new.sku,new.unit,abs(new.quantity_delta));
  end if;
  return new;
end;
$$;

drop trigger if exists epr_inventory_fifo_ledger_trigger on epr_inventory_ledger;
create trigger epr_inventory_fifo_ledger_trigger
after insert on epr_inventory_ledger
for each row execute function epr_inventory_fifo_ledger_trigger();

create or replace function post_vyndi_inventory_receipt(
  p_movement_id text,
  p_ledger_id text,
  p_sku text,
  p_quantity numeric,
  p_unit text,
  p_unit_cost_inr numeric,
  p_received_on date,
  p_reference text,
  p_notes text,
  p_actor_user_id text,
  p_actor_role text
) returns table (movement_id text, ledger_id text, resulting_balance numeric)
language plpgsql
as $$
declare v_balance numeric; v_unit text:=vyndi_canonical_unit(p_unit);
begin
  if p_quantity<=0 then raise exception 'Receipt quantity must be greater than zero.'; end if;
  if p_unit_cost_inr<0 then raise exception 'Unit cost cannot be negative.'; end if;
  if trim(coalesce(p_reference,''))='' then raise exception 'Receipt reference is required.'; end if;
  if not exists (select 1 from master_inventory_items where sku=upper(trim(p_sku)) and active=true) then
    raise exception 'SKU % is not present in the controlled Master Inventory item register.',p_sku;
  end if;

  perform pg_advisory_xact_lock(hashtext(upper(trim(p_sku)) || '|' || v_unit)::bigint);
  select coalesce(sum(quantity_delta),0) into v_balance
    from epr_inventory_ledger where sku=upper(trim(p_sku)) and vyndi_canonical_unit(unit)=v_unit;

  insert into epr_inventory_movements
    (id,traveller_id,venture,sku,movement_type,quantity,unit,reference,notes,recorded_by,effective_on)
  values
    (p_movement_id,null,'shared',upper(trim(p_sku)),'receipt',p_quantity,v_unit,p_reference,coalesce(p_notes,''),p_actor_user_id,p_received_on);

  insert into epr_inventory_ledger
    (id,venture,sku,unit,quantity_delta,movement_id,traveller_id,serial_number,reference,notes,recorded_by,unit_cost_inr,effective_on)
  values
    (p_ledger_id,'shared',upper(trim(p_sku)),v_unit,p_quantity,p_movement_id,null,null,p_reference,coalesce(p_notes,''),p_actor_user_id,p_unit_cost_inr,p_received_on);

  insert into epr_inventory_cost_ledger
    (id,venture,sku,unit,quantity_delta,value_delta_inr,movement_id,traveller_id,unit_cost_inr,reference,recorded_by)
  values
    (p_ledger_id || '-COST','shared',upper(trim(p_sku)),v_unit,p_quantity,p_quantity*p_unit_cost_inr,p_movement_id,null,p_unit_cost_inr,p_reference,p_actor_user_id);

  insert into vyndi_audit_events
    (id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    (p_ledger_id || '-AUD','inventory_movement',p_movement_id,'receipt_posted',p_actor_user_id,p_actor_role,p_reference,
     jsonb_build_object('ledgerId',p_ledger_id,'sku',upper(trim(p_sku)),'unit',v_unit,'quantity',p_quantity,
       'unitCostInr',p_unit_cost_inr,'resultingBalance',v_balance+p_quantity));

  return query select p_movement_id,p_ledger_id,v_balance+p_quantity;
end;
$$;

create or replace function post_vyndi_inventory_issue(
  p_movement_id text,
  p_ledger_id text,
  p_sku text,
  p_quantity numeric,
  p_unit text,
  p_issued_on date,
  p_reference text,
  p_notes text,
  p_actor_user_id text,
  p_actor_role text
) returns table (movement_id text, ledger_id text, resulting_balance numeric, fifo_value_inr numeric)
language plpgsql
as $$
declare v_balance numeric; v_reserved numeric:=0; v_fifo_cost numeric:=0; v_unit_cost numeric:=0; v_unit text:=vyndi_canonical_unit(p_unit);
begin
  if p_quantity<=0 then raise exception 'Issue quantity must be greater than zero.'; end if;
  if trim(coalesce(p_reference,''))='' then raise exception 'Issue reference is required.'; end if;
  perform pg_advisory_xact_lock(hashtext(upper(trim(p_sku)) || '|' || v_unit)::bigint);
  select coalesce(sum(quantity_delta),0) into v_balance
    from epr_inventory_ledger where sku=upper(trim(p_sku)) and vyndi_canonical_unit(unit)=v_unit;
  select coalesce(sum(quantity_reserved),0) into v_reserved
    from epr_inventory_reservations
   where sku=upper(trim(p_sku)) and vyndi_canonical_unit(unit)=v_unit and status='active';
  if greatest(v_balance-v_reserved,0)<p_quantity then
    raise exception 'Insufficient available-to-promise stock for %: physical %, reserved %, free %, requested %.',
      p_sku,v_balance,v_reserved,greatest(v_balance-v_reserved,0),p_quantity;
  end if;

  insert into epr_inventory_movements
    (id,traveller_id,venture,sku,movement_type,quantity,unit,reference,notes,recorded_by,effective_on)
  values
    (p_movement_id,null,'shared',upper(trim(p_sku)),'issue',p_quantity,v_unit,p_reference,coalesce(p_notes,''),p_actor_user_id,p_issued_on);
  insert into epr_inventory_ledger
    (id,venture,sku,unit,quantity_delta,movement_id,traveller_id,serial_number,reference,notes,recorded_by,unit_cost_inr,effective_on)
  values
    (p_ledger_id,'shared',upper(trim(p_sku)),v_unit,-p_quantity,p_movement_id,null,null,p_reference,coalesce(p_notes,''),p_actor_user_id,0,p_issued_on);

  select coalesce(sum(extended_cost_inr),0) into v_fifo_cost
    from epr_inventory_fifo_allocations where issue_ledger_id=p_ledger_id;
  v_unit_cost:=case when p_quantity>0 then v_fifo_cost/p_quantity else 0 end;
  insert into epr_inventory_cost_ledger
    (id,venture,sku,unit,quantity_delta,value_delta_inr,movement_id,traveller_id,unit_cost_inr,reference,recorded_by)
  values
    (p_ledger_id || '-COST','shared',upper(trim(p_sku)),v_unit,-p_quantity,-v_fifo_cost,p_movement_id,null,v_unit_cost,p_reference,p_actor_user_id);

  insert into vyndi_audit_events
    (id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    (p_ledger_id || '-AUD','inventory_movement',p_movement_id,'fifo_issue_posted',p_actor_user_id,p_actor_role,p_reference,
     jsonb_build_object('ledgerId',p_ledger_id,'sku',upper(trim(p_sku)),'unit',v_unit,'quantity',p_quantity,
       'fifoValueInr',v_fifo_cost,'resultingBalance',v_balance-p_quantity));

  return query select p_movement_id,p_ledger_id,v_balance-p_quantity,v_fifo_cost;
end;
$$;

create or replace function save_vyndi_master_inventory_entry(
  p_item_id text,
  p_movement_id text,
  p_ledger_entry_id text,
  p_ledger_id text,
  p_sku text,
  p_name text,
  p_category text,
  p_unit text,
  p_minimum_stock_level numeric,
  p_planned_monthly_use numeric,
  p_quantity_received numeric,
  p_unit_cost_inr numeric,
  p_received_on date,
  p_expiry_on date,
  p_next_inspection_on date,
  p_reference text,
  p_notes text,
  p_actor_user_id text,
  p_actor_role text
) returns table (item_id text, lot_id text)
language plpgsql
as $$
declare v_item_id text; v_existing_ledger text;
begin
  if p_ledger_id not in ('components','raw-materials','tooling','quality','stores-tools') then raise exception 'Unknown inventory ledger.'; end if;
  if trim(p_sku)='' or trim(p_name)='' or trim(p_category)='' then raise exception 'SKU, item name and category are required.'; end if;
  if p_minimum_stock_level<0 or p_planned_monthly_use<0 or p_quantity_received<0 or p_unit_cost_inr<0 then
    raise exception 'Inventory quantities and costs cannot be negative.';
  end if;

  select ledger_id into v_existing_ledger from master_inventory_items where sku=upper(trim(p_sku)) limit 1;
  if v_existing_ledger is not null and v_existing_ledger<>p_ledger_id then
    raise exception 'SKU % already belongs to ledger %. Open that item instead.',upper(trim(p_sku)),v_existing_ledger;
  end if;

  insert into master_inventory_items
    (id,ledger_id,sku,name,category,unit,minimum_stock_level,planned_monthly_use,created_by,updated_by)
  values
    (p_item_id,p_ledger_id,upper(trim(p_sku)),trim(p_name),trim(p_category),vyndi_canonical_unit(p_unit),p_minimum_stock_level,p_planned_monthly_use,p_actor_user_id,p_actor_user_id)
  on conflict (sku) do update set
    name=excluded.name,category=excluded.category,unit=excluded.unit,
    minimum_stock_level=excluded.minimum_stock_level,planned_monthly_use=excluded.planned_monthly_use,
    active=true,updated_by=excluded.updated_by,updated_at=now()
  returning id into v_item_id;

  if p_quantity_received>0 then
    perform post_vyndi_inventory_receipt(
      p_movement_id,p_ledger_entry_id,upper(trim(p_sku)),p_quantity_received,vyndi_canonical_unit(p_unit),p_unit_cost_inr,
      p_received_on,p_reference,p_notes,p_actor_user_id,p_actor_role);
    insert into vyndi_inventory_receipt_metadata
      (movement_id,master_inventory_item_id,expiry_on,next_inspection_on,recorded_by)
    values
      (p_movement_id,v_item_id,p_expiry_on,p_next_inspection_on,p_actor_user_id);
  end if;

  insert into vyndi_audit_events
    (id,entity_type,entity_id,action,actor_user_id,actor_role,payload_json)
  values
    ('AUD-ITEM-' || p_movement_id,'inventory_item',v_item_id,'master_data_upserted',p_actor_user_id,p_actor_role,
     jsonb_build_object('sku',upper(trim(p_sku)),'ledgerId',p_ledger_id,'category',trim(p_category),'unit',vyndi_canonical_unit(p_unit),
       'minimumStockLevel',p_minimum_stock_level,'plannedMonthlyUse',p_planned_monthly_use,'quantityReceived',p_quantity_received));

  return query select v_item_id,case when p_quantity_received>0 then 'FIFO-' || p_ledger_entry_id else null end;
end;
$$;

create or replace function issue_vyndi_master_inventory_fifo(
  p_movement_id text,
  p_ledger_entry_id text,
  p_item_id text,
  p_quantity numeric,
  p_issued_on date,
  p_reference text,
  p_notes text,
  p_actor_user_id text,
  p_actor_role text
) returns table (issue_id text, quantity_issued numeric, issue_value_inr numeric)
language plpgsql
as $$
declare i record; r record;
begin
  select id,sku,unit into i from master_inventory_items where id=p_item_id and active=true;
  if not found then raise exception 'Inventory item not found.'; end if;
  select * into r from post_vyndi_inventory_issue(
    p_movement_id,p_ledger_entry_id,i.sku,p_quantity,i.unit,p_issued_on,p_reference,p_notes,p_actor_user_id,p_actor_role);
  return query select p_movement_id,p_quantity,r.fifo_value_inr;
end;
$$;

-- Production consumption uses the same shared physical FIFO pool. The traveller
-- still supplies venture/BOM provenance; it no longer creates a competing stock
-- balance partition. Reservations are handled by epr_inventory_reservations and
-- are intentionally rejected here as quantity movements.
create or replace function post_epr_inventory_movement(
  p_movement_id text, p_ledger_id text, p_traveller_id text, p_venture text, p_sku text,
  p_movement_type text, p_quantity numeric, p_unit text, p_reference text, p_notes text, p_actor text
) returns table (movement_id text, ledger_id text, resulting_balance numeric, cogs_inr numeric)
language plpgsql as $$
declare
  t record;
  m record;
  v_delta numeric;
  v_balance numeric;
  v_reserved_active numeric:=0;
  v_fifo_cost numeric:=0;
  v_unit_cost numeric:=0;
  v_cost_qty numeric:=0;
  v_cost_value numeric:=0;
  v_unit text:=vyndi_canonical_unit(p_unit);
begin
  if p_venture not in ('carbon','aluminium') then raise exception 'Invalid venture.'; end if;
  if p_quantity<=0 then raise exception 'Quantity must be greater than zero.'; end if;
  if p_movement_type not in ('issue','consume','return') then
    raise exception 'Use the reservation ledger for reserve; only issue/consume/return are physical movements.';
  end if;

  select id,venture,model_id,model_name,bom_revision,serial_number
    into t from epr_travellers where id=p_traveller_id for update;
  if not found then raise exception 'Traveller not found.'; end if;
  if t.venture<>p_venture then raise exception 'Venture scope mismatch.'; end if;

  select id,quantity,unit into m
    from epr_bom_inventory_mappings
   where venture=t.venture and model_id=t.model_id and bom_revision=t.bom_revision and sku=p_sku
     and status='active' and approved_by is not null and approved_at is not null
     and effective_from<=now() and (effective_to is null or effective_to>now())
   order by effective_from desc limit 1;
  if not found then raise exception 'SKU % is not approved for traveller % / BOM %.',p_sku,p_traveller_id,t.bom_revision; end if;
  if vyndi_canonical_unit(m.unit)<>v_unit then raise exception 'Unit mismatch: approved % uses %, received %.',p_sku,m.unit,v_unit; end if;

  perform pg_advisory_xact_lock(hashtext(upper(trim(p_sku)) || '|' || v_unit)::bigint);
  select coalesce(sum(quantity_delta),0) into v_balance
    from epr_inventory_ledger where sku=upper(trim(p_sku)) and vyndi_canonical_unit(unit)=v_unit;

  if p_movement_type in ('issue','consume') then
    select coalesce(sum(quantity_reserved),0) into v_reserved_active
      from epr_inventory_reservations
     where sku=upper(trim(p_sku)) and vyndi_canonical_unit(unit)=v_unit and status='active';
    if greatest(v_balance-v_reserved_active,0)<p_quantity then
      raise exception 'Unreserved stock is insufficient for direct EPR issue of %: physical %, reserved %, free %, requested %. Consume the linked job-card reservation instead.',
        p_sku,v_balance,v_reserved_active,greatest(v_balance-v_reserved_active,0),p_quantity;
    end if;
  end if;

  if p_movement_type='return' then
    v_delta:=p_quantity;
    select unit_cost_inr into v_unit_cost
      from epr_cogs_entries
     where traveller_id=p_traveller_id and sku=upper(trim(p_sku)) and vyndi_canonical_unit(unit)=v_unit
     order by created_at desc limit 1;
    if v_unit_cost is null then
      select coalesce(sum(quantity_delta),0),coalesce(sum(value_delta_inr),0)
        into v_cost_qty,v_cost_value
        from epr_inventory_cost_ledger where sku=upper(trim(p_sku)) and vyndi_canonical_unit(unit)=v_unit;
      v_unit_cost:=case when v_cost_qty>0 then greatest(v_cost_value/v_cost_qty,0) else 0 end;
    end if;
  else
    v_delta:=-p_quantity;
  end if;

  insert into epr_inventory_movements
    (id,traveller_id,venture,sku,movement_type,quantity,unit,reference,notes,recorded_by)
  values
    (p_movement_id,p_traveller_id,p_venture,upper(trim(p_sku)),p_movement_type,p_quantity,v_unit,p_reference,p_notes,p_actor);

  insert into epr_inventory_ledger
    (id,venture,sku,unit,quantity_delta,movement_id,traveller_id,serial_number,reference,notes,recorded_by,unit_cost_inr)
  values
    (p_ledger_id,p_venture,upper(trim(p_sku)),v_unit,v_delta,p_movement_id,p_traveller_id,t.serial_number,p_reference,p_notes,p_actor,
     case when p_movement_type='return' then v_unit_cost else 0 end);

  if p_movement_type in ('issue','consume') then
    select coalesce(sum(extended_cost_inr),0) into v_fifo_cost
      from epr_inventory_fifo_allocations where issue_ledger_id=p_ledger_id;
    v_unit_cost:=case when p_quantity>0 then v_fifo_cost/p_quantity else 0 end;
    insert into epr_inventory_cost_ledger
      (id,venture,sku,unit,quantity_delta,value_delta_inr,movement_id,traveller_id,unit_cost_inr,reference,recorded_by)
    values
      (p_ledger_id||'-COST',p_venture,upper(trim(p_sku)),v_unit,-p_quantity,-v_fifo_cost,p_movement_id,p_traveller_id,v_unit_cost,p_reference,p_actor);
    insert into epr_cogs_entries
      (id,traveller_id,venture,serial_number,sku,unit,quantity,unit_cost_inr,cogs_inr,movement_id)
    values
      (p_ledger_id||'-COGS',p_traveller_id,p_venture,t.serial_number,upper(trim(p_sku)),v_unit,p_quantity,v_unit_cost,v_fifo_cost,p_movement_id);
  else
    v_fifo_cost:=0;
    insert into epr_inventory_cost_ledger
      (id,venture,sku,unit,quantity_delta,value_delta_inr,movement_id,traveller_id,unit_cost_inr,reference,recorded_by)
    values
      (p_ledger_id||'-COST',p_venture,upper(trim(p_sku)),v_unit,p_quantity,p_quantity*v_unit_cost,p_movement_id,p_traveller_id,v_unit_cost,p_reference,p_actor);
  end if;

  insert into epr_audit_events
    (id,venture,entity_type,entity_id,action,actor,payload_json)
  values
    (p_ledger_id||'-AUD',p_venture,'inventory_movement',p_movement_id,'authoritatively_posted',p_actor,
     json_build_object('ledgerId',p_ledger_id,'travellerId',p_traveller_id,'serialNumber',t.serial_number,
       'sku',upper(trim(p_sku)),'movementType',p_movement_type,'quantity',p_quantity,'unit',v_unit,
       'quantityDelta',v_delta,'resultingSharedBalance',v_balance+v_delta,'fifoCogsInr',v_fifo_cost)::text);

  return query select p_movement_id,p_ledger_id,v_balance+v_delta,v_fifo_cost;
end;
$$;

create or replace view vyndi_inventory_balance as
with quantity as (
  select l.sku,
         vyndi_canonical_unit(l.unit) as unit,
         coalesce(sum(l.quantity_delta),0) as quantity_balance,
         min(l.created_at) as first_movement_at,
         max(l.created_at) as last_movement_at
    from epr_inventory_ledger l
   group by l.sku,vyndi_canonical_unit(l.unit)
), value as (
  select c.sku,
         vyndi_canonical_unit(c.unit) as unit,
         coalesce(sum(c.value_delta_inr),0) as inventory_value_inr
    from epr_inventory_cost_ledger c
   group by c.sku,vyndi_canonical_unit(c.unit)
)
select q.sku,q.unit,q.quantity_balance,
       coalesce(v.inventory_value_inr,0) as inventory_value_inr,
       case when q.quantity_balance>0 then coalesce(v.inventory_value_inr,0)/q.quantity_balance else 0 end as weighted_average_cost_inr,
       q.first_movement_at,q.last_movement_at
  from quantity q
  left join value v on v.sku=q.sku and v.unit=q.unit;

-- Reservation is a commitment against stock, not a stock movement. It therefore
-- must never be posted as a negative inventory ledger quantity.
create table if not exists epr_inventory_reservations (
  id text primary key,
  job_card_id text not null references epr_production_job_cards(id) on delete restrict,
  job_card_line_id text not null references epr_production_job_card_lines(id) on delete restrict,
  sales_order_id text not null,
  sales_order_revision integer not null check (sales_order_revision > 0),
  sku text not null,
  unit text not null,
  quantity_reserved numeric(14,4) not null check (quantity_reserved > 0),
  status text not null default 'active' check (status in ('active','released','consumed')),
  reserved_by text not null,
  reserved_at timestamptz not null default now(),
  released_by text,
  released_at timestamptz,
  consumed_by text,
  consumed_at timestamptz
);

create unique index if not exists epr_inventory_reservation_active_line_uidx
  on epr_inventory_reservations (job_card_line_id)
  where status='active';
create index if not exists epr_inventory_reservation_sku_idx
  on epr_inventory_reservations (sku, unit, status, reserved_at);
create index if not exists epr_inventory_reservation_order_idx
  on epr_inventory_reservations (sales_order_id, sales_order_revision, status);

create or replace view vyndi_inventory_available_to_promise as
select
  k.sku,
  k.unit,
  coalesce(b.quantity_balance, 0) as physical_quantity,
  coalesce(r.reserved_quantity, 0) as reserved_quantity,
  greatest(coalesce(b.quantity_balance, 0) - coalesce(r.reserved_quantity, 0), 0) as available_to_promise
from (
  select sku, unit from vyndi_inventory_balance
  union
  select sku, unit from epr_inventory_reservations where status='active'
) k
left join vyndi_inventory_balance b on b.sku=k.sku and b.unit=k.unit
left join (
  select sku, unit, sum(quantity_reserved) as reserved_quantity
  from epr_inventory_reservations
  where status='active'
  group by sku, unit
) r on r.sku=k.sku and r.unit=k.unit;

create or replace function reserve_epr_inventory_for_job_line(
  p_reservation_id text,
  p_job_card_id text,
  p_job_card_line_id text,
  p_actor_user_id text,
  p_actor_role text
) returns table (
  reservation_id text,
  required_quantity numeric,
  physical_quantity numeric,
  reserved_quantity numeric,
  shortage_quantity numeric
)
language plpgsql
as $$
declare
  c record;
  l record;
  v_physical numeric := 0;
  v_reserved_elsewhere numeric := 0;
  v_available numeric := 0;
  v_take numeric := 0;
  v_unit text;
begin
  select id, sales_order_id, sales_order_revision, status
    into c
    from epr_production_job_cards
   where id=p_job_card_id
   for update;
  if not found then raise exception 'Production job card not found.'; end if;
  if c.status not in ('released','in_progress') then
    raise exception 'Only released/in-progress job cards may reserve stock.';
  end if;

  select id, sku, unit, quantity
    into l
    from epr_production_job_card_lines
   where id=p_job_card_line_id and job_card_id=p_job_card_id
   for update;
  if not found then raise exception 'Production job-card line not found.'; end if;
  if l.sku is null or trim(l.sku)='' then
    raise exception 'Mapped SKU is required before reservation.';
  end if;
  if l.quantity <= 0 then
    raise exception 'Requirement quantity must be positive before reservation.';
  end if;
  v_unit:=vyndi_canonical_unit(l.unit);

  perform pg_advisory_xact_lock(hashtext(l.sku || '|' || v_unit)::bigint);

  update epr_inventory_reservations
     set status='released', released_by=p_actor_user_id, released_at=now()
   where job_card_line_id=p_job_card_line_id and status='active';

  select coalesce(sum(quantity_delta),0)
    into v_physical
    from epr_inventory_ledger
   where sku=l.sku and vyndi_canonical_unit(unit)=v_unit;

  select coalesce(sum(quantity_reserved),0)
    into v_reserved_elsewhere
    from epr_inventory_reservations
   where sku=l.sku and vyndi_canonical_unit(unit)=v_unit and status='active';

  v_available := greatest(v_physical - v_reserved_elsewhere, 0);
  v_take := least(l.quantity, v_available);

  if v_take > 0 then
    insert into epr_inventory_reservations
      (id,job_card_id,job_card_line_id,sales_order_id,sales_order_revision,sku,unit,quantity_reserved,status,reserved_by)
    values
      (p_reservation_id,p_job_card_id,p_job_card_line_id,c.sales_order_id,c.sales_order_revision,l.sku,v_unit,v_take,'active',p_actor_user_id);
  end if;

  update epr_production_job_card_lines
     set available_quantity=v_available,
         shortage_quantity=greatest(l.quantity-v_take,0),
         issue_status=case
           when l.quantity-v_take > 0 then 'short'
           when v_take > 0 then 'reserved'
           else 'pending'
         end
   where id=p_job_card_line_id;

  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    (p_reservation_id || '-AUD','production_job_card_line',p_job_card_line_id,c.sales_order_revision,
     'inventory_reservation_reconciled',p_actor_user_id,p_actor_role,c.sales_order_id,
     jsonb_build_object('jobCardId',p_job_card_id,'sku',l.sku,'unit',v_unit,'required',l.quantity,
       'physical',v_physical,'reservedElsewhere',v_reserved_elsewhere,'reserved',v_take,
       'shortage',greatest(l.quantity-v_take,0)));

  return query
    select case when v_take>0 then p_reservation_id else null end,
           l.quantity, v_physical, v_take, greatest(l.quantity-v_take,0);
end;
$$;

create or replace function release_epr_job_card_reservations(
  p_job_card_id text,
  p_actor_user_id text,
  p_actor_role text
) returns integer
language plpgsql
as $$
declare v_count integer;
begin
  update epr_inventory_reservations
     set status='released', released_by=p_actor_user_id, released_at=now()
   where job_card_id=p_job_card_id and status='active';
  get diagnostics v_count = row_count;

  update epr_production_job_card_lines
     set issue_status=case when issue_status='reserved' then 'pending' else issue_status end
   where job_card_id=p_job_card_id and issue_status in ('reserved','short');

  insert into vyndi_audit_events
    (id,entity_type,entity_id,action,actor_user_id,actor_role,payload_json)
  values
    ('AUD-REL-' || p_job_card_id || '-' || extract(epoch from clock_timestamp())::bigint,
     'production_job_card',p_job_card_id,'inventory_reservations_released',p_actor_user_id,p_actor_role,
     jsonb_build_object('releasedReservationCount',v_count));
  return v_count;
end;
$$;

-- Convert a real reservation into the physical FIFO issue during kitting.
-- The reservation is marked consumed first inside the same database transaction;
-- if the physical posting fails, the entire function rolls back.
create or replace function consume_epr_inventory_reservation(
  p_reservation_id text,
  p_traveller_id text,
  p_movement_id text,
  p_ledger_id text,
  p_actor_user_id text,
  p_actor_role text
) returns table (movement_id text, ledger_id text, resulting_balance numeric, cogs_inr numeric)
language plpgsql
as $$
declare r record; c record; posted record;
begin
  select * into r from epr_inventory_reservations where id=p_reservation_id for update;
  if not found then raise exception 'Inventory reservation not found.'; end if;
  if r.status<>'active' then raise exception 'Only active reservations can be consumed; current status is %.',r.status; end if;
  select id,status,bom_revision,variant_id into c from epr_production_job_cards where id=r.job_card_id for update;
  if not found or c.status not in ('released','in_progress') then
    raise exception 'Reservation job card is not released/in progress.';
  end if;

  update epr_inventory_reservations
     set status='consumed',consumed_by=p_actor_user_id,consumed_at=now()
   where id=r.id;

  select * into posted from post_epr_inventory_movement(
    p_movement_id,p_ledger_id,p_traveller_id,
    case when exists(select 1 from epr_travellers t where t.id=p_traveller_id and t.venture='aluminium') then 'aluminium' else 'carbon' end,
    r.sku,'issue',r.quantity_reserved,r.unit,
    'Job card ' || r.job_card_id || ' / sales order ' || r.sales_order_id,
    'Consumed from reservation ' || r.id,p_actor_user_id);

  update epr_production_job_card_lines
     set issue_status='issued',available_quantity=greatest(available_quantity-r.quantity_reserved,0),shortage_quantity=0
   where id=r.job_card_line_id;

  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    ('AUD-CONSUME-' || r.id || '-' || extract(epoch from clock_timestamp())::bigint,
     'inventory_reservation',r.id,r.sales_order_revision,'consumed_to_fifo_issue',p_actor_user_id,p_actor_role,p_movement_id,
     jsonb_build_object('jobCardId',r.job_card_id,'jobCardLineId',r.job_card_line_id,'travellerId',p_traveller_id,
       'sku',r.sku,'unit',r.unit,'quantity',r.quantity_reserved,'fifoCogsInr',posted.cogs_inr));

  return query select posted.movement_id,posted.ledger_id,posted.resulting_balance,posted.cogs_inr;
end;
$$;

-- A receipt should immediately satisfy the oldest released shortage where possible.
-- This keeps reservations/shortages live after stock receipts instead of waiting for
-- a browser action to refresh a snapshot.
create or replace function vyndi_auto_allocate_receipt_reservations_trigger()
returns trigger
language plpgsql
as $$
declare line record;
begin
  if new.quantity_delta<=0 then return new; end if;
  for line in
    select c.id as job_card_id,l.id as job_card_line_id
      from epr_production_job_cards c
      join epr_production_job_card_lines l on l.job_card_id=c.id
      left join epr_inventory_reservations r on r.job_card_line_id=l.id and r.status='active'
     where c.status in ('released','in_progress')
       and l.sku=new.sku
       and vyndi_canonical_unit(l.unit)=vyndi_canonical_unit(new.unit)
     group by c.id,c.due_month,c.created_at,l.id,l.quantity
    having l.quantity>coalesce(sum(r.quantity_reserved),0)
     order by c.due_month asc,c.created_at asc,l.id asc
  loop
    perform reserve_epr_inventory_for_job_line(
      'AUTORES-' || md5(line.job_card_line_id || clock_timestamp()::text || random()::text),
      line.job_card_id,line.job_card_line_id,'system:receipt','system');
  end loop;
  return new;
end;
$$;

drop trigger if exists vyndi_auto_allocate_receipt_reservations_trigger on epr_inventory_ledger;
create trigger vyndi_auto_allocate_receipt_reservations_trigger
after insert on epr_inventory_ledger
for each row when (new.quantity_delta>0)
execute function vyndi_auto_allocate_receipt_reservations_trigger();

-- Any revision to a committed order makes an existing Production projection
-- non-authoritative until it is synchronized. Cancellation is projected
-- immediately. This prevents stale lines from continuing to reserve stock or
-- drive Procurement if a UI/server sync call later fails.
create or replace function vyndi_sales_projection_stale_trigger()
returns trigger
language plpgsql
as $$
declare c record; v_released integer;
begin
  if new.revision=old.revision then return new; end if;
  select id,status into c from epr_production_job_cards where sales_order_id=new.id for update;
  if not found then return new; end if;

  v_released:=release_epr_job_card_reservations(c.id,new.updated_by,'system');
  if new.status='cancelled' then
    update epr_production_job_cards set status='cancelled',updated_by=new.updated_by,updated_at=now() where id=c.id;
  elsif c.status<>'complete' then
    update epr_production_job_cards set status='hold',updated_by=new.updated_by,updated_at=now() where id=c.id;
  end if;

  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    ('AUD-PROJ-STALE-' || new.id || '-R' || new.revision,'production_job_card',c.id,new.revision,
     case when new.status='cancelled' then 'cancelled_by_sales_revision' else 'held_pending_sales_resync' end,
     new.updated_by,'system',new.id,jsonb_build_object('releasedReservations',v_released,'orderStatus',new.status));
  return new;
end;
$$;

drop trigger if exists vyndi_sales_projection_stale_trigger on vyndi_sales_orders;
create trigger vyndi_sales_projection_stale_trigger
after update of revision,status,plan_month,units,variant_id,configuration on vyndi_sales_orders
for each row execute function vyndi_sales_projection_stale_trigger();

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
  greatest(l.quantity-coalesce(r.quantity_reserved,0)-coalesce(atp.available_to_promise,0),0) as shortage_quantity,
  coalesce(atp.physical_quantity,0) as physical_quantity,
  coalesce(atp.available_to_promise,0) as available_to_promise,
  l.issue_status
from epr_production_job_cards c
join epr_production_job_card_lines l on l.job_card_id=c.id
left join epr_inventory_reservations r
  on r.job_card_line_id=l.id and r.status='active'
left join vyndi_inventory_available_to_promise atp
  on atp.sku=l.sku and atp.unit=vyndi_canonical_unit(l.unit);

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
where job_card_status in ('released','in_progress') and sku is not null
group by due_month,sku,unit;

create table if not exists epr_procurement_sku_actions (
  id text primary key,
  scenario text not null check (scenario in ('base','delayed','stress')),
  requirement_month integer not null check (requirement_month between 1 and 36),
  sku text not null,
  unit text not null,
  action_type text not null check (action_type in ('rfq','approval','po','receipt','hold')),
  quantity numeric(14,4) not null check (quantity >= 0),
  status text not null default 'planned' check (status in ('planned','in_progress','complete','on_hold','cancelled')),
  demand_basis text not null check (demand_basis in ('planned','committed','reconciled')),
  note text not null default '',
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create index if not exists epr_procurement_sku_actions_lookup_idx
  on epr_procurement_sku_actions (scenario,requirement_month,sku,unit,action_type,status);

create or replace view vyndi_open_purchase_orders as
select scenario,requirement_month,sku,unit,
       sum(quantity) filter (where action_type='po' and status in ('planned','in_progress')) as open_po_quantity
  from epr_procurement_sku_actions
 group by scenario,requirement_month,sku,unit;
