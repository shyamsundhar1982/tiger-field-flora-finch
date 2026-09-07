-- One operational inventory master with ledger-specific item controls and
-- append-only purchase lots. FIFO allocation is enforced in the database.

create table if not exists master_inventory_items (
  id text primary key,
  ledger_id text not null check (ledger_id in ('components','raw-materials','tooling','quality','stores-tools')),
  sku text not null check (sku = upper(sku)),
  name text not null,
  category text not null,
  unit text not null default 'ea',
  minimum_stock_level numeric(14,4) not null default 0 check (minimum_stock_level >= 0),
  planned_monthly_use numeric(14,4) not null default 0 check (planned_monthly_use >= 0),
  active boolean not null default true,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_by text not null,
  updated_at timestamptz not null default now(),
  unique (ledger_id, sku)
);

create index if not exists master_inventory_items_filter_idx
  on master_inventory_items (ledger_id, category, name) where active = true;

create table if not exists master_inventory_lots (
  id text primary key,
  item_id text not null references master_inventory_items(id) on delete restrict,
  quantity_received numeric(14,4) not null check (quantity_received > 0),
  quantity_remaining numeric(14,4) not null check (quantity_remaining >= 0 and quantity_remaining <= quantity_received),
  unit_cost_inr numeric(14,2) not null default 0 check (unit_cost_inr >= 0),
  received_on date not null,
  expiry_on date,
  next_inspection_on date,
  reference text not null default '',
  notes text not null default '',
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists master_inventory_lots_fifo_idx
  on master_inventory_lots (item_id, received_on, created_at, id)
  where quantity_remaining > 0;

create table if not exists master_inventory_issues (
  id text primary key,
  item_id text not null references master_inventory_items(id) on delete restrict,
  quantity numeric(14,4) not null check (quantity > 0),
  issued_on date not null,
  reference text not null default '',
  notes text not null default '',
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists master_inventory_issues_item_idx
  on master_inventory_issues (item_id, issued_on desc, created_at desc);

create table if not exists master_inventory_fifo_allocations (
  id text primary key,
  issue_id text not null references master_inventory_issues(id) on delete restrict,
  lot_id text not null references master_inventory_lots(id) on delete restrict,
  quantity numeric(14,4) not null check (quantity > 0),
  unit_cost_inr numeric(14,2) not null default 0 check (unit_cost_inr >= 0),
  allocated_at timestamptz not null default now(),
  unique (issue_id, lot_id)
);

create index if not exists master_inventory_fifo_issue_idx on master_inventory_fifo_allocations (issue_id);
create index if not exists master_inventory_fifo_lot_idx on master_inventory_fifo_allocations (lot_id);

create or replace function save_master_inventory_entry(
  p_item_id text,
  p_lot_id text,
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
  p_actor text
) returns table (item_id text, lot_id text)
language plpgsql
as $$
declare
  v_item_id text;
  v_lot_id text := null;
begin
  if p_ledger_id not in ('components','raw-materials','tooling','quality','stores-tools') then
    raise exception 'Unknown inventory ledger.';
  end if;
  if trim(p_sku) = '' or trim(p_name) = '' or trim(p_category) = '' then
    raise exception 'SKU, item name and category are required.';
  end if;
  if p_minimum_stock_level < 0 or p_planned_monthly_use < 0 or p_quantity_received < 0 or p_unit_cost_inr < 0 then
    raise exception 'Inventory quantities and costs cannot be negative.';
  end if;

  insert into master_inventory_items
    (id, ledger_id, sku, name, category, unit, minimum_stock_level, planned_monthly_use, created_by, updated_by)
  values
    (p_item_id, p_ledger_id, upper(trim(p_sku)), trim(p_name), trim(p_category), trim(p_unit),
     p_minimum_stock_level, p_planned_monthly_use, p_actor, p_actor)
  on conflict (ledger_id, sku) do update set
    name = excluded.name,
    category = excluded.category,
    unit = excluded.unit,
    minimum_stock_level = excluded.minimum_stock_level,
    planned_monthly_use = excluded.planned_monthly_use,
    active = true,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning id into v_item_id;

  if p_quantity_received > 0 then
    v_lot_id := p_lot_id;
    insert into master_inventory_lots
      (id, item_id, quantity_received, quantity_remaining, unit_cost_inr, received_on,
       expiry_on, next_inspection_on, reference, notes, created_by)
    values
      (p_lot_id, v_item_id, p_quantity_received, p_quantity_received, p_unit_cost_inr,
       p_received_on, p_expiry_on, p_next_inspection_on, coalesce(p_reference,''),
       coalesce(p_notes,''), p_actor);
  end if;

  return query select v_item_id, v_lot_id;
end;
$$;

create or replace function issue_master_inventory_fifo(
  p_issue_id text,
  p_item_id text,
  p_quantity numeric,
  p_issued_on date,
  p_reference text,
  p_notes text,
  p_actor text
) returns table (issue_id text, quantity_issued numeric, issue_value_inr numeric)
language plpgsql
as $$
declare
  v_lot record;
  v_remaining numeric := p_quantity;
  v_take numeric;
  v_value numeric := 0;
  v_available numeric;
begin
  if p_quantity <= 0 then raise exception 'Issue quantity must be greater than zero.'; end if;
  if not exists (select 1 from master_inventory_items where id = p_item_id and active = true) then
    raise exception 'Inventory item not found.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_item_id)::bigint);
  select coalesce(sum(quantity_remaining), 0) into v_available
  from master_inventory_lots where item_id = p_item_id;
  if v_available < p_quantity then
    raise exception 'Insufficient stock: available %, requested %.', v_available, p_quantity;
  end if;

  insert into master_inventory_issues (id, item_id, quantity, issued_on, reference, notes, created_by)
  values (p_issue_id, p_item_id, p_quantity, p_issued_on, coalesce(p_reference,''), coalesce(p_notes,''), p_actor);

  for v_lot in
    select id, quantity_remaining, unit_cost_inr
    from master_inventory_lots
    where item_id = p_item_id and quantity_remaining > 0
    order by received_on asc, created_at asc, id asc
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining, v_lot.quantity_remaining);
    insert into master_inventory_fifo_allocations (id, issue_id, lot_id, quantity, unit_cost_inr)
    values (p_issue_id || '-' || v_lot.id, p_issue_id, v_lot.id, v_take, v_lot.unit_cost_inr);
    update master_inventory_lots set quantity_remaining = quantity_remaining - v_take where id = v_lot.id;
    v_value := v_value + (v_take * v_lot.unit_cost_inr);
    v_remaining := v_remaining - v_take;
  end loop;

  return query select p_issue_id, p_quantity, round(v_value, 2);
end;
$$;

-- Bring the original server component seed into the new component ledger. The
-- runtime adds the expanded catalogue without overwriting user-controlled rows.
insert into master_inventory_items
  (id, ledger_id, sku, name, category, unit, minimum_stock_level, planned_monthly_use, created_by, updated_by)
select
  'component-' || id, 'components', upper(sku), brand || ' · ' || model, category, 'ea',
  reorder_level, 0, 'catalogue-seed', 'catalogue-seed'
from component_inventory
on conflict (ledger_id, sku) do nothing;

insert into master_inventory_lots
  (id, item_id, quantity_received, quantity_remaining, unit_cost_inr, received_on, reference, notes, created_by)
select
  'component-seed-' || ci.id,
  mi.id,
  ci.stock_qty,
  ci.stock_qty,
  ci.price_inr,
  current_date,
  'Initial component catalogue',
  ci.notes,
  'catalogue-seed'
from component_inventory ci
join master_inventory_items mi on mi.ledger_id = 'components' and mi.sku = upper(ci.sku)
where ci.stock_qty > 0
on conflict (id) do nothing;

comment on table master_inventory_items is 'Single operational inventory item register. MSL and monthly demand are SKU-level controls.';
comment on table master_inventory_lots is 'Append-only receipt lots. Remaining quantity is reduced only through FIFO allocation.';
comment on table master_inventory_fifo_allocations is 'Audit evidence connecting every inventory issue to the oldest available receipt lots.';
