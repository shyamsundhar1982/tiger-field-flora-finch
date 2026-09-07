-- Runtime reconciliation fixes discovered while tracing the canonical flow.
-- Shared receipts are company stock and are not assigned to a traveller until issue.
alter table epr_inventory_movements alter column traveller_id drop not null;

-- Consume a real Production reservation directly against the released job-card
-- mapping set and the shared FIFO pool. This avoids the legacy tier-only traveller
-- mapping lookup while preserving traveller, BOM, serial, FIFO and COGS provenance.
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
declare
  r record;
  c record;
  l record;
  t record;
  v_balance numeric:=0;
  v_total_reserved numeric:=0;
  v_fifo_cost numeric:=0;
  v_unit_cost numeric:=0;
  v_unit text;
  v_expected_family text;
begin
  select * into r from epr_inventory_reservations where id=p_reservation_id for update;
  if not found then raise exception 'Inventory reservation not found.'; end if;
  if r.status<>'active' then raise exception 'Only active reservations can be consumed; current status is %.',r.status; end if;

  select id,status,variant_id,bom_revision,released_mapping_set,sales_order_id,sales_order_revision
    into c from epr_production_job_cards where id=r.job_card_id for update;
  if not found or c.status not in ('released','in_progress') then
    raise exception 'Reservation job card is not released/in progress.';
  end if;

  select id,job_card_id,sku,unit,quantity,bom_mapping_id
    into l from epr_production_job_card_lines where id=r.job_card_line_id and job_card_id=r.job_card_id for update;
  if not found then raise exception 'Reserved job-card line not found.'; end if;
  if l.sku<>r.sku or vyndi_canonical_unit(l.unit)<>vyndi_canonical_unit(r.unit) then
    raise exception 'Reservation no longer matches the released job-card requirement.';
  end if;
  if l.bom_mapping_id is null or not (coalesce(c.released_mapping_set,'[]'::jsonb) ? l.bom_mapping_id) then
    raise exception 'Reserved line is not part of the job card released BOM mapping set.';
  end if;

  select id,venture,model_id,model_name,serial_number,bom_revision
    into t from epr_travellers where id=p_traveller_id for update;
  if not found then raise exception 'Traveller not found.'; end if;
  v_expected_family:=case
    when c.variant_id like 'core-%' then 'Longitude'
    when c.variant_id like 'pro-%' then 'Latitude'
    when c.variant_id like 'apex-%' then 'Altitude'
    else null end;
  if v_expected_family is not null and t.model_name<>v_expected_family then
    raise exception 'Traveller family % does not match released variant % (%).',t.model_name,c.variant_id,v_expected_family;
  end if;
  if t.bom_revision<>c.bom_revision then
    raise exception 'Traveller BOM revision % does not match released job-card BOM %.',t.bom_revision,c.bom_revision;
  end if;

  v_unit:=vyndi_canonical_unit(r.unit);
  perform pg_advisory_xact_lock(hashtext(upper(trim(r.sku)) || '|' || v_unit)::bigint);

  select coalesce(sum(quantity_delta),0) into v_balance
    from epr_inventory_ledger where sku=upper(trim(r.sku)) and vyndi_canonical_unit(unit)=v_unit;
  select coalesce(sum(quantity_reserved),0) into v_total_reserved
    from epr_inventory_reservations
   where sku=upper(trim(r.sku)) and vyndi_canonical_unit(unit)=v_unit and status='active';
  if v_balance+0.0001 < v_total_reserved then
    raise exception 'Reservation integrity failed for %: physical % is below active reserved %.',r.sku,v_balance,v_total_reserved;
  end if;

  update epr_inventory_reservations
     set status='consumed',consumed_by=p_actor_user_id,consumed_at=now()
   where id=r.id;

  insert into epr_inventory_movements
    (id,traveller_id,venture,sku,movement_type,quantity,unit,reference,notes,recorded_by,effective_on)
  values
    (p_movement_id,p_traveller_id,t.venture,upper(trim(r.sku)),'issue',r.quantity_reserved,v_unit,
     'Job card ' || r.job_card_id || ' / sales order ' || r.sales_order_id,
     'Consumed reservation ' || r.id,p_actor_user_id,current_date);

  insert into epr_inventory_ledger
    (id,venture,sku,unit,quantity_delta,movement_id,traveller_id,serial_number,reference,notes,recorded_by,unit_cost_inr,effective_on)
  values
    (p_ledger_id,t.venture,upper(trim(r.sku)),v_unit,-r.quantity_reserved,p_movement_id,p_traveller_id,t.serial_number,
     'Job card ' || r.job_card_id,'Consumed reservation ' || r.id,p_actor_user_id,0,current_date);

  select coalesce(sum(extended_cost_inr),0) into v_fifo_cost
    from epr_inventory_fifo_allocations where issue_ledger_id=p_ledger_id;
  v_unit_cost:=case when r.quantity_reserved>0 then v_fifo_cost/r.quantity_reserved else 0 end;

  insert into epr_inventory_cost_ledger
    (id,venture,sku,unit,quantity_delta,value_delta_inr,movement_id,traveller_id,unit_cost_inr,reference,recorded_by)
  values
    (p_ledger_id||'-COST',t.venture,upper(trim(r.sku)),v_unit,-r.quantity_reserved,-v_fifo_cost,
     p_movement_id,p_traveller_id,v_unit_cost,'Job card ' || r.job_card_id,p_actor_user_id);

  insert into epr_cogs_entries
    (id,traveller_id,venture,serial_number,sku,unit,quantity,unit_cost_inr,cogs_inr,movement_id)
  values
    (p_ledger_id||'-COGS',p_traveller_id,t.venture,t.serial_number,upper(trim(r.sku)),v_unit,
     r.quantity_reserved,v_unit_cost,v_fifo_cost,p_movement_id);

  update epr_production_job_card_lines
     set issue_status='issued',available_quantity=greatest(available_quantity-r.quantity_reserved,0),shortage_quantity=0
   where id=r.job_card_line_id;

  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    ('AUD-CONSUME-' || r.id || '-' || extract(epoch from clock_timestamp())::bigint,
     'inventory_reservation',r.id,r.sales_order_revision,'consumed_to_fifo_issue',p_actor_user_id,p_actor_role,p_movement_id,
     jsonb_build_object('jobCardId',r.job_card_id,'jobCardLineId',r.job_card_line_id,'travellerId',p_traveller_id,
       'serialNumber',t.serial_number,'variantId',c.variant_id,'bomRevision',c.bom_revision,'bomMappingId',l.bom_mapping_id,
       'sku',r.sku,'unit',v_unit,'quantity',r.quantity_reserved,'fifoCogsInr',v_fifo_cost));

  insert into epr_audit_events
    (id,venture,entity_type,entity_id,action,actor,payload_json)
  values
    (p_ledger_id||'-EPR-AUD',t.venture,'inventory_reservation',r.id,'consumed_to_fifo_issue',p_actor_user_id,
     json_build_object('jobCardId',r.job_card_id,'travellerId',p_traveller_id,'serialNumber',t.serial_number,
       'sku',r.sku,'quantity',r.quantity_reserved,'fifoCogsInr',v_fifo_cost)::text);

  return query select p_movement_id,p_ledger_id,v_balance-r.quantity_reserved,v_fifo_cost;
end;
$$;
