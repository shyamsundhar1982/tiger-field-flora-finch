-- KD-03 database-level guard. Replaces the generic actuals writer after the
-- transaction-derived view exists so direct SQL callers cannot forge revenue,
-- units or receivables by bypassing the server authority.
create or replace function save_vyndi_monthly_actual(
  p_plan_month integer,
  p_revenue numeric,
  p_units numeric,
  p_cogs numeric,
  p_opex numeric,
  p_closing_cash numeric,
  p_inventory numeric,
  p_receivables numeric,
  p_payables numeric,
  p_source_reference text,
  p_verified boolean,
  p_actor_user_id text,
  p_actor_role text
) returns integer
language plpgsql
as $$
declare
  v_revision integer;
  v_snapshot jsonb;
  v_revenue numeric;
  v_units numeric;
  v_receivables numeric;
  v_transaction_verified boolean;
begin
  select revenue,units,receivables into v_revenue,v_units,v_receivables
    from vyndi_monthly_transaction_actuals where plan_month=p_plan_month;
  if not found then raise exception 'Transaction-derived monthly truth unavailable for M%.',p_plan_month; end if;

  if p_revenue is not null and abs(p_revenue-v_revenue)>0.0001 then
    raise exception 'Revenue is transaction-controlled. Supplied % does not reconcile to canonical %.',p_revenue,v_revenue;
  end if;
  if p_units is not null and abs(p_units-v_units)>0.0001 then
    raise exception 'Units are transaction-controlled. Supplied % does not reconcile to canonical %.',p_units,v_units;
  end if;
  if p_receivables is not null and abs(p_receivables-v_receivables)>0.0001 then
    raise exception 'Receivables are transaction-controlled. Supplied % does not reconcile to canonical %.',p_receivables,v_receivables;
  end if;
  if (p_cogs is not null or p_opex is not null or p_closing_cash is not null or p_inventory is not null or p_payables is not null)
     and trim(coalesce(p_source_reference,''))='' then
    raise exception 'Manual management actuals require a source reference.';
  end if;

  v_transaction_verified := (v_revenue<>0 or v_units<>0 or v_receivables<>0);
  perform pg_advisory_xact_lock(hashtext('actual|' || p_plan_month)::bigint);
  select coalesce(revision,0)+1 into v_revision from vyndi_monthly_actuals where plan_month=p_plan_month for update;
  if not found then v_revision:=1; end if;

  insert into vyndi_monthly_actuals
    (plan_month,revision,revenue,units,cogs,opex,closing_cash,inventory,receivables,payables,source_reference,verified,updated_by,updated_at)
  values
    (p_plan_month,v_revision,v_revenue,v_units,p_cogs,p_opex,p_closing_cash,p_inventory,v_receivables,p_payables,
     concat_ws('; ', 'transaction-ledger:M'||p_plan_month, nullif(trim(coalesce(p_source_reference,'')),'')),
     v_transaction_verified,p_actor_user_id,now())
  on conflict (plan_month) do update set
    revision=excluded.revision,revenue=excluded.revenue,units=excluded.units,cogs=excluded.cogs,opex=excluded.opex,
    closing_cash=excluded.closing_cash,inventory=excluded.inventory,receivables=excluded.receivables,payables=excluded.payables,
    source_reference=excluded.source_reference,verified=excluded.verified,updated_by=excluded.updated_by,updated_at=now();

  v_snapshot:=jsonb_build_object(
    'planMonth',p_plan_month,'revision',v_revision,'revenue',v_revenue,'units',v_units,
    'cogs',p_cogs,'opex',p_opex,'closingCash',p_closing_cash,'inventory',p_inventory,
    'receivables',v_receivables,'payables',p_payables,
    'sourceReference',concat_ws('; ', 'transaction-ledger:M'||p_plan_month, nullif(trim(coalesce(p_source_reference,'')),'')),
    'verified',v_transaction_verified,'transactionDerived',true);

  insert into vyndi_monthly_actual_revisions
    (id,plan_month,revision,snapshot,action,actor_user_id,actor_role,source_reference)
  values
    ('ACT-M'||p_plan_month||'-R'||v_revision,p_plan_month,v_revision,v_snapshot,'upserted',p_actor_user_id,p_actor_role,p_source_reference);
  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    ('AUD-ACTUAL-M'||p_plan_month||'-R'||v_revision,'monthly_actual','M'||p_plan_month,v_revision,'reconciled',p_actor_user_id,p_actor_role,p_source_reference,v_snapshot);
  return v_revision;
end;
$$;
