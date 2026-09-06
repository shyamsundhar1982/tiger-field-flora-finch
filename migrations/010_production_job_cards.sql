-- Order-to-production handoff. A confirmed sales order creates a stage-wise production job card.
create table if not exists epr_production_job_cards (
  id text primary key,
  sales_order_id text not null unique,
  product_id text not null,
  product_label text not null,
  units numeric(14,4) not null check (units > 0),
  bom_tier text not null check (bom_tier in ('core','pro','apex')),
  due_month integer not null check (due_month between 1 and 36),
  status text not null default 'released' check (status in ('planned','released','in_progress','hold','complete','cancelled')),
  production_owner text not null default 'operations',
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists epr_production_job_card_lines (
  id text primary key,
  job_card_id text not null references epr_production_job_cards(id) on delete cascade,
  stage_no integer not null check (stage_no > 0),
  stage_code text not null,
  stage_name text not null,
  line_type text not null check (line_type in ('raw_material','component','subassembly','operation')),
  item text not null,
  quantity numeric(14,4) not null check (quantity >= 0),
  unit text not null default 'unit',
  source_bom_line text,
  issue_status text not null default 'pending' check (issue_status in ('pending','reserved','issued','complete','short')),
  created_at timestamptz not null default now()
);

create index if not exists epr_production_job_cards_queue_idx
  on epr_production_job_cards (status, due_month, created_at desc);
create index if not exists epr_production_job_card_lines_stage_idx
  on epr_production_job_card_lines (job_card_id, stage_no, id);

comment on table epr_production_job_cards is
  'Production execution handoff generated from a placed/confirmed sales order. One card per sales order.';
comment on table epr_production_job_card_lines is
  'Stage-wise component, raw-material and production-operation requirements for a job card.';
