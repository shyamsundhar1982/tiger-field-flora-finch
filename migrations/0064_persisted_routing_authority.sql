-- P0 advanced planning: persisted manufacturing routing authority.
-- Keeps routing revision truth separate from EPR execution while linking approved
-- operations to traveller/EPR semantics and governed finite resources.

create table if not exists vyndi_routing_revisions (
  id text primary key,
  product_id text not null,
  revision_code text not null,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  effective_from date not null,
  effective_to date,
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
  check (effective_to is null or effective_to >= effective_from),
  unique (product_id, revision_code)
);

create table if not exists vyndi_routing_operations (
  id text primary key,
  revision_id text not null references vyndi_routing_revisions(id) on delete cascade,
  operation_code text not null,
  sequence integer not null check (sequence > 0),
  run_hours_per_unit numeric(14,6) not null check (run_hours_per_unit > 0),
  setup_hours numeric(14,6) not null default 0 check (setup_hours >= 0),
  yield_pct numeric(9,6) not null default 1 check (yield_pct > 0 and yield_pct <= 1),
  epr_gate_id text,
  traveller_operation text,
  source_ref text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (revision_id, operation_code),
  unique (revision_id, sequence),
  check (epr_gate_id is null or epr_gate_id ~ '^EPR-[0-9]{2}$')
);

create table if not exists vyndi_routing_operation_resources (
  operation_id text not null references vyndi_routing_operations(id) on delete cascade,
  resource_id text not null,
  primary key (operation_id, resource_id)
);

create table if not exists vyndi_routing_operation_predecessors (
  operation_id text not null references vyndi_routing_operations(id) on delete cascade,
  predecessor_operation_id text not null references vyndi_routing_operations(id) on delete cascade,
  primary key (operation_id, predecessor_operation_id),
  check (operation_id <> predecessor_operation_id)
);

create index if not exists vyndi_routing_revision_product_effectivity_idx
  on vyndi_routing_revisions (product_id,status,effective_from,effective_to);
create index if not exists vyndi_routing_operation_revision_sequence_idx
  on vyndi_routing_operations (revision_id,sequence);
create index if not exists vyndi_routing_resource_idx
  on vyndi_routing_operation_resources (resource_id,operation_id);

create or replace function approve_vyndi_routing_revision(
  p_revision_id text,
  p_actor_user_id text,
  p_actor_role text,
  p_source_reference text default null
) returns text
language plpgsql
as $$
declare
  v_revision vyndi_routing_revisions%rowtype;
  v_bad_count integer;
begin
  select * into v_revision
  from vyndi_routing_revisions
  where id=p_revision_id
  for update;

  if not found then
    raise exception 'Routing revision % does not exist', p_revision_id;
  end if;
  if v_revision.status <> 'draft' then
    raise exception 'Only draft routing revisions can be approved; current status=%', v_revision.status;
  end if;
  if nullif(trim(coalesce(p_actor_user_id,'')),'') is null or nullif(trim(coalesce(p_actor_role,'')),'') is null then
    raise exception 'Routing approval requires an attributed actor and role';
  end if;
  if not exists (select 1 from vyndi_routing_operations o where o.revision_id=p_revision_id) then
    raise exception 'Routing revision % has no operations', p_revision_id;
  end if;

  select count(*) into v_bad_count
  from vyndi_routing_operations o
  where o.revision_id=p_revision_id
    and not exists (
      select 1 from vyndi_routing_operation_resources r where r.operation_id=o.id
    );
  if v_bad_count > 0 then
    raise exception 'Routing revision % has % operation(s) without an eligible resource', p_revision_id, v_bad_count;
  end if;

  select count(*) into v_bad_count
  from vyndi_routing_operation_predecessors p
  join vyndi_routing_operations o on o.id=p.operation_id
  join vyndi_routing_operations pred on pred.id=p.predecessor_operation_id
  where o.revision_id=p_revision_id
    and (pred.revision_id<>p_revision_id or pred.sequence>=o.sequence);
  if v_bad_count > 0 then
    raise exception 'Routing revision % has % invalid predecessor link(s)', p_revision_id, v_bad_count;
  end if;

  if exists (
    select 1
    from vyndi_routing_revisions other
    where other.product_id=v_revision.product_id
      and other.status='approved'
      and other.id<>p_revision_id
      and daterange(other.effective_from, coalesce(other.effective_to,'infinity'::date), '[]')
          && daterange(v_revision.effective_from, coalesce(v_revision.effective_to,'infinity'::date), '[]')
  ) then
    raise exception 'Approved routing effectivity overlaps an existing approved revision for product %', v_revision.product_id;
  end if;

  update vyndi_routing_revisions
     set status='approved',
         approved_by=p_actor_user_id,
         approved_role=p_actor_role,
         approved_at=now(),
         record_revision=record_revision+1,
         updated_at=now()
   where id=p_revision_id;

  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,
     payload_json,correlation_id,gate_id,gate_result,previous_state,new_state,reason)
  values
    ('AUDIT-ROUTING-APPROVE-'||p_revision_id||'-'||extract(epoch from clock_timestamp())::bigint,
     'routing_revision',p_revision_id,v_revision.record_revision+1,'ROUTING_REVISION_APPROVED',
     p_actor_user_id,p_actor_role,coalesce(nullif(trim(p_source_reference),''),v_revision.source_ref),
     jsonb_build_object('productId',v_revision.product_id,'revisionCode',v_revision.revision_code,
                        'effectiveFrom',v_revision.effective_from,'effectiveTo',v_revision.effective_to),
     'ROUTING|'||v_revision.product_id||'|'||v_revision.revision_code,
     'ADV-ROUTING','pass','draft','approved','Approved manufacturing-planning routing authority.');

  return p_revision_id;
end;
$$;

create or replace function retire_vyndi_routing_revision(
  p_revision_id text,
  p_actor_user_id text,
  p_actor_role text,
  p_reason text
) returns text
language plpgsql
as $$
declare
  v_revision vyndi_routing_revisions%rowtype;
begin
  select * into v_revision from vyndi_routing_revisions where id=p_revision_id for update;
  if not found then raise exception 'Routing revision % does not exist',p_revision_id; end if;
  if v_revision.status<>'approved' then raise exception 'Only approved routing revisions can be retired'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Retirement requires a reason'; end if;

  update vyndi_routing_revisions
     set status='retired',retired_by=p_actor_user_id,retired_at=now(),record_revision=record_revision+1,updated_at=now()
   where id=p_revision_id;

  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,
     payload_json,correlation_id,gate_id,gate_result,previous_state,new_state,reason)
  values
    ('AUDIT-ROUTING-RETIRE-'||p_revision_id||'-'||extract(epoch from clock_timestamp())::bigint,
     'routing_revision',p_revision_id,v_revision.record_revision+1,'ROUTING_REVISION_RETIRED',
     p_actor_user_id,p_actor_role,v_revision.source_ref,
     jsonb_build_object('productId',v_revision.product_id,'revisionCode',v_revision.revision_code),
     'ROUTING|'||v_revision.product_id||'|'||v_revision.revision_code,
     'ADV-ROUTING','pass','approved','retired',p_reason);
  return p_revision_id;
end;
$$;

create or replace function guard_vyndi_approved_routing_revision_mutation()
returns trigger language plpgsql as $$
begin
  if old.status='approved' then
    if new.status='retired' then
      return new;
    end if;
    if row(
      new.product_id,new.revision_code,new.effective_from,new.effective_to,new.source_ref
    ) is distinct from row(
      old.product_id,old.revision_code,old.effective_from,old.effective_to,old.source_ref
    ) then
      raise exception 'Approved routing revision % is immutable; create a new revision instead',old.id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_vyndi_approved_routing_revision on vyndi_routing_revisions;
create trigger trg_guard_vyndi_approved_routing_revision
before update on vyndi_routing_revisions
for each row execute function guard_vyndi_approved_routing_revision_mutation();

create or replace function guard_vyndi_approved_routing_operation_mutation()
returns trigger language plpgsql as $$
declare
  v_revision_id text;
  v_status text;
begin
  v_revision_id := coalesce(new.revision_id,old.revision_id);
  select status into v_status from vyndi_routing_revisions where id=v_revision_id;
  if v_status='approved' then
    raise exception 'Operations of approved routing revision % are immutable; create a new revision instead',v_revision_id;
  end if;
  return coalesce(new,old);
end;
$$;

drop trigger if exists trg_guard_vyndi_approved_routing_operation on vyndi_routing_operations;
create trigger trg_guard_vyndi_approved_routing_operation
before update or delete on vyndi_routing_operations
for each row execute function guard_vyndi_approved_routing_operation_mutation();

drop trigger if exists trg_guard_vyndi_approved_routing_resource on vyndi_routing_operation_resources;
create trigger trg_guard_vyndi_approved_routing_resource
before insert or update or delete on vyndi_routing_operation_resources
for each row execute function guard_vyndi_approved_routing_operation_mutation();

drop trigger if exists trg_guard_vyndi_approved_routing_predecessor on vyndi_routing_operation_predecessors;
create trigger trg_guard_vyndi_approved_routing_predecessor
before insert or update or delete on vyndi_routing_operation_predecessors
for each row execute function guard_vyndi_approved_routing_operation_mutation();

create or replace view vyndi_approved_routing_operations as
select
  r.id as revision_id,
  r.product_id,
  r.revision_code,
  r.effective_from,
  r.effective_to,
  r.source_ref as revision_source_ref,
  r.approved_by,
  r.approved_role,
  r.approved_at,
  o.id as operation_id,
  o.operation_code,
  o.sequence,
  o.run_hours_per_unit,
  o.setup_hours,
  o.yield_pct,
  o.epr_gate_id,
  o.traveller_operation,
  o.source_ref as operation_source_ref,
  coalesce((select jsonb_agg(rr.resource_id order by rr.resource_id)
              from vyndi_routing_operation_resources rr where rr.operation_id=o.id),'[]'::jsonb) as eligible_resource_ids,
  coalesce((select jsonb_agg(pp.predecessor_operation_id order by pp.predecessor_operation_id)
              from vyndi_routing_operation_predecessors pp where pp.operation_id=o.id),'[]'::jsonb) as predecessor_operation_ids
from vyndi_routing_revisions r
join vyndi_routing_operations o on o.revision_id=r.id
where r.status='approved';
