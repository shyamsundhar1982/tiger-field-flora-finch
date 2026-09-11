-- G4: canonical People & Office authority.
-- Source records are owned here; Finance consumes approved summary/feed views only.
-- Existing zero-value planning templates are seeded as drafts, never as approved actuals.

create table if not exists vyndi_people_records (
  id text primary key,
  display_name text not null,
  function_name text not null,
  role_title text not null,
  engagement_type text not null check (engagement_type in ('employee','contractor','consultant','planned_role')),
  lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft','pending_approval','approved','inactive','superseded')),
  start_month integer check (start_month between 1 and 36),
  end_month integer check (end_month between 1 and 36),
  source_ref text not null,
  notes text not null default '',
  created_by text not null,
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_month is null or start_month is null or end_month >= start_month)
);

create table if not exists vyndi_people_office_cost_items (
  id text primary key,
  cost_group text not null check (cost_group in ('payroll','office','statutory','outsourcing')),
  person_id text references vyndi_people_records(id) on delete restrict,
  name text not null,
  stage text not null,
  quantity numeric(14,4) not null default 1 check (quantity >= 0),
  monthly_unit_cost_lakh numeric(14,4) not null default 0 check (monthly_unit_cost_lakh >= 0),
  start_month integer not null default 1 check (start_month between 1 and 36),
  end_month integer not null default 36 check (end_month between 1 and 36 and end_month >= start_month),
  one_time_cost_lakh numeric(14,4) not null default 0 check (one_time_cost_lakh >= 0),
  one_time_month integer not null default 1 check (one_time_month between 1 and 36),
  lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft','pending_approval','approved','superseded')),
  record_revision integer not null default 1 check (record_revision > 0),
  source_ref text not null,
  notes text not null default '',
  created_by text not null,
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vyndi_people_office_cost_group_idx
  on vyndi_people_office_cost_items (cost_group,lifecycle_status,updated_at desc);

create table if not exists vyndi_people_office_assets (
  id text primary key,
  name text not null,
  category text not null,
  asset_class text not null default 'office_admin' check (asset_class in ('office_admin','office_consumable')),
  cost_lakh numeric(14,4) not null default 0 check (cost_lakh >= 0),
  monthly_cost_lakh numeric(14,4) not null default 0 check (monthly_cost_lakh >= 0),
  purchase_month integer not null default 1 check (purchase_month between 1 and 36),
  useful_life_months integer not null default 60 check (useful_life_months > 0),
  allocation_pct numeric(7,4) not null default 100 check (allocation_pct between 0 and 100),
  lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft','pending_approval','approved','retired','superseded')),
  record_revision integer not null default 1 check (record_revision > 0),
  source_ref text not null,
  notes text not null default '',
  created_by text not null,
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vyndi_people_office_asset_status_idx
  on vyndi_people_office_assets (asset_class,lifecycle_status,updated_at desc);

insert into vyndi_people_office_cost_items
  (id,cost_group,name,stage,quantity,monthly_unit_cost_lakh,start_month,end_month,one_time_cost_lakh,one_time_month,lifecycle_status,source_ref,created_by)
values
  ('people-founder-management','payroll','Founder / management payroll','Foundation',1,0,1,36,0,1,'draft','CUTOVER:DEFAULT_PEOPLE_OFFICE_LEDGER','system:migration'),
  ('people-engineering-operations','payroll','Engineering / operations payroll','Prototype',1,0,1,36,0,1,'draft','CUTOVER:DEFAULT_PEOPLE_OFFICE_LEDGER','system:migration'),
  ('people-finance-admin','payroll','Finance / administration payroll','Foundation',1,0,1,36,0,1,'draft','CUTOVER:DEFAULT_PEOPLE_OFFICE_LEDGER','system:migration'),
  ('people-contract-manpower','payroll','Contract / temporary manpower','Scale',1,0,1,36,0,1,'draft','CUTOVER:DEFAULT_PEOPLE_OFFICE_LEDGER','system:migration'),
  ('office-rent','office','Office / workshop rent','Foundation',1,0,1,36,0,1,'draft','CUTOVER:DEFAULT_PEOPLE_OFFICE_LEDGER','system:migration'),
  ('office-utilities','office','Electricity / utilities','Foundation',1,0,1,36,0,1,'draft','CUTOVER:DEFAULT_PEOPLE_OFFICE_LEDGER','system:migration'),
  ('office-connectivity','office','Internet / communications','Foundation',1,0,1,36,0,1,'draft','CUTOVER:DEFAULT_PEOPLE_OFFICE_LEDGER','system:migration'),
  ('office-facility-services','office','Facility services / insurance','Foundation',1,0,1,36,0,1,'draft','CUTOVER:DEFAULT_PEOPLE_OFFICE_LEDGER','system:migration'),
  ('statutory-ca-gst','statutory','CA / accounting / GST filing','Foundation',1,0,1,36,0,1,'draft','CUTOVER:DEFAULT_PEOPLE_OFFICE_LEDGER','system:migration'),
  ('statutory-cs-roc','statutory','Company secretarial / ROC','Foundation',1,0,1,36,0,1,'draft','CUTOVER:DEFAULT_PEOPLE_OFFICE_LEDGER','system:migration'),
  ('statutory-legal-ip','statutory','Legal / IP / compliance','Validation',1,0,1,36,0,1,'draft','CUTOVER:DEFAULT_PEOPLE_OFFICE_LEDGER','system:migration'),
  ('outsourcing-engineering','outsourcing','Engineering / CAD / analysis outsourcing','Prototype',1,0,1,36,0,1,'draft','CUTOVER:DEFAULT_PEOPLE_OFFICE_LEDGER','system:migration'),
  ('outsourcing-prototype','outsourcing','Prototype / manufacturing support','Prototype',1,0,1,36,0,1,'draft','CUTOVER:DEFAULT_PEOPLE_OFFICE_LEDGER','system:migration'),
  ('outsourcing-marketing','outsourcing','Marketing / creative / agency','Launch',1,0,1,36,0,1,'draft','CUTOVER:DEFAULT_PEOPLE_OFFICE_LEDGER','system:migration'),
  ('outsourcing-it','outsourcing','IT / SaaS / professional services','Foundation',1,0,1,36,0,1,'draft','CUTOVER:DEFAULT_PEOPLE_OFFICE_LEDGER','system:migration')
on conflict (id) do nothing;

insert into vyndi_people_office_assets
  (id,name,category,asset_class,cost_lakh,monthly_cost_lakh,purchase_month,useful_life_months,allocation_pct,lifecycle_status,source_ref,created_by)
values
  ('computers','Computers','IT','office_admin',0,0,1,60,100,'draft','CUTOVER:DEFAULT_EQUIPMENT_LEDGER','system:migration'),
  ('tables-desks','Tables / desks','Furniture','office_admin',0,0,1,60,100,'draft','CUTOVER:DEFAULT_EQUIPMENT_LEDGER','system:migration'),
  ('chairs','Chairs','Furniture','office_admin',0,0,1,60,100,'draft','CUTOVER:DEFAULT_EQUIPMENT_LEDGER','system:migration'),
  ('ac','Air conditioners','Facilities','office_admin',0,0,1,60,100,'draft','CUTOVER:DEFAULT_EQUIPMENT_LEDGER','system:migration'),
  ('water-dispenser','Water dispenser','Facilities','office_admin',0,0,1,60,100,'draft','CUTOVER:DEFAULT_EQUIPMENT_LEDGER','system:migration'),
  ('sofa','Sofa','Furniture','office_admin',0,0,1,60,100,'draft','CUTOVER:DEFAULT_EQUIPMENT_LEDGER','system:migration'),
  ('office-consumables','Office consumables','Administration','office_consumable',0,0,1,12,100,'draft','CUTOVER:DEFAULT_EQUIPMENT_LEDGER','system:migration')
on conflict (id) do nothing;

create or replace view vyndi_people_office_finance_feed as
with months as (select generate_series(1,36)::int as plan_month),
monthly_opex as (
  select m.plan_month,
         coalesce(sum(
           case when c.lifecycle_status='approved' and m.plan_month between c.start_month and c.end_month
                then c.quantity*c.monthly_unit_cost_lakh else 0 end
           + case when c.lifecycle_status='approved' and c.one_time_month=m.plan_month
                then c.one_time_cost_lakh else 0 end
         ),0)::numeric(18,4) as opex_lakh
  from months m cross join vyndi_people_office_cost_items c
  group by m.plan_month
),
asset_months as (
  select m.plan_month,
         coalesce(sum(case when a.lifecycle_status='approved' and a.asset_class='office_admin' and a.purchase_month=m.plan_month then a.cost_lakh else 0 end),0)::numeric(18,4) as capex_lakh,
         coalesce(sum(case when a.lifecycle_status='approved' and a.asset_class='office_admin'
                           and m.plan_month>=a.purchase_month and m.plan_month<a.purchase_month+a.useful_life_months
                      then (a.cost_lakh/a.useful_life_months)*(a.allocation_pct/100) else 0 end),0)::numeric(18,4) as depreciation_lakh,
         coalesce(sum(case when a.lifecycle_status='approved' and a.asset_class='office_consumable' and m.plan_month>=a.purchase_month
                      then a.monthly_cost_lakh*(a.allocation_pct/100) else 0 end),0)::numeric(18,4) as consumables_lakh
  from months m cross join vyndi_people_office_assets a
  group by m.plan_month
)
select m.plan_month,
       coalesce(o.opex_lakh,0)+coalesce(a.consumables_lakh,0) as operating_expense_lakh,
       coalesce(a.capex_lakh,0) as office_capex_lakh,
       coalesce(a.depreciation_lakh,0) as office_depreciation_lakh
from months m
left join monthly_opex o using (plan_month)
left join asset_months a using (plan_month)
order by m.plan_month;

create or replace view vyndi_people_office_authority_summary as
select
  (select count(*)::int from vyndi_people_records where lifecycle_status='approved') as approved_people_records,
  (select count(*)::int from vyndi_people_office_cost_items where lifecycle_status='approved') as approved_cost_items,
  (select count(*)::int from vyndi_people_office_assets where lifecycle_status='approved') as approved_assets,
  (select coalesce(sum(operating_expense_lakh),0) from vyndi_people_office_finance_feed) as approved_36m_opex_lakh,
  (select coalesce(sum(office_capex_lakh),0) from vyndi_people_office_finance_feed) as approved_36m_capex_lakh;

comment on view vyndi_people_office_finance_feed is
  'Finance downstream feed. Only approved People & Office source records contribute; Finance must not duplicate source ownership.';
