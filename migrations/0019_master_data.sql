create table if not exists master_data_records (
  id uuid primary key,
  domain text not null check (domain in ('product','bom','material','supplier','price','inventory','process','quality','epr','finance','document')),
  code text not null,
  name text not null,
  revision integer not null default 1 check (revision > 0),
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','superseded')),
  owner_role text not null,
  approver_role text not null,
  effective_from date,
  source_ref text,
  attributes jsonb not null default '{}'::jsonb,
  created_by text not null,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists master_data_code_revision_uq
  on master_data_records (domain, code, revision);
create index if not exists master_data_domain_status_idx
  on master_data_records (domain, status);
create index if not exists master_data_effective_idx
  on master_data_records (domain, code, effective_from desc);

create table if not exists master_data_audit_events (
  id uuid primary key,
  master_data_id uuid not null references master_data_records(id),
  event_type text not null,
  actor_user_id text not null,
  actor_role text not null,
  from_status text,
  to_status text,
  note text,
  source_ref text,
  created_at timestamptz not null default now()
);

create index if not exists master_data_audit_master_idx
  on master_data_audit_events (master_data_id, created_at desc);
