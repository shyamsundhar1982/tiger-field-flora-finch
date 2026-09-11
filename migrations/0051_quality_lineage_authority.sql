-- G3: canonical Quality inspection / NCR / CAPA / release authority.
-- Existing static/demo quality arrays are deliberately NOT promoted as canonical evidence.

create table if not exists vyndi_quality_inspections (
  id text primary key,
  inspection_stage text not null check (inspection_stage in ('incoming','in_process','final')),
  inspection_type text not null,
  sales_order_id text references vyndi_sales_orders(id) on delete restrict,
  job_card_id text references epr_production_job_cards(id) on delete restrict,
  traveller_id text references epr_travellers(id) on delete restrict,
  goods_receipt_id text references vyndi_goods_receipts(id) on delete restrict,
  sku text,
  lot_number text,
  serial_number text,
  sample_size numeric(14,4) not null default 1 check (sample_size > 0),
  defect_quantity numeric(14,4) not null default 0 check (defect_quantity >= 0 and defect_quantity <= sample_size),
  result text not null check (result in ('pass','fail','conditional')),
  disposition text not null check (disposition in ('accepted','quarantine','rejected','rework','concession')),
  criteria_ref text not null,
  evidence_ref text not null,
  notes text not null default '',
  recorded_by text not null,
  recorded_role text not null,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    inspection_stage='incoming'
    or job_card_id is not null
    or traveller_id is not null
  )
);

create index if not exists vyndi_quality_inspection_job_idx
  on vyndi_quality_inspections (job_card_id, inspection_stage, recorded_at desc)
  where job_card_id is not null;
create index if not exists vyndi_quality_inspection_traveller_idx
  on vyndi_quality_inspections (traveller_id, inspection_stage, recorded_at desc)
  where traveller_id is not null;
create index if not exists vyndi_quality_inspection_grn_idx
  on vyndi_quality_inspections (goods_receipt_id, recorded_at desc)
  where goods_receipt_id is not null;

create table if not exists vyndi_quality_ncrs (
  id text primary key,
  inspection_id text references vyndi_quality_inspections(id) on delete restrict,
  sales_order_id text references vyndi_sales_orders(id) on delete restrict,
  job_card_id text references epr_production_job_cards(id) on delete restrict,
  traveller_id text references epr_travellers(id) on delete restrict,
  sku text,
  lot_number text,
  serial_number text,
  severity text not null check (severity in ('minor','major','critical')),
  description text not null,
  containment text,
  disposition text,
  status text not null default 'open' check (status in ('open','contained','under_capa','closed','rejected')),
  source_ref text not null,
  created_by text not null,
  created_role text not null,
  closed_by text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vyndi_quality_ncr_job_idx
  on vyndi_quality_ncrs (job_card_id, status, updated_at desc)
  where job_card_id is not null;
create index if not exists vyndi_quality_ncr_traveller_idx
  on vyndi_quality_ncrs (traveller_id, status, updated_at desc)
  where traveller_id is not null;

create table if not exists vyndi_quality_capas (
  id text primary key,
  ncr_id text not null references vyndi_quality_ncrs(id) on delete restrict,
  root_cause text not null,
  corrective_action text not null,
  preventive_action text not null,
  owner text not null,
  due_on date,
  effectiveness_criteria text not null,
  effectiveness_evidence_ref text,
  status text not null default 'open' check (status in ('open','implemented','verified','closed','rejected')),
  source_ref text not null,
  created_by text not null,
  created_role text not null,
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vyndi_quality_capa_ncr_idx
  on vyndi_quality_capas (ncr_id, status, updated_at desc);

create table if not exists vyndi_quality_releases (
  id text primary key,
  traveller_id text not null references epr_travellers(id) on delete restrict,
  job_card_id text not null references epr_production_job_cards(id) on delete restrict,
  sales_order_id text references vyndi_sales_orders(id) on delete restrict,
  serial_number text not null,
  decision text not null check (decision in ('released','blocked')),
  decision_reason text not null,
  evidence_ref text not null,
  decided_by text not null,
  decided_role text not null,
  decided_at timestamptz not null default now(),
  superseded_at timestamptz
);
create unique index if not exists vyndi_quality_release_current_traveller_uq
  on vyndi_quality_releases (traveller_id)
  where superseded_at is null;
create index if not exists vyndi_quality_release_job_idx
  on vyndi_quality_releases (job_card_id, decided_at desc);

create or replace view vyndi_quality_lineage as
select
  c.sales_order_id,
  t.job_card_id,
  t.id as traveller_id,
  t.serial_number,
  t.sku,
  count(i.id)::int as inspection_count,
  count(i.id) filter (where i.result='pass')::int as passed_inspections,
  count(i.id) filter (where i.result in ('fail','conditional'))::int as nonpassing_inspections,
  count(distinct n.id) filter (where n.status not in ('closed','rejected'))::int as open_ncr_count,
  count(distinct cp.id) filter (where cp.status not in ('closed','rejected'))::int as open_capa_count,
  r.decision as quality_release_decision,
  r.evidence_ref as quality_release_evidence_ref,
  r.decided_at as quality_release_decided_at
from epr_travellers t
left join epr_production_job_cards c on c.id=t.job_card_id
left join vyndi_quality_inspections i on i.traveller_id=t.id
left join vyndi_quality_ncrs n on n.traveller_id=t.id
left join vyndi_quality_capas cp on cp.ncr_id=n.id
left join vyndi_quality_releases r on r.traveller_id=t.id and r.superseded_at is null
group by c.sales_order_id,t.job_card_id,t.id,t.serial_number,t.sku,r.decision,r.evidence_ref,r.decided_at;

comment on table vyndi_quality_inspections is
  'Canonical Quality inspection evidence. Static UI sample records are not canonical and are not migrated here.';
comment on table vyndi_quality_releases is
  'Auditable final quality release/block decision tied to one serialized Production traveller.';
