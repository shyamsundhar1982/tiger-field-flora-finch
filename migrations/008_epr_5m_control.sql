-- EPR 5M control foundation: Material, Man, Machine, Method, Measurement.
-- This migration creates the authoritative records needed to make execution
-- attributable to qualified people, controlled equipment, approved methods,
-- and measured process/quality parameters.

create table if not exists epr_operators (
  id text primary key,
  employee_ref text not null unique,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists epr_operator_qualifications (
  id text primary key,
  operator_id text not null references epr_operators(id) on delete restrict,
  qualification_code text not null,
  revision text not null default '',
  valid_from timestamptz not null,
  valid_to timestamptz,
  status text not null default 'active' check (status in ('active','expired','suspended','revoked')),
  evidence_reference text not null default '',
  approved_by text not null,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from),
  unique (operator_id, qualification_code, revision)
);

create table if not exists epr_equipment (
  id text primary key,
  asset_tag text not null unique,
  equipment_type text not null,
  description text not null default '',
  status text not null default 'available' check (status in ('available','in_use','maintenance','quarantined','retired')),
  calibration_required boolean not null default false,
  calibration_due_at timestamptz,
  last_calibrated_at timestamptz,
  maintenance_due_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists epr_methods (
  id text primary key,
  method_code text not null,
  revision text not null,
  title text not null,
  status text not null default 'draft' check (status in ('draft','approved','superseded','blocked')),
  approved_by text,
  approved_at timestamptz,
  effective_from timestamptz,
  created_at timestamptz not null default now(),
  unique (method_code, revision)
);

create table if not exists epr_process_parameters (
  id text primary key,
  traveller_id text not null references epr_travellers(id) on delete cascade,
  operation_id text references epr_process_operations(id) on delete restrict,
  method_id text references epr_methods(id) on delete restrict,
  parameter_code text not null,
  parameter_name text not null,
  nominal_value numeric,
  lower_limit numeric,
  upper_limit numeric,
  actual_value numeric not null,
  unit text not null,
  result text not null check (result in ('pass','fail','conditional')),
  recorded_by text not null,
  recorded_at timestamptz not null default now(),
  check (lower_limit is null or upper_limit is null or lower_limit <= upper_limit),
  check (lower_limit is null or actual_value >= lower_limit or result <> 'pass'),
  check (upper_limit is null or actual_value <= upper_limit or result <> 'pass')
);

create table if not exists epr_operation_controls (
  id text primary key,
  traveller_id text not null references epr_travellers(id) on delete cascade,
  operation_id text not null references epr_process_operations(id) on delete cascade,
  operator_id text not null references epr_operators(id) on delete restrict,
  qualification_id text not null references epr_operator_qualifications(id) on delete restrict,
  equipment_id text references epr_equipment(id) on delete restrict,
  method_id text not null references epr_methods(id) on delete restrict,
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null default 'open' check (status in ('open','completed','blocked','rework')),
  created_at timestamptz not null default now(),
  check (completed_at is null or completed_at >= started_at)
);

create table if not exists epr_e_signatures (
  id text primary key,
  traveller_id text not null references epr_travellers(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  signer_operator_id text references epr_operators(id) on delete restrict,
  signer_identity text not null,
  signature_type text not null check (signature_type in ('perform','verify','approve','release')),
  meaning text not null,
  signed_at timestamptz not null default now(),
  reason text not null default ''
);

create index if not exists epr_operator_qualifications_validity_idx on epr_operator_qualifications(operator_id,status,valid_from,valid_to);
create index if not exists epr_process_parameters_traveller_idx on epr_process_parameters(traveller_id,recorded_at);
create index if not exists epr_operation_controls_traveller_idx on epr_operation_controls(traveller_id,started_at);
create index if not exists epr_e_signatures_entity_idx on epr_e_signatures(entity_type,entity_id,signed_at);
