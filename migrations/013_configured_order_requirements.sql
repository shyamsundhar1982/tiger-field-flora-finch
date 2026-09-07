-- Exact configured demand requirements. Catalogue rates never create inventory;
-- availability is derived from posted authoritative balances.
alter table epr_production_job_cards add column if not exists model_tier text;
alter table epr_production_job_cards add column if not exists variant_id text;
alter table epr_production_job_cards add column if not exists configuration jsonb not null default '{}'::jsonb;

alter table epr_production_job_card_lines add column if not exists sku text;
alter table epr_production_job_card_lines add column if not exists category text;
alter table epr_production_job_card_lines add column if not exists available_quantity numeric(14,4) not null default 0;
alter table epr_production_job_card_lines add column if not exists shortage_quantity numeric(14,4) not null default 0;

create index if not exists epr_production_job_card_lines_shortage_idx
  on epr_production_job_card_lines (shortage_quantity, sku)
  where shortage_quantity > 0;

comment on column epr_production_job_card_lines.shortage_quantity is
  'Configured demand less posted authoritative stock at job-card creation; procurement signal only, never stock.';
