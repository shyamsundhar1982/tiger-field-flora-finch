create table if not exists epr_material_lots (
  id text primary key,
  traveller_id text not null references epr_travellers(id) on delete cascade,
  venture text not null check (venture in ('carbon','aluminium')),
  material_code text not null,
  material_description text not null,
  lot_number text not null,
  supplier text not null default '',
  certificate_reference text not null default '',
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  unit text not null default 'unit',
  disposition text not null default 'quarantine' check (disposition in ('quarantine','accepted','rejected','consumed')),
  recorded_by text not null,
  created_at timestamptz not null default now(),
  unique (traveller_id, material_code, lot_number)
);

create table if not exists epr_process_operations (
  id text primary key,
  traveller_id text not null references epr_travellers(id) on delete cascade,
  venture text not null check (venture in ('carbon','aluminium')),
  operation_code text not null,
  operation_name text not null,
  workstation text not null default '',
  operator_name text not null default '',
  started_at timestamptz,
  completed_at timestamptz,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','hold','rework','rejected')),
  record_reference text not null default '',
  notes text not null default '',
  recorded_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists epr_inspections (
  id text primary key,
  traveller_id text not null references epr_travellers(id) on delete cascade,
  venture text not null check (venture in ('carbon','aluminium')),
  inspection_type text not null check (inspection_type in ('dimensional','interface','ndt','cosmetic','structural','iso4210')),
  characteristic text not null,
  nominal_value text not null default '',
  measured_value text not null default '',
  acceptance_criteria text not null default '',
  result text not null check (result in ('pending','pass','fail','conditional')),
  evidence_reference text not null default '',
  notes text not null default '',
  inspected_by text not null,
  inspected_at timestamptz not null default now()
);

create table if not exists epr_ncr_capa (
  id text primary key,
  traveller_id text not null references epr_travellers(id) on delete cascade,
  venture text not null check (venture in ('carbon','aluminium')),
  record_type text not null check (record_type in ('ncr','capa')),
  severity text not null default 'minor' check (severity in ('minor','major','critical')),
  title text not null,
  description text not null,
  containment text not null default '',
  root_cause text not null default '',
  corrective_action text not null default '',
  owner text not null default '',
  status text not null default 'open' check (status in ('open','contained','in_progress','closed','rejected')),
  closure_reference text not null default '',
  created_by text not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists epr_inventory_movements (
  id text primary key,
  traveller_id text not null references epr_travellers(id) on delete cascade,
  venture text not null check (venture in ('carbon','aluminium')),
  sku text not null,
  movement_type text not null check (movement_type in ('reserve','issue','return','consume','adjust')),
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null default 'unit',
  reference text not null default '',
  notes text not null default '',
  recorded_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists epr_material_lots_traveller_idx on epr_material_lots (traveller_id, created_at);
create index if not exists epr_process_operations_traveller_idx on epr_process_operations (traveller_id, created_at);
create index if not exists epr_inspections_traveller_idx on epr_inspections (traveller_id, inspected_at);
create index if not exists epr_ncr_capa_traveller_idx on epr_ncr_capa (traveller_id, created_at);
create index if not exists epr_inventory_movements_traveller_idx on epr_inventory_movements (traveller_id, created_at);
