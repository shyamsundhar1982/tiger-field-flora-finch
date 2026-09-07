-- VYNDI canonical business truth foundation.
-- Reconciles Sales -> Production -> Inventory -> Procurement and creates the
-- shared revision/audit primitives needed to retire browser-local management truth.
--
-- IMPORTANT: this migration does NOT copy, delete, reverse, or post any historical
-- Master Inventory lot. Legacy lot reconciliation is report-only until an admin
-- explicitly reviews/approves a cutover against a production backup.

-- ---------------------------------------------------------------------------
-- 1. Shared append-only business audit contract (not venture-specific).
-- ---------------------------------------------------------------------------
create table if not exists vyndi_audit_events (
  id text primary key,
  entity_type text not null,
  entity_id text not null,
  entity_revision integer,
  action text not null,
  actor_user_id text not null,
  actor_role text not null,
  source_reference text,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists vyndi_audit_entity_idx
  on vyndi_audit_events (entity_type, entity_id, created_at desc);
create index if not exists vyndi_audit_actor_idx
  on vyndi_audit_events (actor_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Central Sales authority. Browser state may cache/draft but cannot own an
--    order commitment after this schema is wired into Commercial.
-- ---------------------------------------------------------------------------
create table if not exists vyndi_sales_orders (
  id text primary key,
  revision integer not null default 1 check (revision > 0),
  plan_month integer not null check (plan_month between 1 and 36),
  product_id text not null check (product_id in ('aluminium','carbon','premiumCarbon')),
  units numeric(14,4) not null check (units > 0),
  asp_lakh numeric(14,4) not null check (asp_lakh >= 0),
  channel text not null check (channel in ('direct','dealer','online')),
  status text not null check (status in ('lead','confirmed','delivered','cancelled')),
  model_tier text check (model_tier in ('core','pro','apex')),
  variant_id text,
  variant_name text,
  configuration jsonb not null default '{}'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create index if not exists vyndi_sales_orders_status_month_idx
  on vyndi_sales_orders (status, plan_month, updated_at desc);
create index if not exists vyndi_sales_orders_variant_idx
  on vyndi_sales_orders (variant_id, status) where variant_id is not null;

create table if not exists vyndi_sales_order_revisions (
  id text primary key,
  sales_order_id text not null references vyndi_sales_orders(id) on delete restrict,
  revision integer not null check (revision > 0),
  snapshot jsonb not null,
  change_reason text not null default '',
  actor_user_id text not null,
  actor_role text not null,
  created_at timestamptz not null default now(),
  unique (sales_order_id, revision)
);

create index if not exists vyndi_sales_order_revisions_order_idx
  on vyndi_sales_order_revisions (sales_order_id, revision desc);

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
  perform pg_advisory_xact_lock(hashtext('sales-order|' || p_id)::bigint);
  select revision into v_revision from vyndi_sales_orders where id=p_id for update;
  v_created := not found;
  v_revision := coalesce(v_revision,0)+1;

  insert into vyndi_sales_orders
    (id,revision,plan_month,product_id,units,asp_lakh,channel,status,model_tier,variant_id,variant_name,configuration,created_by,updated_by)
  values
    (p_id,v_revision,p_plan_month,p_product_id,p_units,p_asp_lakh,p_channel,p_status,p_model_tier,p_variant_id,p_variant_name,coalesce(p_configuration,'{}'::jsonb),p_actor_user_id,p_actor_user_id)
  on conflict (id) do update set
    revision=excluded.revision,
    plan_month=excluded.plan_month,
    product_id=excluded.product_id,
    units=excluded.units,
    asp_lakh=excluded.asp_lakh,
    channel=excluded.channel,
    status=excluded.status,
    model_tier=excluded.model_tier,
    variant_id=excluded.variant_id,
    variant_name=excluded.variant_name,
    configuration=excluded.configuration,
    updated_by=excluded.updated_by,
    updated_at=now();

  v_snapshot := jsonb_build_object(
    'id',p_id,'revision',v_revision,'month',p_plan_month,'product',p_product_id,
    'units',p_units,'aspLakh',p_asp_lakh,'channel',p_channel,'status',p_status,
    'modelTier',p_model_tier,'variantId',p_variant_id,'variantName',p_variant_name,
    'configuration',coalesce(p_configuration,'{}'::jsonb));

  insert into vyndi_sales_order_revisions
    (id,sales_order_id,revision,snapshot,change_reason,actor_user_id,actor_role)
  values
    (p_id || '-R' || v_revision,p_id,v_revision,v_snapshot,coalesce(p_change_reason,''),p_actor_user_id,p_actor_role);

  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,payload_json)
  values
    (p_id || '-R' || v_revision || '-AUD','sales_order',p_id,v_revision,
     case when v_created then 'created' else 'revised' end,p_actor_user_id,p_actor_role,v_snapshot);

  return query select p_id,v_revision,v_created;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Make Production a synchronized projection of the current Sales revision and
--    of an approved BOM mapping set, never a one-time browser side effect.
-- ---------------------------------------------------------------------------
alter table epr_production_job_cards
  add column if not exists sales_order_revision integer not null default 1;
alter table epr_production_job_cards
  add column if not exists bom_revision text;
alter table epr_production_job_cards
  add column if not exists released_mapping_set jsonb not null default '[]'::jsonb;
alter table epr_production_job_cards
  add column if not exists updated_by text;

alter table epr_production_job_card_lines
  add column if not exists bom_mapping_id text;
alter table epr_production_job_card_lines
  add column if not exists requirement_revision integer not null default 1;

-- Historical model_id values core/pro/apex are preserved. New controlled mappings
-- may use the exact released variant/model id (e.g. core-tiagra) rather than being
-- blocked by the legacy tier-only check.
alter table epr_bom_inventory_mappings
  drop constraint if exists epr_bom_inventory_mappings_model_id_check;

alter table epr_bom_inventory_mappings
  add column if not exists configuration_category text;
alter table epr_bom_inventory_mappings
  add column if not exists configuration_option_id text;

create index if not exists epr_bom_inventory_mapping_configuration_idx
  on epr_bom_inventory_mappings (venture,model_id,bom_revision,configuration_category,configuration_option_id,status);

comment on column epr_bom_inventory_mappings.configuration_option_id is
  'When populated, this approved BOM mapping is selected only when the customer configuration chooses the matching controlled option id. Null means base/released BOM content.';

-- ---------------------------------------------------------------------------
