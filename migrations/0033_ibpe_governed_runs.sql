-- VYNDI Stage 3 IBPE governed run authority.
-- Advisory only: these records persist snapshots/results/decisions but never mutate
-- Sales, Inventory, Procurement, Production or Accounting transaction truth.

create table if not exists vyndi_ibpe_runs (
  id text primary key,
  engine_version text not null,
  source_sha text not null check (length(trim(source_sha)) >= 7),
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  approved_plan_id text not null references vyndi_plan_revisions(id) on delete restrict,
  approved_plan_revision integer not null check (approved_plan_revision > 0),
  scenario text not null check (scenario in ('base','delayed','stress')),
  horizon_months integer not null check (horizon_months = 36),
  snapshot_at timestamptz not null,
  status text not null default 'complete' check (status in ('complete','invalidated')),
  input_json jsonb not null,
  result_json jsonb not null,
  validation_json jsonb not null default '{}'::jsonb,
  created_by text not null,
  created_role text not null,
  created_at timestamptz not null default now(),
  invalidated_by text,
  invalidated_at timestamptz,
  invalidation_reason text,
  unique(engine_version,source_sha,input_hash,approved_plan_id,approved_plan_revision)
);
create index if not exists vyndi_ibpe_runs_created_idx on vyndi_ibpe_runs(created_at desc);
create index if not exists vyndi_ibpe_runs_plan_idx on vyndi_ibpe_runs(approved_plan_revision desc,created_at desc);

create or replace function persist_vyndi_ibpe_run(
  p_id text,p_engine_version text,p_source_sha text,p_input_hash text,
  p_plan_id text,p_plan_revision integer,p_scenario text,p_snapshot_at timestamptz,
  p_input_json jsonb,p_result_json jsonb,p_validation_json jsonb,
  p_actor_user_id text,p_actor_role text
) returns text
language plpgsql
as $$
declare v_existing text;
begin
  if trim(coalesce(p_engine_version,''))='' then raise exception 'IBPE engine version is required.'; end if;
  if length(trim(coalesce(p_source_sha,'')))<7 then raise exception 'IBPE source SHA is required.'; end if;
  if coalesce(p_input_hash,'') !~ '^[a-f0-9]{64}$' then raise exception 'IBPE input hash must be SHA-256 hex.'; end if;
  if not exists(select 1 from vyndi_plan_revisions where id=p_plan_id and revision=p_plan_revision and status='approved') then
    raise exception 'IBPE requires the exact approved operating-plan revision.';
  end if;
  if p_input_json is null or jsonb_typeof(p_input_json)<>'object' then raise exception 'IBPE governed input snapshot is required.'; end if;
  if p_result_json is null or jsonb_typeof(p_result_json)<>'object' then raise exception 'IBPE deterministic result is required.'; end if;

  perform pg_advisory_xact_lock(hashtext('ibpe|'||p_engine_version||'|'||p_source_sha||'|'||p_input_hash)::bigint);
  select id into v_existing from vyndi_ibpe_runs
   where engine_version=p_engine_version and source_sha=p_source_sha and input_hash=p_input_hash
     and approved_plan_id=p_plan_id and approved_plan_revision=p_plan_revision limit 1;
  if v_existing is not null then return v_existing; end if;

  insert into vyndi_ibpe_runs(
    id,engine_version,source_sha,input_hash,approved_plan_id,approved_plan_revision,
    scenario,horizon_months,snapshot_at,input_json,result_json,validation_json,created_by,created_role)
  values(
    p_id,p_engine_version,p_source_sha,p_input_hash,p_plan_id,p_plan_revision,
    p_scenario,36,p_snapshot_at,p_input_json,p_result_json,coalesce(p_validation_json,'{}'::jsonb),p_actor_user_id,p_actor_role);

  insert into vyndi_audit_events(
    id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
  values(
    'AUD-'||p_id,'ibpe_run',p_id,p_plan_revision,'computed',p_actor_user_id,p_actor_role,p_input_hash,
    jsonb_build_object('engineVersion',p_engine_version,'sourceSha',p_source_sha,'inputHash',p_input_hash,
      'approvedPlanId',p_plan_id,'approvedPlanRevision',p_plan_revision,'scenario',p_scenario));
  return p_id;
end;
$$;

create or replace function invalidate_vyndi_ibpe_runs_for_plan(
  p_plan_id text,p_reason text,p_actor_user_id text,p_actor_role text
) returns integer
language plpgsql
as $$
declare v_count integer;
begin
  if trim(coalesce(p_reason,''))='' then raise exception 'IBPE invalidation reason is required.'; end if;
  update vyndi_ibpe_runs set status='invalidated',invalidated_by=p_actor_user_id,invalidated_at=now(),invalidation_reason=p_reason
   where approved_plan_id=p_plan_id and status='complete';
  get diagnostics v_count = row_count;
  if v_count>0 then
    insert into vyndi_audit_events(id,entity_type,entity_id,action,actor_user_id,actor_role,payload_json)
    values('AUD-IBPE-INVALIDATE-'||p_plan_id||'-'||extract(epoch from clock_timestamp())::bigint,
      'ibpe_plan_runs',p_plan_id,'invalidated',p_actor_user_id,p_actor_role,
      jsonb_build_object('count',v_count,'reason',p_reason));
  end if;
  return v_count;
end;
$$;

comment on table vyndi_ibpe_runs is
  'Reproducible advisory IBPE runs. Persisted outputs require an exact approved plan revision, source SHA and SHA-256 input hash and cannot directly mutate transaction truth.';