-- VIBPE UI assurance: declarative capability registry, runtime observations and exception projection.
-- Audit-only. This migration does not mutate canonical business entities or page ownership.

create table if not exists vyndi_vibpe_ui_capability_registry (
  capability_id text primary key,
  domain text not null,
  route_path text not null,
  capability_name text not null,
  capability_type text not null check (capability_type in ('route','control','form','navigation','state','auth')),
  selector_hint text,
  required_role text,
  expected_service text,
  expected_result text not null,
  critical boolean not null default false,
  active boolean not null default true,
  notes text not null default ''
);

create index if not exists vyndi_vibpe_ui_capability_route_idx
  on vyndi_vibpe_ui_capability_registry(route_path, active);

create table if not exists vyndi_vibpe_ui_observations (
  id text primary key,
  capability_id text not null references vyndi_vibpe_ui_capability_registry(capability_id),
  observed_at timestamptz not null default now(),
  target text not null,
  actor_user_id text,
  actor_role text,
  passed boolean not null,
  observed_result text not null,
  route_path text not null,
  correlation_id text,
  evidence_json jsonb not null default '{}'::jsonb
);

create index if not exists vyndi_vibpe_ui_observation_capability_idx
  on vyndi_vibpe_ui_observations(capability_id, observed_at desc);
create index if not exists vyndi_vibpe_ui_observation_target_idx
  on vyndi_vibpe_ui_observations(target, observed_at desc);

insert into vyndi_vibpe_ui_capability_registry
  (capability_id,domain,route_path,capability_name,capability_type,selector_hint,required_role,expected_service,expected_result,critical,notes)
values
  ('UI-AUTH-SESSION','governance','/command','Command session persists','auth',null,'observe',null,'Authenticated navigation does not return to login',true,'Protects cross-route session continuity'),
  ('UI-SALES-LOAD','commercial','/command/sales','Demand & Orders renders','route',null,'observe',null,'Route renders without error or auth loop',true,'Primary demand entry surface'),
  ('UI-SALES-CONFIRM','commercial','/command/sales','Confirmed demand action','control','button','command',null,'Confirmation control is visible when eligible and persisted state is reflected after refresh',true,'UI must agree with canonical sales-order state'),
  ('UI-BOM-LOAD','engineering','/command/bom-control','BOM Control renders','route',null,'observe',null,'Route renders approved configuration/BOM evidence',true,'BOM authority surface'),
  ('UI-INVENTORY-LOAD','inventory','/command/inventory','Inventory renders','route',null,'observe',null,'Route renders current inventory/requirement state',true,'Inventory readiness surface'),
  ('UI-PROCUREMENT-LOAD','procurement','/command/procurement-planning','Procurement Planning renders','route',null,'observe',null,'Route renders shortages and procurement response state',true,'Procurement response surface'),
  ('UI-PRODUCTION-LOAD','production','/command/production','Production renders','route',null,'observe',null,'Route renders current job-card/release state',true,'Production control surface'),
  ('UI-ACTION-INBOX','governance','/command/actions','Business Action Inbox renders','route',null,'observe',null,'Action Inbox renders without duplicate action surfaces',true,'Governed action lifecycle surface'),
  ('UI-ACTION-LIFECYCLE','governance','/command/actions','Start/Complete lifecycle controls','control','button','command',null,'Exactly one eligible lifecycle control path is available and persisted after refresh',true,'Prevents duplicate popups and lost lifecycle state'),
  ('UI-CONTROL-TOWER','governance','/command/control-tower','Control Tower renders','route',null,'observe',null,'Read-only intelligence surface renders without mutation controls',false,'Assurance and management visibility')
on conflict (capability_id) do update set
  domain=excluded.domain,
  route_path=excluded.route_path,
  capability_name=excluded.capability_name,
  capability_type=excluded.capability_type,
  selector_hint=excluded.selector_hint,
  required_role=excluded.required_role,
  expected_service=excluded.expected_service,
  expected_result=excluded.expected_result,
  critical=excluded.critical,
  active=true,
  notes=excluded.notes;

create or replace view vyndi_vibpe_ui_assurance_exceptions as
with latest as (
  select o.*,
         row_number() over (partition by o.capability_id, o.target order by o.observed_at desc, o.id desc) rn
    from vyndi_vibpe_ui_observations o
), targets as (
  select distinct target from vyndi_vibpe_ui_observations
)
select
  'ui-failure|'||c.capability_id||'|'||l.target as exception_key,
  'ui_capability_failure'::text as exception_type,
  case when c.critical then 'critical' else 'warning' end::text as severity,
  c.domain,
  'ui_capability'::text as entity_type,
  c.capability_id as entity_id,
  null::text as related_entity_type,
  null::text as related_entity_id,
  null::text as gate_id,
  l.correlation_id,
  jsonb_build_object(
    'routePath',c.route_path,
    'capabilityName',c.capability_name,
    'target',l.target,
    'expected',c.expected_result,
    'observed',l.observed_result,
    'observedAt',l.observed_at,
    'runtimeEvidence',l.evidence_json
  ) as evidence_json
from vyndi_vibpe_ui_capability_registry c
join latest l on l.capability_id=c.capability_id and l.rn=1
where c.active=true and l.passed=false;

create or replace view vyndi_vibpe_ui_coverage_summary as
select
  c.domain,
  count(*) filter (where c.active)::int as registered_capabilities,
  count(*) filter (where c.active and x.last_observed_at is not null)::int as observed_capabilities,
  count(*) filter (where c.active and x.last_passed=true)::int as passing_capabilities,
  count(*) filter (where c.active and x.last_passed=false)::int as failing_capabilities,
  max(x.last_observed_at) as last_observed_at
from vyndi_vibpe_ui_capability_registry c
left join lateral (
  select o.observed_at as last_observed_at,o.passed as last_passed
    from vyndi_vibpe_ui_observations o
   where o.capability_id=c.capability_id
   order by o.observed_at desc,o.id desc
   limit 1
) x on true
group by c.domain
order by c.domain;
