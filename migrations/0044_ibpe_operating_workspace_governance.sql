-- VYNDI IBPE Operating Workspace Phase 1 governance persistence.
-- Additive only: no canonical ERP transaction tables are altered.

create table if not exists vyndi_ibpe_report_snapshots (
  id text primary key,
  schema_version text not null,
  evidence_cutoff timestamptz not null,
  source text not null check (source='canonical-erp-report-pack'),
  payload_json jsonb not null,
  created_by text not null,
  created_by_role text not null,
  created_at timestamptz not null default now()
);

create index if not exists vyndi_ibpe_report_snapshots_created_idx
  on vyndi_ibpe_report_snapshots (created_at desc);

create table if not exists vyndi_ibpe_management_actions (
  id text primary key,
  title text not null,
  classification text not null check (classification in ('KNOWN_FACT','CALCULATED_RESULT','MANAGEMENT_ASSUMPTION','WARNING','RECOMMENDATION','UNKNOWN')),
  issue text not null default '',
  impact text not null default '',
  evidence text not null default '',
  owner text not null default '',
  due_date date,
  recommended_action text not null default '',
  escalation text not null default '',
  status text not null default 'open' check (status in ('open','in_progress','blocked','done','cancelled')),
  revision integer not null default 1 check (revision > 0),
  created_by text not null,
  created_by_role text not null,
  created_at timestamptz not null default now(),
  updated_by text not null,
  updated_by_role text not null,
  updated_at timestamptz not null default now()
);

create index if not exists vyndi_ibpe_management_actions_status_idx
  on vyndi_ibpe_management_actions (status, due_date, updated_at desc);

create table if not exists vyndi_ibpe_decisions (
  id text primary key,
  title text not null,
  decision text not null,
  evidence text not null default '',
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','superseded')),
  revision integer not null default 1 check (revision > 0),
  decided_by text,
  decided_by_role text,
  decided_at timestamptz,
  created_by text not null,
  created_by_role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vyndi_ibpe_decisions_status_idx
  on vyndi_ibpe_decisions (status, updated_at desc);

create table if not exists vyndi_ibpe_business_update_proposals (
  id text primary key,
  raw_input text not null,
  domain text not null check (domain in ('orders','cash','procurement','inventory','production','engineering','customer','compliance','risk','decision','action','unknown')),
  interpretation_json jsonb not null,
  affected_records_json jsonb not null default '[]'::jsonb,
  evidence_json jsonb not null default '[]'::jsonb,
  ambiguity_json jsonb not null default '[]'::jsonb,
  impact_json jsonb not null default '{}'::jsonb,
  status text not null default 'previewed' check (status in ('previewed','confirmed','applied','rejected','blocked')),
  confirmation_note text,
  confirmed_by text,
  confirmed_by_role text,
  confirmed_at timestamptz,
  applied_at timestamptz,
  created_by text not null,
  created_by_role text not null,
  created_at timestamptz not null default now()
);

create index if not exists vyndi_ibpe_business_update_status_idx
  on vyndi_ibpe_business_update_proposals (status, created_at desc);

comment on table vyndi_ibpe_business_update_proposals is
  'Governed IBPE interpretation queue. A confirmed proposal is not itself a canonical ERP transaction; protected-domain application must use an explicitly registered canonical transaction adapter.';
