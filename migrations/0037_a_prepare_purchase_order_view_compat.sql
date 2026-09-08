-- Compatibility shim for the PR #44 procurement authority + PR #42 production merge.
-- PostgreSQL cannot CREATE OR REPLACE a view when newly added table columns would
-- shift existing view-column names (supplier_name -> job_card_id). If the PR #42
-- migration has not already been applied, remove the dependent views first so
-- 0037_production_batch_auto_procurement.sql can recreate the status view cleanly.
--
-- Some preview databases may already have the PR #42 migration recorded. In that
-- case leave the views intact; the post-migration reconciliation remains idempotent.
-- The CI/PGLite harness applies SQL files directly without creating _migrations,
-- so detect that case explicitly and treat the production migration as pending.

do $$
declare
  v_production_applied boolean := false;
begin
  if to_regclass('_migrations') is not null then
    execute $q$
      select exists (
        select 1 from _migrations
         where name = '0037_production_batch_auto_procurement.sql'
      )
    $q$ into v_production_applied;
  end if;

  if not v_production_applied then
    drop view if exists vyndi_open_purchase_orders;
    drop view if exists vyndi_purchase_order_status;
  end if;
end;
$$;
