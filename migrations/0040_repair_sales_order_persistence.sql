-- Repair the canonical Commercial demand persistence contract.
-- Re-declare the function against the current sales-order schema so deployed
-- databases cannot retain an older/stale function body after incremental releases.

create or replace function save_vyndi_sales_order(
  p_id text,
  p_plan_month integer,
  p_product_id text,
  p_units numeric,
  p_asp_lakh numeric,
  p_channel text,
  p_status text,
  p_model_tier text,
  p_variant_id text,
  p_variant_name text,
  p_configuration jsonb,
  p_change_reason text,
  p_actor_user_id text,
  p_actor_role text
) returns table (sales_order_id text, revision integer, created boolean)
language plpgsql
as $$
declare
  v_revision integer;
  v_created boolean;
  v_snapshot jsonb;
begin
  if p_id is null or btrim(p_id) = '' then
    raise exception 'Sales order id is required.';
  end if;
  if p_plan_month not between 1 and 36 then
    raise exception 'Sales order month must be between 1 and 36.';
  end if;
  if p_units is null or p_units <= 0 then
    raise exception 'Sales order units must be greater than zero.';
  end if;

  perform pg_advisory_xact_lock(hashtext('sales-order|' || p_id)::bigint);

  select so.revision
    into v_revision
    from vyndi_sales_orders as so
   where so.id = p_id
   for update;

  v_created := not found;
  v_revision := coalesce(v_revision, 0) + 1;

  insert into vyndi_sales_orders
    (id,revision,plan_month,product_id,units,asp_lakh,channel,status,
     model_tier,variant_id,variant_name,configuration,created_by,updated_by)
  values
    (p_id,v_revision,p_plan_month,p_product_id,p_units,p_asp_lakh,p_channel,p_status,
     p_model_tier,p_variant_id,p_variant_name,coalesce(p_configuration,'{}'::jsonb),
     p_actor_user_id,p_actor_user_id)
  on conflict (id) do update set
    revision = excluded.revision,
    plan_month = excluded.plan_month,
    product_id = excluded.product_id,
    units = excluded.units,
    asp_lakh = excluded.asp_lakh,
    channel = excluded.channel,
    status = excluded.status,
    model_tier = excluded.model_tier,
    variant_id = excluded.variant_id,
    variant_name = excluded.variant_name,
    configuration = excluded.configuration,
    updated_by = excluded.updated_by,
    updated_at = now();

  v_snapshot := jsonb_build_object(
    'id',p_id,
    'revision',v_revision,
    'month',p_plan_month,
    'product',p_product_id,
    'units',p_units,
    'aspLakh',p_asp_lakh,
    'channel',p_channel,
    'status',p_status,
    'modelTier',p_model_tier,
    'variantId',p_variant_id,
    'variantName',p_variant_name,
    'configuration',coalesce(p_configuration,'{}'::jsonb)
  );

  insert into vyndi_sales_order_revisions
    (id,sales_order_id,revision,snapshot,change_reason,actor_user_id,actor_role)
  values
    (p_id || '-R' || v_revision,p_id,v_revision,v_snapshot,
     coalesce(p_change_reason,''),p_actor_user_id,p_actor_role)
  on conflict (sales_order_id, revision) do nothing;

  if not exists (
    select 1 from vyndi_sales_order_revisions
     where sales_order_id = p_id and revision = v_revision
  ) then
    raise exception 'Sales-order revision receipt was not persisted.';
  end if;

  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,payload_json)
  values
    (p_id || '-R' || v_revision || '-AUD','sales_order',p_id,v_revision,
     case when v_created then 'created' else 'revised' end,
     p_actor_user_id,p_actor_role,v_snapshot)
  on conflict (id) do nothing;

  return query select p_id,v_revision,v_created;
end;
$$;
