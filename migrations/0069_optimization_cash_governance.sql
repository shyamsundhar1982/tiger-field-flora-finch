-- Cash-governance evidence for mathematical optimization.
-- Historical optimization evidence remains readable; new cash-aware runs may
-- persist the independently governed treasury acceptance result.

alter table vyndi_advanced_optimization_runs
  add column if not exists cash_guardrail_status text
    check (cash_guardrail_status is null or cash_guardrail_status in ('feasible','infeasible','indeterminate','not-evaluated')),
  add column if not exists cash_guardrail_json jsonb;

alter table vyndi_advanced_optimization_runs
  drop constraint if exists vyndi_advanced_optimization_runs_cash_json_ck;
alter table vyndi_advanced_optimization_runs
  add constraint vyndi_advanced_optimization_runs_cash_json_ck check (
    cash_guardrail_json is null or jsonb_typeof(cash_guardrail_json)='object'
  );

alter table vyndi_advanced_optimization_runs
  drop constraint if exists vyndi_advanced_optimization_runs_cash_acceptance_ck;
alter table vyndi_advanced_optimization_runs
  add constraint vyndi_advanced_optimization_runs_cash_acceptance_ck check (
    not accepted or cash_guardrail_status is null or cash_guardrail_status='feasible'
  );

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
    new.request_json,new.governance_json,new.baseline_json,new.result_json,new.issues_json,
    new.cash_guardrail_status,new.cash_guardrail_json,new.created_by,new.created_role,new.created_at
  ) is distinct from row(
    old.id,old.parent_advanced_packet_id,old.request_id,old.contract_version,old.optimizer_id,old.optimizer_version,
    old.optimizer_engine,old.solver_class,old.deterministic,old.accepted,old.optimization_status,old.objective_value,
    old.request_json,old.governance_json,old.baseline_json,old.result_json,old.issues_json,
    old.cash_guardrail_status,old.cash_guardrail_json,old.created_by,old.created_role,old.created_at
  ) then
    raise exception 'Optimization evidence % cannot be edited during invalidation.',old.id;
  end if;
  if nullif(trim(coalesce(new.invalidated_by,'')),'') is null or new.invalidated_at is null or nullif(trim(coalesce(new.invalidation_reason,'')),'') is null then
    raise exception 'Optimization invalidation requires actor, time and reason.';
  end if;
  return new;
end;
$$;

comment on column vyndi_advanced_optimization_runs.cash_guardrail_status is
  'Independent governed treasury acceptance state. Mathematical solver status remains in optimization_status.';
comment on column vyndi_advanced_optimization_runs.cash_guardrail_json is
  'Reserve-preserving liquidity evaluation derived from the exact governed IBPE cash authority for this optimization lineage.';
