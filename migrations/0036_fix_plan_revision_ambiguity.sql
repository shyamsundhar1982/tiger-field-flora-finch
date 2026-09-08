-- Fix PL/pgSQL output-column/target-column name collision in save_vyndi_plan_draft.
-- The function returns an output column named `revision` and also operates on
-- vyndi_plan_revisions.revision. PostgreSQL can treat unqualified references
-- inside the function body as ambiguous. Prefer table columns when a name can
-- refer to either a PL/pgSQL variable/output parameter or a SQL column.
create or replace function save_vyndi_plan_draft(
  p_id text,
  p_scenario text,
  p_draw_standby boolean,
  p_horizon_months integer,
  p_finance_json jsonb,
  p_accounting_json jsonb,
  p_change_reason text,
  p_actor_user_id text,
  p_actor_role text
) returns table (plan_id text, revision integer)
language plpgsql
as $$
#variable_conflict use_column
declare v_id text; v_revision integer;
begin
  if p_horizon_months<>36 then raise exception 'VYNDI operating plan horizon must remain 36 months.'; end if;
  perform pg_advisory_xact_lock(hashtext('plan-draft|' || p_actor_user_id)::bigint);
  select pr.id,pr.revision into v_id,v_revision
    from vyndi_plan_revisions as pr where pr.created_by=p_actor_user_id and pr.status='draft'
    order by pr.created_at desc limit 1 for update;
  if not found then
    perform pg_advisory_xact_lock(hashtext('vyndi-plan-revision-sequence')::bigint);
    select coalesce(max(pr.revision),0)+1 into v_revision from vyndi_plan_revisions as pr;
    v_id:=p_id;
    insert into vyndi_plan_revisions
      (id,revision,status,horizon_months,scenario,draw_standby,finance_json,accounting_json,change_reason,created_by)
    values
      (v_id,v_revision,'draft',36,p_scenario,p_draw_standby,p_finance_json,p_accounting_json,coalesce(p_change_reason,''),p_actor_user_id);
  else
    update vyndi_plan_revisions set
      horizon_months=36,scenario=p_scenario,draw_standby=p_draw_standby,
      finance_json=p_finance_json,accounting_json=p_accounting_json,
      change_reason=coalesce(p_change_reason,'')
    where id=v_id;
  end if;
  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,payload_json)
  values
    ('AUD-PLAN-DRAFT-' || v_id || '-' || extract(epoch from clock_timestamp())::bigint,
     'operating_plan',v_id,v_revision,'draft_saved',p_actor_user_id,p_actor_role,
     jsonb_build_object('scenario',p_scenario,'horizonMonths',36,'drawStandby',p_draw_standby));
  return query select v_id,v_revision;
end;
$$;
