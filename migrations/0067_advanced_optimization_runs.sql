-- Persisted VYNDI mathematical-optimization evidence.
-- Advisory only: every record explains a solver run over one immutable advanced
-- planning packet. It never mutates Sales, Procurement, Inventory, Production,
-- Finance or Accounting transaction truth.

create table if not exists vyndi_advanced_optimization_runs (
  id text primary key,
  parent_advanced_packet_id text not null references vyndi_advanced_planning_packets(id) on delete restrict,
  request_id text not null,
  contract_version text not null,
  optimizer_id text not null,
  optimizer_version text not null,
  optimizer_engine text not null,
  solver_class text not null check (solver_class in ('lp','milp')),
  deterministic boolean not null,
  accepted boolean not null,
  optimization_status text not null check (optimization_status in ('optimal','feasible','infeasible','indeterminate','error','blocked')),
  objective_value numeric,
  request_json jsonb not null,
  governance_json jsonb not null,
  baseline_json jsonb not null,
  result_json jsonb,
  issues_json jsonb not null default '[]'::jsonb,
  status text not null default 'complete' check (status in ('complete','invalidated')),
  created_by text not null,
  created_role text not null,
  created_at timestamptz not null default now(),
  invalidated_by text,
  invalidated_at timestamptz,
  invalidation_reason text,
  unique(parent_advanced_packet_id,request_id,optimizer_id,optimizer_version)
);

create index if not exists vyndi_advanced_optimization_runs_parent_idx
  on vyndi_advanced_optimization_runs(parent_advanced_packet_id,created_at desc);
create index if not exists vyndi_advanced_optimization_runs_created_idx
  on vyndi_advanced_optimization_runs(created_at desc);

create or replace function persist_vyndi_advanced_optimization_run(
  p_id text,
  p_parent_advanced_packet_id text,
  p_request_id text,
  p_contract_version text,
  p_optimizer_id text,
  p_optimizer_version text,
  p_optimizer_engine text,
  p_solver_class text,
  p_deterministic boolean,
  p_accepted boolean,
  p_optimization_status text,
  p_objective_value numeric,
  p_request_json jsonb,
  p_governance_json jsonb,
  p_baseline_json jsonb,
  p_result_json jsonb,
  p_issues_json jsonb,
  p_actor_user_id text,
  p_actor_role text
) returns text
language plpgsql
as $$
declare
  v_existing text;
  v_parent record;
begin
  if nullif(trim(coalesce(p_id,'')),'') is null then raise exception 'Optimization run ID is required.'; end if;
  if nullif(trim(coalesce(p_request_id,'')),'') is null then raise exception 'Optimization request ID is required.'; end if;
  if nullif(trim(coalesce(p_contract_version,'')),'') is null then raise exception 'Optimization contract version is required.'; end if;
  if nullif(trim(coalesce(p_optimizer_id,'')),'') is null then raise exception 'Optimizer ID is required.'; end if;
  if nullif(trim(coalesce(p_optimizer_version,'')),'') is null then raise exception 'Optimizer version is required.'; end if;
  if nullif(trim(coalesce(p_optimizer_engine,'')),'') is null then raise exception 'Optimizer engine is required.'; end if;
  if nullif(trim(coalesce(p_actor_user_id,'')),'') is null or nullif(trim(coalesce(p_actor_role,'')),'') is null then
    raise exception 'Optimization persistence requires an attributed actor and role.';
  end if;
  if p_solver_class not in ('lp','milp') then raise exception 'Optimization solver class must be lp or milp.'; end if;
  if p_optimization_status not in ('optimal','feasible','infeasible','indeterminate','error','blocked') then
    raise exception 'Unsupported optimization status %.',p_optimization_status;
  end if;
  if p_request_json is null or jsonb_typeof(p_request_json)<>'object' then raise exception 'Optimization request JSON must be an object.'; end if;
  if p_governance_json is null or jsonb_typeof(p_governance_json)<>'object' then raise exception 'Optimization governance JSON must be an object.'; end if;
  if p_baseline_json is null or jsonb_typeof(p_baseline_json)<>'object' then raise exception 'Optimization baseline JSON must be an object.'; end if;
  if p_result_json is not null and jsonb_typeof(p_result_json)<>'object' then raise exception 'Optimization result JSON must be an object when supplied.'; end if;
  if p_issues_json is null or jsonb_typeof(p_issues_json)<>'array' then raise exception 'Optimization issues JSON must be an array.'; end if;
  if coalesce((p_governance_json->>'advisoryOnly')::boolean,false) is distinct from true then
    raise exception 'Only advisory optimization runs can be persisted.';
  end if;
  if coalesce((p_governance_json->>'mayCreateTransactions')::boolean,true) is distinct from false then
    raise exception 'Optimization persistence cannot carry transaction-write authority.';
  end if;
  if coalesce((p_governance_json->>'humanApprovalRequiredForBusinessAction')::boolean,false) is distinct from true then
    raise exception 'Optimization persistence requires human approval for business action.';
  end if;
  if p_accepted and p_optimization_status not in ('optimal','feasible') then
    raise exception 'Accepted optimization runs must have optimal or feasible status.';
  end if;
  if p_objective_value is not null and p_optimization_status not in ('optimal','feasible') then
    raise exception 'Objective value is only valid for optimal or feasible optimization status.';
  end if;

  select id,status into v_parent
    from vyndi_advanced_planning_packets
   where id=p_parent_advanced_packet_id;
  if v_parent.id is null then raise exception 'Parent advanced planning packet was not found.'; end if;
  if v_parent.status<>'complete' then raise exception 'Optimization requires a complete parent advanced planning packet.'; end if;

  perform pg_advisory_xact_lock(hashtext('advanced-optimization|'||p_parent_advanced_packet_id||'|'||p_request_id||'|'||p_optimizer_id||'|'||p_optimizer_version)::bigint);
  select id into v_existing
    from vyndi_advanced_optimization_runs
   where parent_advanced_packet_id=p_parent_advanced_packet_id
     and request_id=p_request_id
     and optimizer_id=p_optimizer_id
     and optimizer_version=p_optimizer_version
   limit 1;
  if v_existing is not null then return v_existing; end if;

  insert into vyndi_advanced_optimization_runs(
    id,parent_advanced_packet_id,request_id,contract_version,optimizer_id,optimizer_version,optimizer_engine,
    solver_class,deterministic,accepted,optimization_status,objective_value,request_json,governance_json,
    baseline_json,result_json,issues_json,created_by,created_role)
  values(
    p_id,p_parent_advanced_packet_id,p_request_id,p_contract_version,p_optimizer_id,p_optimizer_version,p_optimizer_engine,
    p_solver_class,p_deterministic,p_accepted,p_optimization_status,p_objective_value,p_request_json,p_governance_json,
    p_baseline_json,p_result_json,p_issues_json,p_actor_user_id,p_actor_role);

  insert into vyndi_audit_events(
    id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
  values(
    'AUD-'||p_id,'advanced_optimization_run',p_id,'computed',p_actor_user_id,p_actor_role,p_parent_advanced_packet_id,
    jsonb_build_object(
      'parentAdvancedPacketId',p_parent_advanced_packet_id,
      'requestId',p_request_id,
      'contractVersion',p_contract_version,
      'optimizerId',p_optimizer_id,
      'optimizerVersion',p_optimizer_version,
      'optimizerEngine',p_optimizer_engine,
      'solverClass',p_solver_class,
      'deterministic',p_deterministic,
      'accepted',p_accepted,
      'optimizationStatus',p_optimization_status,
      'objectiveValue',p_objective_value,
      'advisoryOnly',true,
      'mayCreateTransactions',false,
      'humanApprovalRequiredForBusinessAction',true));

  return p_id;
end;
$$;

create or replace function guard_vyndi_advanced_optimization_run_mutation()
returns trigger language plpgsql as $$
begin
  if old.status='invalidated' then
    raise exception 'Invalidated optimization run % is immutable.',old.id;
  end if;
  if new.status<>'invalidated' then
    raise exception 'Persisted optimization run % is immutable; only governed invalidation is allowed.',old.id;
  end if;
  if row(
    new.id,new.parent_advanced_packet_id,new.request_id,new.contract_version,new.optimizer_id,new.optimizer_version,
    new.optimizer_engine,new.solver_class,new.deterministic,new.accepted,new.optimization_status,new.objective_value,
    new.request_json,new.governance_json,new.baseline_json,new.result_json,new.issues_json,new.created_by,new.created_role,new.created_at
  ) is distinct from row(
    old.id,old.parent_advanced_packet_id,old.request_id,old.contract_version,old.optimizer_id,old.optimizer_version,
    old.optimizer_engine,old.solver_class,old.deterministic,old.accepted,old.optimization_status,old.objective_value,
    old.request_json,old.governance_json,old.baseline_json,old.result_json,old.issues_json,old.created_by,old.created_role,old.created_at
  ) then
    raise exception 'Optimization evidence % cannot be edited during invalidation.',old.id;
  end if;
  if nullif(trim(coalesce(new.invalidated_by,'')),'') is null or new.invalidated_at is null or nullif(trim(coalesce(new.invalidation_reason,'')),'') is null then
    raise exception 'Optimization invalidation requires actor, time and reason.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_vyndi_advanced_optimization_run on vyndi_advanced_optimization_runs;
create trigger trg_guard_vyndi_advanced_optimization_run
before update on vyndi_advanced_optimization_runs
for each row execute function guard_vyndi_advanced_optimization_run_mutation();

create or replace function invalidate_vyndi_advanced_optimization_run(
  p_id text,p_reason text,p_actor_user_id text,p_actor_role text
) returns text language plpgsql as $$
begin
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Optimization invalidation reason is required.'; end if;
  if nullif(trim(coalesce(p_actor_user_id,'')),'') is null or nullif(trim(coalesce(p_actor_role,'')),'') is null then
    raise exception 'Optimization invalidation requires an attributed actor and role.';
  end if;
  update vyndi_advanced_optimization_runs
     set status='invalidated',invalidated_by=p_actor_user_id,invalidated_at=now(),invalidation_reason=p_reason
   where id=p_id and status='complete';
  if not found then raise exception 'Complete optimization run % was not found.',p_id; end if;
  insert into vyndi_audit_events(id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
  values(
    'AUD-'||p_id||'-INVALIDATE-'||extract(epoch from clock_timestamp())::bigint,
    'advanced_optimization_run',p_id,'invalidated',p_actor_user_id,p_actor_role,p_id,
    jsonb_build_object('reason',p_reason,'advisoryOnly',true));
  return p_id;
end;
$$;

comment on table vyndi_advanced_optimization_runs is
  'Immutable derived advisory mathematical-optimization evidence over one complete advanced planning packet. Persistence grants no transaction authority.';
