create table if not exists phase6a_user_roles (
  user_id text primary key,
  role text not null check (role in ('founder','finance','operations','investor','auditor')),
  assigned_by text not null,
  assigned_at timestamptz not null default now()
);

create table if not exists phase6a_sales_orders (
  id text primary key,
  venture_id text not null check (venture_id in ('carbon','aluminium','consolidated')),
  customer text not null,
  product text not null,
  units integer not null check (units > 0),
  value_inr bigint not null check (value_inr > 0),
  status text not null check (status in ('draft','confirmed','cancelled','completed')),
  month integer not null check (month between 1 and 36),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, venture_id)
);

create table if not exists phase6a_purchase_orders (
  id text primary key,
  venture_id text not null check (venture_id in ('carbon','aluminium','consolidated')),
  supplier text not null,
  sku text not null,
  item text not null,
  qty integer not null check (qty > 0),
  unit_cost_inr bigint not null check (unit_cost_inr >= 0),
  status text not null check (status in ('draft','ordered','received','cancelled')),
  expected_month integer not null check (expected_month between 1 and 36),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists phase6a_production_orders (
  id text primary key,
  venture_id text not null check (venture_id in ('carbon','aluminium','consolidated')),
  sales_order_id text not null,
  product text not null,
  units integer not null check (units > 0),
  status text not null check (status in ('planned','in-production','qc','finished','released','cancelled')),
  qc_passed boolean not null default false,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (sales_order_id, venture_id) references phase6a_sales_orders(id, venture_id)
);

create table if not exists phase6a_inventory_movements (
  id text primary key,
  venture_id text not null check (venture_id in ('carbon','aluminium','consolidated')),
  type text not null check (type in ('receipt','reserve','consume','release','adjustment')),
  sku text not null,
  qty numeric not null check (qty <> 0),
  unit_cost_inr bigint not null check (unit_cost_inr >= 0),
  ref_type text not null,
  ref_id text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists phase6a_decisions (
  id text primary key,
  venture_id text not null check (venture_id in ('carbon','aluminium','consolidated')),
  title text not null,
  impact_inr bigint not null check (impact_inr >= 0),
  status text not null check (status in ('proposed','approved','rejected')),
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists phase6a_decision_transitions (
  id text primary key,
  decision_id text not null references phase6a_decisions(id),
  from_status text not null,
  to_status text not null,
  reason text,
  actor_user_id text not null,
  actor_role text not null check (actor_role in ('founder','finance','operations','investor','auditor')),
  created_at timestamptz not null default now()
);

create table if not exists phase6a_audit_events (
  id text primary key,
  actor_user_id text not null,
  actor_role text not null check (actor_role in ('founder','finance','operations','investor','auditor')),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  decision_id text,
  created_at timestamptz not null default now()
);

create table if not exists phase6a_period_closes (
  id text primary key,
  venture_id text not null check (venture_id in ('carbon','aluminium','consolidated')),
  period_month text not null,
  status text not null check (status in ('open','closed')),
  closed_by text,
  closed_at timestamptz,
  unique (venture_id, period_month)
);

create table if not exists phase6a_monthly_snapshots (
  id text primary key,
  venture_id text not null check (venture_id in ('carbon','aluminium','consolidated')),
  period_month text not null,
  snapshot jsonb not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (venture_id, period_month)
);

create index if not exists phase6a_sales_venture_status_idx on phase6a_sales_orders (venture_id, status, created_at);
create index if not exists phase6a_purchase_venture_status_idx on phase6a_purchase_orders (venture_id, status, created_at);
create index if not exists phase6a_production_venture_status_idx on phase6a_production_orders (venture_id, status, created_at);
create index if not exists phase6a_inventory_venture_sku_idx on phase6a_inventory_movements (venture_id, sku, created_at);
create index if not exists phase6a_decisions_venture_status_idx on phase6a_decisions (venture_id, status, created_at);
create index if not exists phase6a_audit_entity_idx on phase6a_audit_events (entity_type, entity_id, created_at);
create index if not exists phase6a_audit_actor_idx on phase6a_audit_events (actor_user_id, created_at);

create or replace function phase6a_immutable_guard() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', TG_TABLE_NAME;
end;
$$;

drop trigger if exists phase6a_inventory_no_update on phase6a_inventory_movements;
create trigger phase6a_inventory_no_update before update or delete on phase6a_inventory_movements for each row execute function phase6a_immutable_guard();
drop trigger if exists phase6a_audit_no_update on phase6a_audit_events;
create trigger phase6a_audit_no_update before update or delete on phase6a_audit_events for each row execute function phase6a_immutable_guard();
