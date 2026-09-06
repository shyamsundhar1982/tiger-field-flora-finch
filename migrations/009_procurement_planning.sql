create table if not exists epr_procurement_plan_actions (
  id text primary key,
  scenario text not null check (scenario in ('base','delayed','stress')),
  plan_month integer not null check (plan_month between 1 and 36),
  requirement_month integer not null check (requirement_month between 1 and 36),
  tranche_id text,
  action_type text not null check (action_type in ('plan','rfq','approval','po','receipt','hold')),
  status text not null default 'planned' check (status in ('planned','in_progress','complete','on_hold','cancelled')),
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (scenario, plan_month, requirement_month, tranche_id, action_type)
);

create index if not exists epr_procurement_plan_actions_idx
  on epr_procurement_plan_actions (scenario, requirement_month, status);

comment on table epr_procurement_plan_actions is
  'Controlled procurement planning actions. Planning signals are generated two months before material requirement; financial cash impact remains on the planned receipt/purchase month.';
