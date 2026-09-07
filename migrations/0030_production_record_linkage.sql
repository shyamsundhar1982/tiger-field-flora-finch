-- Canonical Production record linkage.
-- A Production traveller is a serial-controlled child of one released job card.
-- Existing engineering/pilot travellers are preserved as unlinked legacy/specialist records,
-- but reserved Production material may only be issued to a traveller linked to that job card.

alter table epr_travellers
  add column if not exists job_card_id text references epr_production_job_cards(id) on delete restrict;
alter table epr_travellers
  add column if not exists job_card_revision integer;

alter table epr_travellers drop constraint if exists epr_travellers_job_card_link_check;
alter table epr_travellers add constraint epr_travellers_job_card_link_check
  check (
    (job_card_id is null and job_card_revision is null)
    or
    (job_card_id is not null and job_card_revision is not null and job_card_revision > 0)
  );

create index if not exists epr_travellers_job_card_idx
  on epr_travellers (job_card_id, status, created_at)
  where job_card_id is not null;

create or replace view vyndi_production_record_chain as
select
  o.id as sales_order_id,
  o.revision as current_sales_order_revision,
  o.status as sales_order_status,
  c.id as job_card_id,
  c.sales_order_revision as job_card_sales_order_revision,
  c.status as job_card_status,
  c.variant_id,
  c.product_label,
  c.bom_revision,
  c.units as job_card_units,
  t.id as traveller_id,
  t.job_card_revision as traveller_job_card_revision,
  t.serial_number,
  t.status as traveller_status,
  t.model_name,
  t.engineering_revision,
  t.supplier,
  t.created_at as traveller_created_at
from epr_production_job_cards c
join vyndi_sales_orders o on o.id=c.sales_order_id
left join epr_travellers t on t.job_card_id=c.id;

create or replace function raise_epr_traveller_for_job_card(
  p_traveller_id text,
  p_job_card_id text,
  p_serial_number text,
  p_engineering_revision text,
  p_supplier text,
  p_actor_user_id text,
  p_actor_role text
) returns table (
  traveller_id text,
  traveller_status text,
  model_name text,
  bom_revision text,
  sales_order_id text,
  job_card_id text
)
language plpgsql
as $$
declare
  c record;
  v_active_count integer:=0;
  v_model_name text;
  v_venture text;
  v_serial text:=trim(coalesce(p_serial_number,''));
  v_engineering_revision text:=trim(coalesce(p_engineering_revision,''));
  v_supplier text:=trim(coalesce(p_supplier,''));
begin
  select id,sales_order_id,sales_order_revision,status,units,model_tier,variant_id,bom_revision
    into c
    from epr_production_job_cards
   where id=p_job_card_id
   for update;
  if not found then raise exception 'Production job card not found.'; end if;
  if c.status not in ('released','in_progress') then
    raise exception 'Traveller can only be raised for a released or in-progress job card; current status is %.',c.status;
  end if;
  if c.model_tier is null or c.model_tier not in ('core','pro','apex') then
    raise exception 'Job card has no controlled VINDY model tier.';
  end if;
  if c.variant_id is null or trim(c.variant_id)='' then
    raise exception 'Job card has no exact released VINDY variant.';
  end if;
  if c.bom_revision is null or trim(c.bom_revision)='' then
    raise exception 'Job card has no released BOM revision.';
  end if;
  if v_serial='' then raise exception 'Serial number is required.'; end if;
  if v_engineering_revision='' then raise exception 'Engineering revision is required.'; end if;
  if exists(select 1 from epr_travellers where serial_number=v_serial) then
    raise exception 'Serial number % already exists.',v_serial;
  end if;

  select count(*)::integer
    into v_active_count
    from epr_travellers
   where job_card_id=c.id and status<>'rejected';
  if v_active_count >= ceil(c.units)::integer then
    raise exception 'Job card % already has % active/completed traveller(s) for % unit(s).',c.id,v_active_count,c.units;
  end if;

  v_model_name:=case c.model_tier
    when 'core' then 'Longitude'
    when 'pro' then 'Latitude'
    when 'apex' then 'Altitude'
  end;
  v_venture:=case when c.model_tier='core' then 'aluminium' else 'carbon' end;

  insert into epr_travellers
    (id,venture,model_id,model_name,sku,bom_revision,engineering_revision,serial_number,supplier,status,created_by,
     job_card_id,job_card_revision)
  values
    (p_traveller_id,v_venture,c.model_tier,v_model_name,c.variant_id,c.bom_revision,v_engineering_revision,v_serial,v_supplier,
     'draft',p_actor_user_id,c.id,c.sales_order_revision);

  insert into epr_gate_events (id,traveller_id,gate_id,status,actor)
  values ('GATE-' || p_traveller_id || '-EPR04',p_traveller_id,'EPR-04','planned',p_actor_user_id);

  insert into epr_audit_events
    (id,venture,entity_type,entity_id,action,actor,payload_json)
  values
    ('AUD-' || p_traveller_id || '-CREATE',v_venture,'traveller',p_traveller_id,'raised_from_production_job_card',p_actor_user_id,
     json_build_object('jobCardId',c.id,'salesOrderId',c.sales_order_id,'salesOrderRevision',c.sales_order_revision,
       'variantId',c.variant_id,'bomRevision',c.bom_revision,'serialNumber',v_serial)::text);

  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    ('AUD-' || p_traveller_id || '-PROD','production_traveller',p_traveller_id,c.sales_order_revision,
     'raised_from_job_card',p_actor_user_id,p_actor_role,c.id,
     jsonb_build_object('jobCardId',c.id,'salesOrderId',c.sales_order_id,'variantId',c.variant_id,
       'bomRevision',c.bom_revision,'serialNumber',v_serial,'engineeringRevision',v_engineering_revision));

  return query select p_traveller_id,'draft'::text,v_model_name,c.bom_revision,c.sales_order_id,c.id;
end;
$$;

-- Once a physical serial is linked, changing the released order/BOM underneath it
-- would destroy genealogy. Force a controlled production change instead.
create or replace function vyndi_guard_job_card_revision_with_travellers()
returns trigger
language plpgsql
as $$
begin
  if (
    new.sales_order_revision is distinct from old.sales_order_revision
    or new.variant_id is distinct from old.variant_id
    or new.bom_revision is distinct from old.bom_revision
  ) and exists(
    select 1 from epr_travellers t
     where t.job_card_id=old.id and t.status<>'rejected'
  ) then
    raise exception 'Job card % has linked traveller/serial records. Process a controlled production change instead of replacing its released revision.',old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists vyndi_guard_job_card_revision_with_travellers_trigger on epr_production_job_cards;
create trigger vyndi_guard_job_card_revision_with_travellers_trigger
before update of sales_order_revision,variant_id,bom_revision on epr_production_job_cards
for each row execute function vyndi_guard_job_card_revision_with_travellers();

-- Strengthen the final reservation issue guard: compatibility is not enough;
-- the serial must belong to the same Production job card as the reservation.
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
  l record;
  t record;
begin
  select id,job_card_id,job_card_line_id,quantity_reserved,status
    into r
    from epr_inventory_reservations
   where id=p_reservation_id
   for update;
  if not found then raise exception 'Inventory reservation not found.'; end if;
  if r.status<>'active' then
    raise exception 'Only active reservations can be consumed; current status is %.',r.status;
  end if;

  select id,quantity,issue_status
    into l
    from epr_production_job_card_lines
   where id=r.job_card_line_id
   for update;
  if not found then raise exception 'Reserved job-card line not found.'; end if;
  if l.issue_status='issued' then raise exception 'Job-card line is already issued.'; end if;
  if r.quantity_reserved + 0.0001 < l.quantity then
    raise exception 'Partial reservation cannot be posted as a complete material issue: required %, reserved %. Receive/reconcile the shortage before kitting.',
      l.quantity,r.quantity_reserved;
  end if;

  select id,status,job_card_id
    into t
    from epr_travellers
   where id=p_traveller_id
   for update;
  if not found then raise exception 'Traveller not found.'; end if;
  if t.job_card_id is distinct from r.job_card_id then
    raise exception 'Traveller % is not linked to reservation job card %.',p_traveller_id,r.job_card_id;
  end if;
  if t.status not in ('released','in_build') then
    raise exception 'Traveller must be released or in build before reserved material can be issued; current status is %.',t.status;
  end if;

  return query
  select x.movement_id,x.ledger_id,x.resulting_balance,x.cogs_inr
    from consume_epr_inventory_reservation_unchecked(
      p_reservation_id,p_traveller_id,p_movement_id,p_ledger_id,p_actor_user_id,p_actor_role
    ) as x;
end;
$$;
