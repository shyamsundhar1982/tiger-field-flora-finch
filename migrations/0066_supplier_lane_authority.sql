-- P0 advanced planning: supplier+SKU planning lane authority.
-- The supplier master remains the supplier authority and procurement prices remain
-- purchase-price evidence. This revision owns only planning-lane facts that must
-- not be inferred: lane lead time, order policy, landed cost, reliability method,
-- finite capacity and alternate-source rank.

create table if not exists vyndi_supplier_lane_revisions (
  id text primary key,
  supplier_id text not null references vyndi_suppliers(id) on delete restrict,
  sku text not null references master_inventory_items(sku) on delete restrict,
  revision_code text not null,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  effective_from date not null,
  effective_to date,
  planning_period_days numeric(10,4) not null default 30 check (planning_period_days > 0),
  horizon_periods integer not null default 36 check (horizon_periods between 1 and 60),
  lead_time_days integer,
  moq numeric(14,4),
  order_multiple numeric(14,4),
  alternate_rank integer,
  landed_unit_cost_inr numeric(16,4),
  landed_cost_source_ref text,
  reliability numeric(9,6),
  reliability_method text,
  reliability_source_ref text,
  policy_source_ref text,
  source_ref text not null,
  record_revision integer not null default 1 check (record_revision > 0),
  created_by text not null,
  created_role text not null,
  approved_by text,
  approved_role text,
  approved_at timestamptz,
  retired_by text,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sku=upper(sku)),
  check (effective_to is null or effective_to >= effective_from),
  check (lead_time_days is null or lead_time_days between 0 and 730),
  check (moq is null or moq >= 0),
  check (order_multiple is null or order_multiple > 0),
  check (alternate_rank is null or alternate_rank > 0),
  check (landed_unit_cost_inr is null or landed_unit_cost_inr > 0),
  check (reliability is null or (reliability >= 0 and reliability <= 1)),
  unique (supplier_id,sku,revision_code)
);

create table if not exists vyndi_supplier_lane_capacity (
  lane_revision_id text not null references vyndi_supplier_lane_revisions(id) on delete cascade,
  period integer not null check (period between 1 and 60),
  max_qty numeric(14,4) not null check (max_qty >= 0),
  source_ref text not null,
  primary key (lane_revision_id,period)
);

create index if not exists vyndi_supplier_lane_identity_effectivity_idx
  on vyndi_supplier_lane_revisions(supplier_id,sku,status,effective_from,effective_to);
create index if not exists vyndi_supplier_lane_sku_effectivity_idx
  on vyndi_supplier_lane_revisions(sku,status,effective_from,effective_to);

create or replace function approve_vyndi_supplier_lane_revision(
  p_revision_id text,
  p_actor_user_id text,
  p_actor_role text,
  p_source_reference text default null
) returns text language plpgsql as $$
declare
  v_lane vyndi_supplier_lane_revisions%rowtype;
  v_capacity_count integer;
begin
  select * into v_lane from vyndi_supplier_lane_revisions where id=p_revision_id for update;
  if not found then raise exception 'Supplier lane revision % does not exist',p_revision_id; end if;
  if v_lane.status<>'draft' then raise exception 'Only draft supplier lane revisions can be approved'; end if;
  if nullif(trim(coalesce(p_actor_user_id,'')),'') is null or nullif(trim(coalesce(p_actor_role,'')),'') is null then
    raise exception 'Supplier lane approval requires an attributed actor and role';
  end if;
  if not exists(select 1 from vyndi_suppliers where id=v_lane.supplier_id and active=true and approval_status='approved') then
    raise exception 'Supplier lane requires an active approved supplier';
  end if;
  if not exists(select 1 from master_inventory_items where sku=v_lane.sku and active=true) then
    raise exception 'Supplier lane requires an active controlled Master Inventory SKU';
  end if;
  if v_lane.lead_time_days is null then raise exception 'Supplier lane lead time evidence is required'; end if;
  if v_lane.moq is null or v_lane.order_multiple is null or v_lane.alternate_rank is null then
    raise exception 'Supplier lane order policy and alternate rank are required';
  end if;
  if v_lane.landed_unit_cost_inr is null or nullif(trim(coalesce(v_lane.landed_cost_source_ref,'')),'') is null then
    raise exception 'Supplier lane landed-cost value and source evidence are required';
  end if;
  if v_lane.reliability is null or nullif(trim(coalesce(v_lane.reliability_method,'')),'') is null
     or nullif(trim(coalesce(v_lane.reliability_source_ref,'')),'') is null then
    raise exception 'Supplier lane reliability value, governed method and source evidence are required';
  end if;
  if nullif(trim(coalesce(v_lane.policy_source_ref,'')),'') is null then
    raise exception 'Supplier lane order-policy evidence is required';
  end if;

  select count(*) into v_capacity_count
    from vyndi_supplier_lane_capacity
   where lane_revision_id=p_revision_id and period between 1 and v_lane.horizon_periods;
  if v_capacity_count<>v_lane.horizon_periods then
    raise exception 'Supplier lane finite capacity must cover every planning period: expected %, found %',v_lane.horizon_periods,v_capacity_count;
  end if;

  if exists(
    select 1 from vyndi_supplier_lane_capacity
     where lane_revision_id=p_revision_id and period>v_lane.horizon_periods
  ) then
    raise exception 'Supplier lane capacity contains periods beyond the governed horizon';
  end if;

  if exists(
    select 1 from vyndi_supplier_lane_revisions other
     where other.supplier_id=v_lane.supplier_id and other.sku=v_lane.sku
       and other.status='approved' and other.id<>p_revision_id
       and daterange(other.effective_from,coalesce(other.effective_to,'infinity'::date),'[]')
           && daterange(v_lane.effective_from,coalesce(v_lane.effective_to,'infinity'::date),'[]')
  ) then
    raise exception 'Approved supplier lane effectivity overlaps an existing approved revision for supplier % SKU %',v_lane.supplier_id,v_lane.sku;
  end if;

  update vyndi_supplier_lane_revisions
     set status='approved',approved_by=p_actor_user_id,approved_role=p_actor_role,approved_at=now(),
         record_revision=record_revision+1,updated_at=now()
   where id=p_revision_id;

  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,
     payload_json,correlation_id,gate_id,gate_result,previous_state,new_state,reason)
  values
    ('AUDIT-SUPPLIER-LANE-APPROVE-'||p_revision_id||'-'||extract(epoch from clock_timestamp())::bigint,
     'supplier_lane_revision',p_revision_id,v_lane.record_revision+1,'SUPPLIER_LANE_REVISION_APPROVED',
     p_actor_user_id,p_actor_role,coalesce(nullif(trim(p_source_reference),''),v_lane.source_ref),
     jsonb_build_object('supplierId',v_lane.supplier_id,'sku',v_lane.sku,'revisionCode',v_lane.revision_code,
                        'effectiveFrom',v_lane.effective_from,'effectiveTo',v_lane.effective_to,
                        'reliabilityMethod',v_lane.reliability_method,'horizonPeriods',v_lane.horizon_periods),
     'SUPPLIER-LANE|'||v_lane.supplier_id||'|'||v_lane.sku||'|'||v_lane.revision_code,
     'ADV-SUPPLIER-LANE','pass','draft','approved','Approved supplier planning lane authority.');
  return p_revision_id;
end; $$;

create or replace function retire_vyndi_supplier_lane_revision(
  p_revision_id text,p_actor_user_id text,p_actor_role text,p_reason text
) returns text language plpgsql as $$
declare v_lane vyndi_supplier_lane_revisions%rowtype;
begin
  select * into v_lane from vyndi_supplier_lane_revisions where id=p_revision_id for update;
  if not found then raise exception 'Supplier lane revision % does not exist',p_revision_id; end if;
  if v_lane.status<>'approved' then raise exception 'Only approved supplier lane revisions can be retired'; end if;
  if nullif(trim(coalesce(p_actor_user_id,'')),'') is null or nullif(trim(coalesce(p_actor_role,'')),'') is null then
    raise exception 'Supplier lane retirement requires an attributed actor and role';
  end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Supplier lane retirement requires a reason'; end if;
  update vyndi_supplier_lane_revisions
     set status='retired',retired_by=p_actor_user_id,retired_at=now(),record_revision=record_revision+1,updated_at=now()
   where id=p_revision_id;
  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,
     payload_json,correlation_id,gate_id,gate_result,previous_state,new_state,reason)
  values
    ('AUDIT-SUPPLIER-LANE-RETIRE-'||p_revision_id||'-'||extract(epoch from clock_timestamp())::bigint,
     'supplier_lane_revision',p_revision_id,v_lane.record_revision+1,'SUPPLIER_LANE_REVISION_RETIRED',
     p_actor_user_id,p_actor_role,v_lane.source_ref,
     jsonb_build_object('supplierId',v_lane.supplier_id,'sku',v_lane.sku,'revisionCode',v_lane.revision_code),
     'SUPPLIER-LANE|'||v_lane.supplier_id||'|'||v_lane.sku||'|'||v_lane.revision_code,
     'ADV-SUPPLIER-LANE','pass','approved','retired',p_reason);
  return p_revision_id;
end; $$;

create or replace function guard_vyndi_supplier_lane_revision_lifecycle()
returns trigger language plpgsql as $$
begin
  if tg_op='INSERT' then
    if new.status<>'draft' then raise exception 'New supplier lane revisions must begin in draft state'; end if;
    if new.approved_by is not null or new.approved_role is not null or new.approved_at is not null
       or new.retired_by is not null or new.retired_at is not null then
      raise exception 'Draft supplier lane revisions cannot carry approval or retirement evidence';
    end if;
    return new;
  end if;

  if old.status='retired' then raise exception 'Retired supplier lane revision % is immutable',old.id; end if;

  if old.status='draft' and new.status='draft' then
    if new.approved_by is not null or new.approved_role is not null or new.approved_at is not null
       or new.retired_by is not null or new.retired_at is not null then
      raise exception 'Draft supplier lane revisions cannot carry approval or retirement evidence';
    end if;
    return new;
  end if;

  if old.status='draft' and new.status='approved' then
    if nullif(trim(coalesce(new.approved_by,'')),'') is null or nullif(trim(coalesce(new.approved_role,'')),'') is null or new.approved_at is null then
      raise exception 'Supplier lane approval requires approver, role and timestamp evidence';
    end if;
    if new.record_revision<>old.record_revision+1 then raise exception 'Supplier lane approval must increment record revision exactly once'; end if;
    if new.retired_by is not null or new.retired_at is not null then raise exception 'Approved supplier lane cannot carry retirement evidence'; end if;
    return new;
  end if;

  if old.status='approved' and new.status='approved' then
    if row(new.supplier_id,new.sku,new.revision_code,new.effective_from,new.effective_to,new.planning_period_days,
           new.horizon_periods,new.lead_time_days,new.moq,new.order_multiple,new.alternate_rank,new.landed_unit_cost_inr,
           new.landed_cost_source_ref,new.reliability,new.reliability_method,new.reliability_source_ref,new.policy_source_ref,
           new.source_ref,new.approved_by,new.approved_role,new.approved_at,new.record_revision)
       is distinct from
       row(old.supplier_id,old.sku,old.revision_code,old.effective_from,old.effective_to,old.planning_period_days,
           old.horizon_periods,old.lead_time_days,old.moq,old.order_multiple,old.alternate_rank,old.landed_unit_cost_inr,
           old.landed_cost_source_ref,old.reliability,old.reliability_method,old.reliability_source_ref,old.policy_source_ref,
           old.source_ref,old.approved_by,old.approved_role,old.approved_at,old.record_revision) then
      raise exception 'Approved supplier lane revision % is immutable; create a new revision instead',old.id;
    end if;
    return new;
  end if;

  if old.status='approved' and new.status='retired' then
    if nullif(trim(coalesce(new.retired_by,'')),'') is null or new.retired_at is null then raise exception 'Supplier lane retirement requires actor and timestamp evidence'; end if;
    if new.record_revision<>old.record_revision+1 then raise exception 'Supplier lane retirement must increment record revision exactly once'; end if;
    return new;
  end if;

  raise exception 'Invalid supplier lane lifecycle transition % -> %',old.status,new.status;
end; $$;

create trigger trg_guard_vyndi_supplier_lane_revision_lifecycle
before insert or update on vyndi_supplier_lane_revisions
for each row execute function guard_vyndi_supplier_lane_revision_lifecycle();

create or replace function guard_vyndi_supplier_lane_capacity_mutation()
returns trigger language plpgsql as $$
declare v_lane_id text; v_status text;
begin
  if tg_op='DELETE' then v_lane_id:=old.lane_revision_id; else v_lane_id:=new.lane_revision_id; end if;
  select status into v_status from vyndi_supplier_lane_revisions where id=v_lane_id;
  if v_status in ('approved','retired') then
    raise exception 'Capacity of released supplier lane revision % is immutable; create a new revision instead',v_lane_id;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;

create trigger trg_guard_vyndi_supplier_lane_capacity
before insert or update or delete on vyndi_supplier_lane_capacity
for each row execute function guard_vyndi_supplier_lane_capacity_mutation();

create or replace view vyndi_approved_supplier_lanes as
select
  l.id as lane_revision_id,l.supplier_id,l.sku,l.revision_code,l.effective_from,l.effective_to,
  l.planning_period_days,l.horizon_periods,l.lead_time_days,l.moq,l.order_multiple,l.alternate_rank,
  l.landed_unit_cost_inr,l.landed_cost_source_ref,l.reliability,l.reliability_method,l.reliability_source_ref,
  l.policy_source_ref,l.source_ref,l.approved_by,l.approved_role,l.approved_at,
  s.approval_status as supplier_approval_status,s.active as supplier_active,s.currency as supplier_currency,
  s.quality_rating,s.delivery_rating,s.source_reference as supplier_source_ref,
  coalesce((select jsonb_agg(jsonb_build_object('period',c.period,'maxQty',c.max_qty,'sourceRef',c.source_ref) order by c.period)
              from vyndi_supplier_lane_capacity c where c.lane_revision_id=l.id),'[]'::jsonb) as capacity_json
from vyndi_supplier_lane_revisions l
join vyndi_suppliers s on s.id=l.supplier_id
where l.status='approved';
