-- Final EPR control layer: controlled opening balances, weighted-average cost,
-- mapping administration support, and release-readiness evidence.
-- UI seed inventory is deliberately NOT imported automatically.

alter table epr_inventory_movements alter column traveller_id drop not null;
alter table epr_inventory_movements drop constraint if exists epr_inventory_movements_movement_type_check;
alter table epr_inventory_movements add constraint epr_inventory_movements_movement_type_check
  check (movement_type in ('reserve','issue','return','consume','opening_balance','adjust'));

create table if not exists epr_inventory_opening_balances (
  id text primary key,
  venture text not null check (venture in ('carbon','aluminium')),
  sku text not null,
  unit text not null,
  quantity numeric(14,4) not null check (quantity > 0),
  unit_cost_inr numeric(14,4) not null check (unit_cost_inr >= 0),
  reference text not null,
  notes text not null default '',
  status text not null default 'draft' check (status in ('draft','approved','posted','rejected')),
  created_by text not null,
  created_at timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz,
  posted_by text,
  posted_at timestamptz
);

create unique index if not exists epr_inventory_opening_balance_posted_unique_idx
  on epr_inventory_opening_balances (venture, sku, unit) where status = 'posted';
create index if not exists epr_inventory_opening_balance_status_idx
  on epr_inventory_opening_balances (venture, status, created_at desc);

create table if not exists epr_inventory_cost_ledger (
  id text primary key,
  venture text not null check (venture in ('carbon','aluminium')),
  sku text not null,
  unit text not null,
  quantity_delta numeric(14,4) not null check (quantity_delta <> 0),
  value_delta_inr numeric(18,4) not null,
  movement_id text not null references epr_inventory_movements(id) on delete restrict,
  traveller_id text references epr_travellers(id) on delete restrict,
  unit_cost_inr numeric(14,4) not null check (unit_cost_inr >= 0),
  reference text not null default '',
  recorded_by text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists epr_inventory_cost_ledger_movement_unique_idx on epr_inventory_cost_ledger (movement_id);
create index if not exists epr_inventory_cost_ledger_balance_idx on epr_inventory_cost_ledger (venture, sku, unit, created_at);

create table if not exists epr_cogs_entries (
  id text primary key,
  traveller_id text not null references epr_travellers(id) on delete restrict,
  venture text not null check (venture in ('carbon','aluminium')),
  serial_number text not null,
  sku text not null,
  unit text not null,
  quantity numeric(14,4) not null check (quantity > 0),
  unit_cost_inr numeric(14,4) not null check (unit_cost_inr >= 0),
  cogs_inr numeric(18,4) not null check (cogs_inr >= 0),
  movement_id text not null references epr_inventory_movements(id) on delete restrict,
  created_at timestamptz not null default now()
);
create unique index if not exists epr_cogs_movement_unique_idx on epr_cogs_entries (movement_id);
create index if not exists epr_cogs_traveller_idx on epr_cogs_entries (traveller_id, created_at);
create index if not exists epr_cogs_venture_idx on epr_cogs_entries (venture, sku, created_at);

comment on table epr_inventory_opening_balances is 'Controlled opening-balance authority. UI seed inventory is never imported automatically.';
comment on table epr_inventory_cost_ledger is 'Append-only weighted-average inventory cost ledger. Opening balances establish the initial cost basis.';
comment on table epr_cogs_entries is 'Authoritative actual COGS generated only by EPR issue/consume postings with an approved cost basis.';

create or replace function post_epr_inventory_opening_balance(
  p_opening_id text, p_movement_id text, p_ledger_id text, p_cost_ledger_id text, p_actor text
) returns table (movement_id text, ledger_id text, resulting_balance numeric)
language plpgsql as $$
declare o record; v_balance numeric;
begin
  select * into o from epr_inventory_opening_balances where id=p_opening_id for update;
  if not found then raise exception 'Opening balance record not found.'; end if;
  if o.status <> 'approved' then raise exception 'Opening balance must be approved before posting.'; end if;
  perform pg_advisory_xact_lock(hashtext(o.venture || '|' || o.sku || '|' || o.unit)::bigint);
  select coalesce(sum(quantity_delta),0) into v_balance from epr_inventory_ledger where venture=o.venture and sku=o.sku and unit=o.unit;
  if exists (select 1 from epr_inventory_opening_balances where venture=o.venture and sku=o.sku and unit=o.unit and status='posted') then
    raise exception 'A posted opening balance already exists for %, %, %.',o.venture,o.sku,o.unit;
  end if;
  insert into epr_inventory_movements (id,traveller_id,venture,sku,movement_type,quantity,unit,reference,notes,recorded_by)
  values (p_movement_id,null,o.venture,o.sku,'opening_balance',o.quantity,o.unit,o.reference,o.notes,p_actor);
  insert into epr_inventory_ledger (id,venture,sku,unit,quantity_delta,movement_id,traveller_id,serial_number,reference,notes,recorded_by)
  values (p_ledger_id,o.venture,o.sku,o.unit,o.quantity,p_movement_id,null,null,o.reference,o.notes,p_actor);
  insert into epr_inventory_cost_ledger (id,venture,sku,unit,quantity_delta,value_delta_inr,movement_id,traveller_id,unit_cost_inr,reference,recorded_by)
  values (p_cost_ledger_id,o.venture,o.sku,o.unit,o.quantity,o.quantity*o.unit_cost_inr,p_movement_id,null,o.unit_cost_inr,o.reference,p_actor);
  update epr_inventory_opening_balances set status='posted',posted_by=p_actor,posted_at=now() where id=p_opening_id;
  insert into epr_audit_events (id,venture,entity_type,entity_id,action,actor,payload_json)
  values (p_ledger_id || '-AUD',o.venture,'inventory_opening_balance',p_opening_id,'posted',p_actor,
    json_build_object('movementId',p_movement_id,'ledgerId',p_ledger_id,'sku',o.sku,'unit',o.unit,'quantity',o.quantity,'unitCostInr',o.unit_cost_inr,'reference',o.reference)::text);
  return query select p_movement_id,p_ledger_id,v_balance+o.quantity;
end; $$;

create or replace function post_epr_inventory_movement(
  p_movement_id text, p_ledger_id text, p_traveller_id text, p_venture text, p_sku text,
  p_movement_type text, p_quantity numeric, p_unit text, p_reference text, p_notes text, p_actor text
) returns table (movement_id text, ledger_id text, resulting_balance numeric, cogs_inr numeric)
language plpgsql as $$
declare t record; m record; v_delta numeric; v_balance numeric; v_cost_qty numeric; v_cost_value numeric; v_unit_cost numeric; v_cogs numeric:=0;
begin
  if p_venture not in ('carbon','aluminium') then raise exception 'Invalid venture.'; end if;
  if p_quantity <= 0 then raise exception 'Quantity must be greater than zero.'; end if;
  if p_movement_type not in ('reserve','issue','return','consume') then raise exception 'Invalid movement type.'; end if;
  select id,venture,model_id,model_name,bom_revision,serial_number into t from epr_travellers where id=p_traveller_id for update;
  if not found then raise exception 'Traveller not found.'; end if;
  if t.venture<>p_venture then raise exception 'Venture scope mismatch.'; end if;
  select id,quantity,unit into m from epr_bom_inventory_mappings
   where venture=t.venture and model_id=t.model_id and bom_revision=t.bom_revision and sku=p_sku and status='active'
     and effective_from<=now() and (effective_to is null or effective_to>now()) order by effective_from desc limit 1;
  if not found then raise exception 'SKU % is not approved for traveller % / BOM %.',p_sku,p_traveller_id,t.bom_revision; end if;
  if m.unit<>p_unit then raise exception 'Unit mismatch: approved % uses %, received %.',p_sku,m.unit,p_unit; end if;
  if p_movement_type='return' then v_delta:=p_quantity; else v_delta:=-p_quantity; end if;
  perform pg_advisory_xact_lock(hashtext(p_venture || '|' || p_sku || '|' || p_unit)::bigint);
  select coalesce(sum(quantity_delta),0) into v_balance from epr_inventory_ledger where venture=p_venture and sku=p_sku and unit=p_unit;
  if v_balance+v_delta<0 then raise exception 'Insufficient authoritative stock for %: balance %, requested %.',p_sku,v_balance,p_quantity; end if;
  select coalesce(sum(quantity_delta),0),coalesce(sum(value_delta_inr),0) into v_cost_qty,v_cost_value from epr_inventory_cost_ledger where venture=p_venture and sku=p_sku and unit=p_unit;
  if p_movement_type in ('issue','consume') and (v_cost_qty<=0 or v_cost_value<0) then raise exception 'No approved inventory cost basis exists for % / %.',p_sku,p_unit; end if;
  if v_cost_qty>0 then v_unit_cost:=v_cost_value/v_cost_qty; else v_unit_cost:=0; end if;
  if p_movement_type in ('issue','consume') then v_cogs:=p_quantity*v_unit_cost; end if;
  insert into epr_inventory_movements (id,traveller_id,venture,sku,movement_type,quantity,unit,reference,notes,recorded_by)
  values (p_movement_id,p_traveller_id,p_venture,p_sku,p_movement_type,p_quantity,p_unit,p_reference,p_notes,p_actor);
  insert into epr_inventory_ledger (id,venture,sku,unit,quantity_delta,movement_id,traveller_id,serial_number,reference,notes,recorded_by)
  values (p_ledger_id,p_venture,p_sku,p_unit,v_delta,p_movement_id,p_traveller_id,t.serial_number,p_reference,p_notes,p_actor);
  if p_movement_type in ('issue','consume','return') then
    insert into epr_inventory_cost_ledger (id,venture,sku,unit,quantity_delta,value_delta_inr,movement_id,traveller_id,unit_cost_inr,reference,recorded_by)
    values (p_ledger_id||'-COST',p_venture,p_sku,p_unit,v_delta,case when p_movement_type='return' then p_quantity*v_unit_cost else -v_cogs end,p_movement_id,p_traveller_id,v_unit_cost,p_reference,p_actor);
  end if;
  if p_movement_type in ('issue','consume') then
    insert into epr_cogs_entries (id,traveller_id,venture,serial_number,sku,unit,quantity,unit_cost_inr,cogs_inr,movement_id)
    values (p_ledger_id||'-COGS',p_traveller_id,p_venture,t.serial_number,p_sku,p_unit,p_quantity,v_unit_cost,v_cogs,p_movement_id);
  end if;
  insert into epr_audit_events (id,venture,entity_type,entity_id,action,actor,payload_json)
  values (p_ledger_id||'-AUD',p_venture,'inventory_movement',p_movement_id,'authoritatively_posted',p_actor,
    json_build_object('ledgerId',p_ledger_id,'travellerId',p_traveller_id,'serialNumber',t.serial_number,'sku',p_sku,'movementType',p_movement_type,'quantity',p_quantity,'unit',p_unit,'quantityDelta',v_delta,'resultingBalance',v_balance+v_delta,'cogsInr',v_cogs)::text);
  return query select p_movement_id,p_ledger_id,v_balance+v_delta,v_cogs;
end; $$;

create or replace view epr_authoritative_inventory_balance as
select l.venture,l.sku,l.unit,coalesce(sum(l.quantity_delta),0) quantity_balance,
  coalesce((select sum(c.value_delta_inr) from epr_inventory_cost_ledger c where c.venture=l.venture and c.sku=l.sku and c.unit=l.unit),0) inventory_value_inr,
  case when coalesce(sum(l.quantity_delta),0)>0 then
    coalesce((select sum(c.value_delta_inr) from epr_inventory_cost_ledger c where c.venture=l.venture and c.sku=l.sku and c.unit=l.unit),0)/sum(l.quantity_delta)
  else 0 end weighted_average_cost_inr
from epr_inventory_ledger l group by l.venture,l.sku,l.unit;
