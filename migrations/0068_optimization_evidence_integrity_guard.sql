-- Table-level guards for persisted mathematical-optimization evidence.
-- These constraints apply even when a caller bypasses the persistence function.

alter table vyndi_advanced_optimization_runs
  drop constraint if exists vyndi_advanced_optimization_runs_advisory_ck;
alter table vyndi_advanced_optimization_runs
  add constraint vyndi_advanced_optimization_runs_advisory_ck check (
    governance_json->>'advisoryOnly'='true'
    and governance_json->>'mayCreateTransactions'='false'
    and governance_json->>'humanApprovalRequiredForBusinessAction'='true'
  );

alter table vyndi_advanced_optimization_runs
  drop constraint if exists vyndi_advanced_optimization_runs_acceptance_ck;
alter table vyndi_advanced_optimization_runs
  add constraint vyndi_advanced_optimization_runs_acceptance_ck check (
    not accepted or optimization_status in ('optimal','feasible')
  );

alter table vyndi_advanced_optimization_runs
  drop constraint if exists vyndi_advanced_optimization_runs_objective_ck;
alter table vyndi_advanced_optimization_runs
  add constraint vyndi_advanced_optimization_runs_objective_ck check (
    objective_value is null or optimization_status in ('optimal','feasible')
  );

create or replace function block_vyndi_advanced_optimization_run_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'Persisted optimization run % cannot be deleted; use governed invalidation.',old.id;
end;
$$;

drop trigger if exists trg_block_vyndi_advanced_optimization_run_delete on vyndi_advanced_optimization_runs;
create trigger trg_block_vyndi_advanced_optimization_run_delete
before delete on vyndi_advanced_optimization_runs
for each row execute function block_vyndi_advanced_optimization_run_delete();
