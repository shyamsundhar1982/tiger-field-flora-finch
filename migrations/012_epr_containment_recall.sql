create table if not exists epr_containment_cases (
  id text primary key,
  venture text not null check (venture in ('carbon','aluminium')),
  source_type text not null check (source_type in ('material_lot','process_operation','equipment','operator','method','inspection','ncr_capa','serial')),
  source_id text not null,
  reason text not null,
  severity text not null default 'major' check (severity in ('minor','major','critical')),
  status text not null default 'open' check (status in ('open','contained','released','closed','rejected')),
  created_by text not null,
  created_at timestamptz not null default now(),
  closed_by text,
  closed_at timestamptz,
  notes text not null default ''
);

create table if not exists epr_containment_targets (
  id text primary key,
  case_id text not null references epr_containment_cases(id) on delete cascade,
  traveller_id text not null references epr_travellers(id) on delete restrict,
  serial_number text not null,
  action text not null default 'quarantine' check (action in ('quarantine','hold','rework','recall','release')),
  status text not null default 'active' check (status in ('active','cleared')),
  created_at timestamptz not null default now(),
  cleared_by text,
  cleared_at timestamptz,
  notes text not null default ''
);

create unique index if not exists epr_containment_target_active_unique
  on epr_containment_targets (case_id, traveller_id, action)
  where status = 'active';
create index if not exists epr_containment_target_serial_idx
  on epr_containment_targets (serial_number, status);
create index if not exists epr_containment_case_source_idx
  on epr_containment_cases (source_type, source_id, status);

create table if not exists epr_release_blocks (
  id text primary key,
  traveller_id text not null references epr_travellers(id) on delete cascade,
  case_id text not null references epr_containment_cases(id) on delete restrict,
  reason text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  cleared_at timestamptz,
  cleared_by text
);

create unique index if not exists epr_release_block_active_unique
  on epr_release_blocks (traveller_id, case_id)
  where active = true;

create or replace function epr_create_containment_case(
  p_id text,
  p_venture text,
  p_source_type text,
  p_source_id text,
  p_reason text,
  p_severity text,
  p_actor text,
  p_notes text default ''
) returns void
language plpgsql
as $$
declare
  v_case text;
begin
  insert into epr_containment_cases(id,venture,source_type,source_id,reason,severity,created_by,notes)
  values (p_id,p_venture,p_source_type,p_source_id,p_reason,p_severity,p_actor,p_notes);

  insert into epr_audit_events(id,venture,event_type,entity_type,entity_id,actor,payload_json,created_at)
  values ('AUD-'||md5(random()::text||clock_timestamp()::text),p_venture,'containment_opened','containment_case',p_id,p_actor,jsonb_build_object('source_type',p_source_type,'source_id',p_source_id,'reason',p_reason),now());
end;
$$;

create or replace function epr_apply_containment_target(
  p_id text,
  p_case_id text,
  p_traveller_id text,
  p_action text,
  p_actor text,
  p_notes text default ''
) returns void
language plpgsql
as $$
declare
  v_case_venture text;
  v_traveller_venture text;
  v_serial text;
begin
  select venture into v_case_venture from epr_containment_cases where id=p_case_id for update;
  if v_case_venture is null then raise exception 'Containment case not found'; end if;
  select venture,serial_number into v_traveller_venture,v_serial from epr_travellers where id=p_traveller_id for update;
  if v_traveller_venture is null then raise exception 'Traveller not found'; end if;
  if v_case_venture <> v_traveller_venture then raise exception 'Venture mismatch'; end if;

  insert into epr_containment_targets(id,case_id,traveller_id,serial_number,action,notes)
  values(p_id,p_case_id,p_traveller_id,v_serial,p_action,p_notes);

  if p_action in ('quarantine','hold','recall','rework') then
    insert into epr_release_blocks(id,traveller_id,case_id,reason)
    values('RB-'||md5(random()::text||clock_timestamp()::text),p_traveller_id,p_case_id,(select reason from epr_containment_cases where id=p_case_id));
  end if;

  insert into epr_audit_events(id,venture,event_type,entity_type,entity_id,actor,payload_json,created_at)
  values ('AUD-'||md5(random()::text||clock_timestamp()::text),v_case_venture,'containment_targeted','containment_target',p_id,p_actor,jsonb_build_object('case_id',p_case_id,'traveller_id',p_traveller_id,'serial_number',v_serial,'action',p_action),now());
end;
$$;

create or replace function epr_clear_containment_target(
  p_target_id text,
  p_actor text,
  p_notes text default ''
) returns void
language plpgsql
as $$
declare
  v_case text;
  v_traveller text;
  v_venture text;
begin
  select t.case_id,t.traveller_id,c.venture into v_case,v_traveller,v_venture
  from epr_containment_targets t join epr_containment_cases c on c.id=t.case_id
  where t.id=p_target_id for update;
  if v_case is null then raise exception 'Containment target not found'; end if;

  update epr_containment_targets set status='cleared',cleared_by=p_actor,cleared_at=now(),notes=case when p_notes='' then notes else p_notes end where id=p_target_id;
  update epr_release_blocks set active=false,cleared_by=p_actor,cleared_at=now() where case_id=v_case and traveller_id=v_traveller and active=true;

  insert into epr_audit_events(id,venture,event_type,entity_type,entity_id,actor,payload_json,created_at)
  values ('AUD-'||md5(random()::text||clock_timestamp()::text),v_venture,'containment_cleared','containment_target',p_target_id,p_actor,jsonb_build_object('case_id',v_case,'traveller_id',v_traveller),now());
end;
$$;

create or replace function epr_traveller_release_blocked(p_traveller_id text)
returns boolean
language sql
stable
as $$
  select exists(select 1 from epr_release_blocks where traveller_id=p_traveller_id and active=true);
$$;
