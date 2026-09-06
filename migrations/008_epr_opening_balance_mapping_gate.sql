-- Phase 7: re-check the BOM -> Inventory approval gate inside the
-- authoritative posting transaction. Creation-time checks are not enough:
-- an approved mapping can be retired after an opening draft is created.

create or replace function post_epr_inventory_opening_balance(
  p_opening_id text, p_movement_id text, p_ledger_id text, p_cost_ledger_id text, p_actor text
) returns table (movement_id text, ledger_id text, resulting_balance numeric)
language plpgsql as $$
declare
  o record;
  v_balance numeric;
begin
  select * into o
  from epr_inventory_opening_balances
  where id=p_opening_id
  for update;

  if not found then
    raise exception 'Opening balance record not found.';
  end if;

  if o.status <> 'approved' then
    raise exception 'Opening balance must be approved before posting.';
  end if;

  -- The mapping must be active at the exact moment authoritative stock is posted.
  -- This closes the stale-approval window between draft creation/approval and post.
  if not exists (
    select 1
    from epr_bom_inventory_mappings m
    where m.venture=o.venture
      and m.sku=o.sku
      and m.unit=o.unit
      and m.status='active'
      and m.effective_from<=now()
      and (m.effective_to is null or m.effective_to>now())
  ) then
    raise exception 'Opening balance requires an active BOM-SKU mapping for the same venture, SKU and unit.';
  end if;

  perform pg_advisory_xact_lock(hashtext(o.venture || '|' || o.sku || '|' || o.unit)::bigint);

  select coalesce(sum(quantity_delta),0)
  into v_balance
  from epr_inventory_ledger
  where venture=o.venture and sku=o.sku and unit=o.unit;

  if exists (
    select 1
    from epr_inventory_opening_balances
    where venture=o.venture and sku=o.sku and unit=o.unit and status='posted'
  ) then
    raise exception 'A posted opening balance already exists for %, %, %.',o.venture,o.sku,o.unit;
  end if;

  insert into epr_inventory_movements
    (id,traveller_id,venture,sku,movement_type,quantity,unit,reference,notes,recorded_by)
  values
    (p_movement_id,null,o.venture,o.sku,'opening_balance',o.quantity,o.unit,o.reference,o.notes,p_actor);

  insert into epr_inventory_ledger
    (id,venture,sku,unit,quantity_delta,movement_id,traveller_id,serial_number,reference,notes,recorded_by)
  values
    (p_ledger_id,o.venture,o.sku,o.unit,o.quantity,p_movement_id,null,null,o.reference,o.notes,p_actor);

  insert into epr_inventory_cost_ledger
    (id,venture,sku,unit,quantity_delta,value_delta_inr,movement_id,traveller_id,unit_cost_inr,reference,recorded_by)
  values
    (p_cost_ledger_id,o.venture,o.sku,o.unit,o.quantity,o.quantity*o.unit_cost_inr,p_movement_id,null,o.unit_cost_inr,o.reference,p_actor);

  update epr_inventory_opening_balances
  set status='posted',posted_by=p_actor,posted_at=now()
  where id=p_opening_id;

  insert into epr_audit_events
    (id,venture,entity_type,entity_id,action,actor,payload_json)
  values
    (p_ledger_id || '-AUD',o.venture,'inventory_opening_balance',p_opening_id,'posted',p_actor,
     json_build_object(
       'movementId',p_movement_id,
       'ledgerId',p_ledger_id,
       'sku',o.sku,
       'unit',o.unit,
       'quantity',o.quantity,
       'unitCostInr',o.unit_cost_inr,
       'reference',o.reference
     )::text);

  return query select p_movement_id,p_ledger_id,v_balance+o.quantity;
end; $$;
