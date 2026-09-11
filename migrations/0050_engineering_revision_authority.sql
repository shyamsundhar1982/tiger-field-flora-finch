-- G2: canonical Engineering revision and ECR authority.
-- Replaces client/static release truth with server-backed lifecycle records.

create table if not exists vyndi_engineering_baselines (
  id text primary key,
  family_code text not null references vyndi_product_families(family_code),
  variant_id text references vyndi_product_variants(variant_id),
  revision_code text not null,
  record_revision integer not null default 1 check (record_revision > 0),
  status text not null default 'draft' check (status in ('draft','pending_approval','released','superseded')),
  geometry_ref text not null,
  material_spec text not null,
  layup_ref text,
  alloy_spec text,
  tooling_ref text,
  drawing_ref text not null,
  bom_revision text,
  source_ref text not null,
  created_by text not null,
  approved_by text,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vyndi_engineering_baseline_revision_uq
  on vyndi_engineering_baselines (family_code, coalesce(variant_id,''), revision_code);
create index if not exists vyndi_engineering_baseline_family_idx
  on vyndi_engineering_baselines (family_code, status, updated_at desc);

create table if not exists vyndi_engineering_change_requests (
  id text primary key,
  family_code text not null references vyndi_product_families(family_code),
  variant_id text references vyndi_product_variants(variant_id),
  from_baseline_id text references vyndi_engineering_baselines(id),
  target_revision_code text not null,
  target_bom_revision text,
  title text not null,
  reason text not null,
  bom_cost_delta_inr numeric(14,2) not null default 0,
  weight_delta_g numeric(14,2) not null default 0,
  production_impact_pct numeric(8,4) not null default 0,
  inventory_impact_lakh numeric(14,4) not null default 0,
  affected_skus jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open','pending_approval','approved','implemented','rejected')),
  record_revision integer not null default 1 check (record_revision > 0),
  source_ref text not null,
  created_by text not null,
  submitted_by text,
  decided_by text,
  implemented_by text,
  implemented_baseline_id text references vyndi_engineering_baselines(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vyndi_engineering_ecr_family_idx
  on vyndi_engineering_change_requests (family_code, status, updated_at desc);

insert into vyndi_engineering_baselines
  (id,family_code,variant_id,revision_code,record_revision,status,geometry_ref,material_spec,layup_ref,alloy_spec,tooling_ref,drawing_ref,bom_revision,source_ref,created_by,approved_by,released_at)
values
  ('ENG-LATITUDE-C3','latitude',null,'C3',1,'released','Race endurance geometry · Rev C','High-modulus carbon','C3 production layup',null,'Carbon frame mould set C','VX-CARBON-C3',null,'CUTOVER:src/lib/finance/engineering-engine.ts','system:migration','system:migration',now()),
  ('ENG-LONGITUDE-A2','longitude',null,'A2',1,'released','All-road geometry · Rev A','6061-T6 aluminium',null,'6061-T6','Aluminium jig set A','VX-ALU-A2',null,'CUTOVER:src/lib/finance/engineering-engine.ts','system:migration','system:migration',now()),
  ('ENG-ALTITUDE-C2','altitude',null,'C2',1,'released','Aero performance geometry · Rev B','High-modulus carbon','C2 production layup',null,'Altitude mould set B','VX-APEX-C2',null,'CUTOVER:src/lib/finance/engineering-engine.ts','system:migration','system:migration',now())
on conflict (id) do update set
  family_code=excluded.family_code,
  revision_code=excluded.revision_code,
  status=excluded.status,
  geometry_ref=excluded.geometry_ref,
  material_spec=excluded.material_spec,
  layup_ref=excluded.layup_ref,
  alloy_spec=excluded.alloy_spec,
  tooling_ref=excluded.tooling_ref,
  drawing_ref=excluded.drawing_ref,
  source_ref=excluded.source_ref,
  updated_at=now();

insert into vyndi_audit_events
  (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json,correlation_id,gate_id,gate_result,previous_state,new_state,reason)
select
  'AUDIT-CUTOVER-'||b.id,
  'engineering_baseline',
  b.id,
  b.record_revision,
  'ENGINEERING_BASELINE_CUTOVER',
  'system:migration',
  'system',
  b.source_ref,
  jsonb_build_object('familyCode',b.family_code,'revisionCode',b.revision_code,'drawingRef',b.drawing_ref),
  'ENGINEERING|'||b.family_code||'|'||b.revision_code,
  'G03-CONFIG',
  'pass',
  null,
  b.status,
  'Migrated from the previously shipped static Engineering baseline catalogue.'
from vyndi_engineering_baselines b
where b.id in ('ENG-LATITUDE-C3','ENG-LONGITUDE-A2','ENG-ALTITUDE-C2')
on conflict (id) do nothing;

create or replace view vyndi_released_engineering_baselines as
select
  b.id,
  b.family_code,
  f.display_name as family_name,
  b.variant_id,
  v.display_name as variant_name,
  b.revision_code,
  b.record_revision,
  b.geometry_ref,
  b.material_spec,
  b.layup_ref,
  b.alloy_spec,
  b.tooling_ref,
  b.drawing_ref,
  b.bom_revision,
  b.source_ref,
  b.released_at,
  b.updated_at
from vyndi_engineering_baselines b
join vyndi_product_families f on f.family_code=b.family_code
left join vyndi_product_variants v on v.variant_id=b.variant_id
where b.status='released';
