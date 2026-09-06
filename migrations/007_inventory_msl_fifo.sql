-- Minimum Stock Level controls and FIFO inventory valuation/allocation.
-- FIFO is quantity-authoritative for future receipts/issues. Existing ledger history remains intact.

alter table epr_inventory_ledger
  add column if not exists unit_cost_inr numeric(14,2) not null default 0 check (unit_cost_inr >= 0);

create table if not exists epr_inventory_controls (
  id text primary key,
  venture text not null check (venture in ('carbon','aluminium')),
  sku text not null,
  unit text not null,
  minimum_stock_level numeric(14,4) not null default 0 check (minimum_stock_level >= 0),
  reorder_quantity numeric(14,4) not null default 0 check (reorder_quantity >= 0),
  lead_time_days integer not null default 0 check (lead_time_days >= 0),
  active boolean not null default true,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique (venture, sku, unit)
);

create index if not exists epr_inventory_controls_msl_idx
  on epr_inventory_controls (venture, sku, unit, minimum_stock_level)
  where active = true;

-- Carry the existing component catalogue reorder level into operational MSL controls
-- where the SKU already exists in the catalogue. No stock is created by this seed.
insert into epr_inventory_controls
  (id, venture, sku, unit, minimum_stock_level, reorder_quantity, notes)
select
  'MSL-' || ci.sku,
  v.venture,
  ci.sku,
  'unit',
  ci.reorder_level,
  ci.reorder_level,
  'Seeded from component inventory reorder level; confirm against supplier lead time and demand.'
from component_inventory ci
cross join (values ('carbon'), ('aluminium')) as v(venture)
where ci.reorder_level > 0
on conflict (venture, sku, unit) do nothing;

create table if not exists epr_inventory_fifo_layers (
  id text primary key,
  venture text not null check (venture in ('carbon','aluminium')),
  sku text not null,
  unit text not null,
  source_ledger_id text not null unique references epr_inventory_ledger(id) on delete restrict,
  received_at timestamptz not null,
  quantity_received numeric(14,4) not null check (quantity_received > 0),
  quantity_remaining numeric(14,4) not null check (quantity_remaining >= 0),
  unit_cost_inr numeric(14,2) not null default 0 check (unit_cost_inr >= 0),
  created_at timestamptz not null default now()
);

create index if not exists epr_inventory_fifo_layers_pick_idx
  on epr_inventory_fifo_layers (venture, sku, unit, received_at, id)
  where quantity_remaining > 0;

create table if not exists epr_inventory_fifo_allocations (
  id text primary key,
  issue_ledger_id text not null references epr_inventory_ledger(id) on delete restrict,
  layer_id text not null references epr_inventory_fifo_layers(id) on delete restrict,
  quantity numeric(14,4) not null check (quantity > 0),
  unit_cost_inr numeric(14,2) not null default 0 check (unit_cost_inr >= 0),
  extended_cost_inr numeric(18,2) not null default 0 check (extended_cost_inr >= 0),
  allocated_at timestamptz not null default now()
);

create index if not exists epr_inventory_fifo_alloc_issue_idx
  on epr_inventory_fifo_allocations (issue_ledger_id);

create index if not exists epr_inventory_fifo_alloc_layer_idx
  on epr_inventory_fifo_allocations (layer_id);

-- Rebuild FIFO layers from positive historical ledger entries. Historical negative
-- entries cannot be reconstructed with certainty, so they are deliberately not
-- retroactively assigned to lots; all future issues are FIFO-controlled.
insert into epr_inventory_fifo_layers
  (id, venture, sku, unit, source_ledger_id, received_at, quantity_received, quantity_remaining, unit_cost_inr)
select
  'FIFO-' || l.id,
  l.venture,
  l.sku,
  l.unit,
  l.id,
  l.created_at,
  l.quantity_delta,
  l.quantity_delta,
  l.unit_cost_inr
from epr_inventory_ledger l
where l.quantity_delta > 0
on conflict (source_ledger_id) do nothing;

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
  if p_quantity <= 0 then
    raise exception 'FIFO issue quantity must be greater than zero.';
  end if;

  for layer in
    select id, quantity_remaining, unit_cost_inr
    from epr_inventory_fifo_layers
    where venture = p_venture
      and sku = p_sku
      and unit = p_unit
      and quantity_remaining > 0
    order by received_at asc, id asc
    for update
  loop
    exit when remaining <= 0;
    take_qty := least(remaining, layer.quantity_remaining);

    insert into epr_inventory_fifo_allocations
      (id, issue_ledger_id, layer_id, quantity, unit_cost_inr, extended_cost_inr)
    values
      (p_issue_ledger_id || '-' || layer.id,
       p_issue_ledger_id,
       layer.id,
       take_qty,
       layer.unit_cost_inr,
       round(take_qty * layer.unit_cost_inr, 2));

    update epr_inventory_fifo_layers
      set quantity_remaining = quantity_remaining - take_qty
    where id = layer.id;

    total_cost := total_cost + (take_qty * layer.unit_cost_inr);
    remaining := remaining - take_qty;
  end loop;

  if remaining > 0 then
    raise exception 'FIFO allocation failed for %: % units remain unallocated.', p_sku, remaining;
  end if;

  return round(total_cost, 2);
end;
$$;

create or replace function epr_inventory_fifo_ledger_trigger()
returns trigger
language plpgsql
as $$
begin
  if new.quantity_delta > 0 then
    insert into epr_inventory_fifo_layers
      (id, venture, sku, unit, source_ledger_id, received_at, quantity_received, quantity_remaining, unit_cost_inr)
    values
      ('FIFO-' || new.id, new.venture, new.sku, new.unit, new.id, new.created_at,
       new.quantity_delta, new.quantity_delta, new.unit_cost_inr)
    on conflict (source_ledger_id) do nothing;
  else
    perform allocate_epr_inventory_fifo(new.id, new.venture, new.sku, new.unit, abs(new.quantity_delta));
  end if;
  return new;
end;
$$;

drop trigger if exists epr_inventory_fifo_ledger_trigger on epr_inventory_ledger;
create trigger epr_inventory_fifo_ledger_trigger
after insert on epr_inventory_ledger
for each row execute function epr_inventory_fifo_ledger_trigger();

comment on table epr_inventory_controls is
  'Operational minimum-stock controls. MSL warnings are derived from authoritative ledger balances and link to procurement.';
comment on table epr_inventory_fifo_layers is
  'FIFO receipt layers. Oldest positive inventory layer is consumed first.';
comment on table epr_inventory_fifo_allocations is
  'Immutable allocation record showing exactly which FIFO receipt layers funded each issue.';
