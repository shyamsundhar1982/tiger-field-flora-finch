-- Live governed optimization persistence boundary.
-- This version requires explicit cash-governance evidence for every new solver
-- run so mathematical feasibility can never be persisted as business-acceptable
-- without reserve-preserving treasury acceptance.

create or replace function persist_vyndi_advanced_optimization_run_v2(
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
  p_cash_guardrail_status text,
  p_cash_guardrail_json jsonb,
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
  if p_cash_guardrail_status not in ('feasible','infeasible','indeterminate','not-evaluated') then
    raise exception 'Unsupported optimization cash-governance status %.',p_cash_guardrail_status;
  end if;
  if p_request_json is null or jsonb_typeof(p_request_json)<>'object' then raise exception 'Optimization request JSON must be an object.'; end if;
  if p_governance_json is null or jsonb_typeof(p_governance_json)<>'object' then raise exception 'Optimization governance JSON must be an object.'; end if;
  if p_baseline_json is null or jsonb_typeof(p_baseline_json)<>'object' then raise exception 'Optimization baseline JSON must be an object.'; end if;
  if p_result_json is not null and jsonb_typeof(p_result_json)<>'object' then raise exception 'Optimization result JSON must be an object when supplied.'; end if;
  if p_issues_json is null or jsonb_typeof(p_issues_json)<>'array' then raise exception 'Optimization issues JSON must be an array.'; end if;
  if p_cash_guardrail_json is not null and jsonb_typeof(p_cash_guardrail_json)<>'object' then raise exception 'Optimization cash-governance JSON must be an object when supplied.'; end if;
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
    raise exception 'Accepted optimization runs must have optimal or feasible mathematical status.';
  end if;
  if p_accepted and p_cash_guardrail_status <> 'feasible' then
    raise exception 'Accepted optimization runs require feasible cash governance.';
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
    baseline_json,result_json,issues_json,cash_guardrail_status,cash_guardrail_json,created_by,created_role)
  values(
    p_id,p_parent_advanced_packet_id,p_request_id,p_contract_version,p_optimizer_id,p_optimizer_version,p_optimizer_engine,
    p_solver_class,p_deterministic,p_accepted,p_optimization_status,p_objective_value,p_request_json,p_governance_json,
    p_baseline_json,p_result_json,p_issues_json,p_cash_guardrail_status,p_cash_guardrail_json,p_actor_user_id,p_actor_role);

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
      'cashGuardrailStatus',p_cash_guardrail_status,
      'advisoryOnly',true,
      'mayCreateTransactions',false,
      'humanApprovalRequiredForBusinessAction',true));

  return p_id;
end;
$$;

comment on function persist_vyndi_advanced_optimization_run_v2 is
  'Persists immutable advisory solver evidence and requires explicit independent cash-governance status for every new live optimization run.';
