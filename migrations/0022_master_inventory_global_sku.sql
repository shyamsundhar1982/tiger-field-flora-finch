-- Master Inventory owns each SKU exactly once across every operational ledger.
-- Keep the historical (ledger_id, sku) constraint for compatibility, but add a
-- stricter global SKU key and harden the write function against cross-ledger
-- duplicates (including concurrent writes).

do $$
declare
  v_duplicates text;
begin
  select string_agg(format('%s [%s]', sku, ledgers), '; ' order by sku)
    into v_duplicates
  from (
    select sku, string_agg(distinct ledger_id, ', ' order by ledger_id) as ledgers
    from master_inventory_items
    group by sku
    having count(*) > 1
  ) duplicate_skus;

  if v_duplicates is not null then
    raise exception
      'Cannot enforce global Master Inventory SKU ownership. Reconcile duplicate SKUs first: %',
      v_duplicates;
  end if;
end;
$$;

create unique index if not exists master_inventory_items_sku_uidx
  on master_inventory_items (sku);

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
  v_sku text := upper(trim(p_sku));
  v_existing_ledger text;
  v_existing_ledger_label text;
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

  -- Give operators a useful error instead of allowing one SKU to exist in two
  -- ledgers. The unique index below remains the final concurrency-safe guard.
  select ledger_id
    into v_existing_ledger
  from master_inventory_items
  where sku = v_sku
  limit 1;

  if v_existing_ledger is not null and v_existing_ledger <> p_ledger_id then
    v_existing_ledger_label := case v_existing_ledger
      when 'components' then 'Components'
      when 'raw-materials' then 'Raw materials'
      when 'tooling' then 'Manufacturing tooling'
      when 'quality' then 'Quality & test'
      when 'stores-tools' then 'Stores & tools'
      else v_existing_ledger
    end;
    raise exception 'SKU % already belongs to %. Open that item instead.',
      v_sku, v_existing_ledger_label;
  end if;

  insert into master_inventory_items
    (id, ledger_id, sku, name, category, unit, minimum_stock_level, planned_monthly_use, created_by, updated_by)
  values
    (p_item_id, p_ledger_id, v_sku, trim(p_name), trim(p_category), trim(p_unit),
     p_minimum_stock_level, p_planned_monthly_use, p_actor, p_actor)
  on conflict (sku) do update set
    name = excluded.name,
    category = excluded.category,
    unit = excluded.unit,
    minimum_stock_level = excluded.minimum_stock_level,
    planned_monthly_use = excluded.planned_monthly_use,
    active = true,
    updated_by = excluded.updated_by,
    updated_at = now()
  where master_inventory_items.ledger_id = excluded.ledger_id
  returning id into v_item_id;

  -- If two different-ledger writes raced after the pre-check, the global SKU
  -- conflict is deliberately not updated by the WHERE clause above. Convert
  -- that concurrency case into the same operator-facing ownership error.
  if v_item_id is null then
    select ledger_id
      into v_existing_ledger
    from master_inventory_items
    where sku = v_sku
    limit 1;

    v_existing_ledger_label := case v_existing_ledger
      when 'components' then 'Components'
      when 'raw-materials' then 'Raw materials'
      when 'tooling' then 'Manufacturing tooling'
      when 'quality' then 'Quality & test'
      when 'stores-tools' then 'Stores & tools'
      else coalesce(v_existing_ledger, 'another ledger')
    end;
    raise exception 'SKU % already belongs to %. Open that item instead.',
      v_sku, v_existing_ledger_label;
  end if;

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

comment on index master_inventory_items_sku_uidx is
  'One SKU has one Master Inventory owner ledger across Components, Raw Materials and support-asset ledgers.';
