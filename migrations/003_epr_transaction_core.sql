create table if not exists epr_travellers (
  id text primary key,
  venture text not null check (venture in ('carbon','aluminium')),
  model_id text not null,
  model_name text not null,
  sku text not null,
  bom_revision text not null,
  engineering_revision text not null,
  serial_number text not null unique,
  supplier text not null default '',
  status text not null default 'draft' check (status in ('draft','released','in_build','hold','completed','rejected')),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists epr_evidence (
  id text primary key,
  traveller_id text not null references epr_travellers(id) on delete cascade,
  gate_id text not null,
  evidence_type text not null,
  title text not null,
  reference text not null default '',
  disposition text not null default 'submitted' check (disposition in ('submitted','accepted','rejected')),
  notes text not null default '',
  recorded_by text not null,
  recorded_at timestamptz not null default now()
);

create table if not exists epr_gate_events (
  id text primary key,
  traveller_id text not null references epr_travellers(id) on delete cascade,
  gate_id text not null,
  status text not null check (status in ('planned','in_progress','blocked','passed','hold','rework','rejected')),
  reason text not null default '',
  actor text not null,
  created_at timestamptz not null default now()
);

create table if not exists epr_audit_events (
  id text primary key,
  venture text not null check (venture in ('carbon','aluminium')),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  actor text not null,
  payload_json text not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists epr_travellers_venture_status_idx on epr_travellers (venture, status);
create index if not exists epr_evidence_traveller_gate_idx on epr_evidence (traveller_id, gate_id);
create index if not exists epr_gate_events_traveller_gate_idx on epr_gate_events (traveller_id, gate_id, created_at);
create index if not exists epr_audit_entity_idx on epr_audit_events (entity_type, entity_id, created_at);
