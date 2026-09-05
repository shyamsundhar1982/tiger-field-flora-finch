create table if not exists epr_inventory_ledger (
  id text primary key,
  venture text not null check (venture in ('carbon','aluminium')),
  sku text not null,
  unit text not null,
  quantity_delta numeric(14,4) not null check (quantity_delta <> 0),
  movement_id text not null references epr_inventory_movements(id) on delete restrict,
  traveller_id text references epr_travellers(id) on delete restrict,
  serial_number text,
  reference text not null default '',
  notes text not null default '',
  recorded_by text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists epr_inventory_ledger_movement_unique_idx
  on epr_inventory_ledger (movement_id);

create index if not exists epr_inventory_ledger_balance_idx
  on epr_inventory_ledger (venture, sku, unit, created_at);

comment on table epr_inventory_ledger is
  'Authoritative append-only inventory quantity ledger for EPR movements. Current balance is derived from ledger entries, not UI seed stock.';
comment on column epr_inventory_ledger.quantity_delta is
  'Positive quantity increases available stock; negative quantity consumes/issues stock.';

create or replace function post_epr_inventory_movement(
  p_movement_id text,
  p_ledger_id text,
  p_traveller_id text,
  p_venture text,
  p_sku text,
  p_movement_type text,
  p_quantity numeric,
  p_unit text,
  p_reference text,
  p_notes text,
  p_actor text
) returns table (movement_id text, ledger_id text, resulting_balance numeric)
language plpgsql
as $$
declare
  t record;
  m record;
  v_delta numeric;
  v_balance numeric;
begin
  if p_venture not in ('carbon','aluminium') then
    raise exception 'Invalid venture.';
  end if;
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;
  if p_movement_type not in ('reserve','issue','return','consume','adjust') then
    raise exception 'Invalid movement type.';
  end if;
  if p_movement_type = 'adjust' then
    raise exception 'Authoritative adjustment requires a dedicated controlled adjustment flow.';
  end if;

  select id, venture, model_id, model_name, bom_revision, serial_number
    into t
    from epr_travellers
   where id = p_traveller_id
   for update;
  if not found then raise exception 'Traveller not found.'; end if;
  if t.venture <> p_venture then raise exception 'Venture scope mismatch.'; end if;

  select id, quantity, unit
    into m
    from epr_bom_inventory_mappings
   where venture = t.venture
     and model_id = t.model_id
     and bom_revision = t.bom_revision
     and sku = p_sku
     and status = 'active'
     and effective_from <= now()
     and (effective_to is null or effective_to > now())
   order by effective_from desc
   limit 1;
  if not found then
    raise exception 'SKU % is not approved for traveller %, model %, BOM revision %.', p_sku, p_traveller_id, t.model_id, t.bom_revision;
  end if;
  if m.unit <> p_unit then
    raise exception 'Unit mismatch: approved SKU % uses unit %, received %.', p_sku, m.unit, p_unit;
  end if;

  if p_movement_type = 'return' then
    v_delta := p_quantity;
  else
    v_delta := -p_quantity;
  end if;

  -- Serialize balance calculation for this venture/SKU/unit. PostgreSQL advisory
  -- locks are transaction-scoped; the hash is stable for the same inventory key.
  perform pg_advisory_xact_lock(hashtext(p_venture || '|' || p_sku || '|' || p_unit)::bigint);

  select coalesce(sum(quantity_delta), 0)
    into v_balance
    from epr_inventory_ledger
   where venture = p_venture and sku = p_sku and unit = p_unit;

  if v_balance + v_delta < 0 then
    raise exception 'Insufficient authoritative stock for %: balance %, requested %.', p_sku, v_balance, p_quantity;
  end if;

  insert into epr_inventory_movements
    (id, traveller_id, venture, sku, movement_type, quantity, unit, reference, notes, recorded_by)
  values
    (p_movement_id, p_traveller_id, p_venture, p_sku, p_movement_type, p_quantity, p_unit, p_reference, p_notes, p_actor);

  insert into epr_inventory_ledger
    (id, venture, sku, unit, quantity_delta, movement_id, traveller_id, serial_number, reference, notes, recorded_by)
  values
    (p_ledger_id, p_venture, p_sku, p_unit, v_delta, p_movement_id, p_traveller_id, t.serial_number, p_reference, p_notes, p_actor);

  insert into epr_audit_events
    (id, venture, entity_type, entity_id, action, actor, payload_json)
  values
    (p_ledger_id || '-AUD', p_venture, 'inventory_movement', p_movement_id,
     'authoritatively_posted', p_actor,
     json_build_object('ledgerId', p_ledger_id, 'travellerId', p_traveller_id,
       'serialNumber', t.serial_number, 'sku', p_sku, 'movementType', p_movement_type,
       'quantity', p_quantity, 'unit', p_unit, 'quantityDelta', v_delta,
       'resultingBalance', v_balance + v_delta)::text);

  return query select p_movement_id, p_ledger_id, v_balance + v_delta;
end;
$$;
