create table if not exists epr_bom_inventory_mappings (
  id text primary key,
  venture text not null check (venture in ('carbon','aluminium')),
  model_id text not null check (model_id in ('core','pro','apex')),
  bom_revision text not null,
  bom_line_key text not null,
  sku text not null,
  quantity numeric(14,4) not null check (quantity > 0),
  unit text not null,
  status text not null default 'active' check (status in ('draft','active','superseded','blocked')),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  approved_by text,
  approved_at timestamptz,
  notes text not null default '',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from),
  check ((status = 'active' and approved_by is not null and approved_at is not null) or status <> 'active')
);

create unique index if not exists epr_bom_inventory_mapping_active_unique_idx
  on epr_bom_inventory_mappings (venture, model_id, bom_revision, bom_line_key, sku)
  where status = 'active' and effective_to is null;

create index if not exists epr_bom_inventory_mapping_lookup_idx
  on epr_bom_inventory_mappings (venture, model_id, bom_revision, bom_line_key, status);

create index if not exists epr_bom_inventory_mapping_sku_idx
  on epr_bom_inventory_mappings (sku, venture, model_id, status);

comment on table epr_bom_inventory_mappings is
  'Authoritative BOM-component to inventory-SKU mapping. Empty until explicitly approved; no fuzzy reconciliation.';
comment on column epr_bom_inventory_mappings.bom_line_key is
  'Stable BOM component key, not a free-form display label.';
comment on column epr_bom_inventory_mappings.quantity is
  'Required quantity of the mapped SKU for one configured unit of the BOM line.';
comment on column epr_bom_inventory_mappings.unit is
  'Controlled unit such as ea, pair, set, m, or kg.';
