-- Compatibility shim for the PR #44 procurement authority + PR #42 production merge.
-- PostgreSQL cannot CREATE OR REPLACE a view when newly added table columns would
-- shift existing view-column names (supplier_name -> job_card_id). If the PR #42
-- migration has not already been applied, remove the dependent views first so
-- 0037_production_batch_auto_procurement.sql can recreate the status view cleanly.
--
-- Some preview databases may already have the PR #42 migration recorded. In that
-- case leave the views intact; the post-migration reconciliation remains idempotent.

do $$
begin
  if not exists (
    select 1
      from _migrations
     where name = '0037_production_batch_auto_procurement.sql'
  ) then
    drop view if exists vyndi_open_purchase_orders;
    drop view if exists vyndi_purchase_order_status;
  end if;
end;
$$;
