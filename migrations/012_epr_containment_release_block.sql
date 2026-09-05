create table if not exists epr_containment_cases (
  id text primary key,
  venture text not null check (venture in ('carbon','aluminium')),
  case_type text not null check (case_type in ('containment','recall','quarantine','field_action')),
  source_entity_type text not null default '',
  source_entity_id text not null default '',
  severity text not null default 'major' check (severity in ('minor','major','critical')),
  title text not null,
  reason text not null,
  status text not null default 'open' check (status in ('open','cleared','cancelled')),
  created_by text not null,
  created_at timestamptz not null default now(),
  cleared_by text,
  cleared_at timestamptz,
  clearance_reference text not null default '',
  check ((status = 'open' and cleared_at is null) or status <> 'open')
);

create table if not exists epr_containment_targets (
  id text primary key,
  case_id text not null references epr_containment_cases(id) on delete cascade,
  traveller_id text not null references epr_travellers(id) on delete cascade,
  venture text not null check (venture in ('carbon','aluminium')),
  serial_number text not null,
  disposition text not null default 'held' check (disposition in ('held','quarantine','rework','scrap','released')),
  created_by text not null,
  created_at timestamptz not null default now(),
  released_by text,
  released_at timestamptz,
  release_reference text not null default '',
  unique (case_id, traveller_id)
);

create index if not exists epr_containment_cases_active_idx
  on epr_containment_cases (venture, status, created_at);

create index if not exists epr_containment_targets_traveller_idx
  on epr_containment_targets (traveller_id, disposition);

create index if not exists epr_containment_targets_serial_idx
  on epr_containment_targets (venture, serial_number, disposition);

create or replace view epr_active_release_blocks as
select
  t.traveller_id,
  t.venture,
  t.serial_number,
  c.id as containment_case_id,
  c.case_type,
  c.severity,
  c.title,
  c.reason,
  t.disposition,
  c.created_at
from epr_containment_targets t
join epr_containment_cases c on c.id = t.case_id
where c.status = 'open'
  and t.disposition in ('held','quarantine','rework','scrap');
