-- VIBPE UI assurance: declarative capability registry, runtime observations and exception projection.
-- Audit-only. This migration does not mutate canonical business entities or page ownership.
-- Reconciled after PR #102; 0056 intentionally follows the canonical authority migrations 0049-0055.

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
  ('UI-PRODUCT-LOAD','product','/command/product','Product authority surface renders','route',null,'observe','product-authority','Route renders without error; canonical backend authority remains distinct from route-binding proof',true,'PR #102 canonical Product backend is full; UI binding is independently observed'),
  ('UI-ENGINEERING-LOAD','engineering','/command/engineering','Engineering authority surface renders','route',null,'observe','engineering-authority','Route renders without error; released baseline/ECR evidence is reachable',true,'UI proof remains independent of backend authority'),
  ('UI-BOM-LOAD','engineering','/command/bom-control','BOM Control renders','route',null,'observe',null,'Route renders approved configuration/BOM evidence',true,'BOM authority surface'),
  ('UI-INVENTORY-LOAD','inventory','/command/inventory','Inventory renders','route',null,'observe',null,'Route renders current inventory/requirement state',true,'Inventory readiness surface'),
  ('UI-PROCUREMENT-LOAD','procurement','/command/procurement-planning','Procurement Planning renders','route',null,'observe',null,'Route renders shortages and procurement response state',true,'Procurement response surface'),
  ('UI-PRODUCTION-LOAD','production','/command/production','Production renders','route',null,'observe',null,'Route renders current job-card/release state',true,'Production control surface'),
  ('UI-QUALITY-LOAD','quality','/command/quality','Quality authority surface renders','route',null,'observe','quality-authority','Route renders without error and exposes Quality control surface',true,'Canonical Quality backend is full; route binding remains independently assured'),
  ('UI-PEOPLE-OFFICE-LOAD','people-office','/command/people-office','People & Office renders','route',null,'observe','people-office-authority','Route renders without error and approved source authority remains accessible',true,'Canonical People & Office backend is full; route binding remains independently assured'),
  ('UI-DISPATCH-VISIBILITY','operations','/command/operations','Operations dispatch visibility renders','route',null,'observe','dispatch-authority','Operations route renders without error; dispatch remains Operations/Fulfilment-owned',true,'Dedicated dispatch page is not implied; this observes the current Operations visibility surface'),
  ('UI-ACTION-INBOX','governance','/command/actions','Business Action Inbox renders','route',null,'observe',null,'Action Inbox renders without duplicate action surfaces',true,'Governed action lifecycle surface'),
  ('UI-ACTION-LIFECYCLE','governance','/command/actions','Start/Complete lifecycle controls','control','button','command',null,'Exactly one eligible lifecycle control path is available and persisted after refresh',true,'Prevents duplicate popups and lost lifecycle state'),
  ('UI-CONTROL-TOWER','governance','/command/control-tower','Control Tower renders','route',null,'observe',null,'Read-only intelligence surface renders without mutation controls',false,'Assurance and management visibility'),
  ('UI-VIBPE-ASSURANCE','governance','/command/ibpe-operating-workspace/assurance','VIBPE Assurance renders','route',null,'observe','vibpe-assurance','Assurance page renders backend coverage, explicit gaps, exceptions and UI observations without mutating business truth',true,'Final assurance visibility surface after PR #102 authority freeze')
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

-- Latest failed observations are failures. Active capabilities with no observation are
-- explicitly UNOBSERVED rather than silently passing.
create or replace view vyndi_vibpe_ui_assurance_exceptions as
with latest as (
  select o.*,
         row_number() over (partition by o.capability_id, o.target order by o.observed_at desc, o.id desc) rn
    from vyndi_vibpe_ui_observations o
), failed as (
  select
    'ui-failure|'||c.capability_id||'|'||l.target as exception_key,
    'ui_capability_failure'::text as exception_type,
    case when c.critical then 'critical' else 'warning' end::text as severity,
    c.domain,
    'ui_capability'::text as entity_type,
    c.capability_id as entity_id,
    null::text as related_entity_type,
    null::text as related_entity_id,
    'G15-AUDIT'::text as gate_id,
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
  where c.active=true and l.passed=false
), unobserved as (
  select
    'ui-unobserved|'||c.capability_id as exception_key,
    'ui_capability_unobserved'::text as exception_type,
    'warning'::text as severity,
    c.domain,
    'ui_capability'::text as entity_type,
    c.capability_id as entity_id,
    null::text as related_entity_type,
    null::text as related_entity_id,
    'G15-AUDIT'::text as gate_id,
    'VIBPE-UI|'||c.capability_id as correlation_id,
    jsonb_build_object(
      'routePath',c.route_path,
      'capabilityName',c.capability_name,
      'expected',c.expected_result,
      'critical',c.critical,
      'status','UNOBSERVED'
    ) as evidence_json
  from vyndi_vibpe_ui_capability_registry c
  where c.active=true
    and not exists (select 1 from vyndi_vibpe_ui_observations o where o.capability_id=c.capability_id)
)
select * from failed
union all
select * from unobserved;

create or replace view vyndi_vibpe_ui_coverage_summary as
select
  c.domain,
  count(*) filter (where c.active)::int as registered_capabilities,
  count(*) filter (where c.active and x.last_observed_at is not null)::int as observed_capabilities,
  count(*) filter (where c.active and x.last_passed=true)::int as passing_capabilities,
  count(*) filter (where c.active and x.last_passed=false)::int as failing_capabilities,
  count(*) filter (where c.active and x.last_observed_at is null)::int as unobserved_capabilities,
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

-- Extend the canonical unified assurance stream established by 0055. UI failures and
-- unobserved capabilities are assurance evidence, not business-source truth.
create or replace view vyndi_vibpe_assurance_exceptions_all as
select exception_key,exception_type,severity,domain,entity_type,entity_id,
       related_entity_type,related_entity_id,gate_id,correlation_id,evidence_json
  from vyndi_vibpe_assurance_exceptions
union all
select exception_key,exception_type,severity,domain,entity_type,entity_id,
       related_entity_type,related_entity_id,gate_id,correlation_id,evidence_json
  from vyndi_vibpe_authority_exceptions
union all
select exception_key,exception_type,severity,domain,entity_type,entity_id,
       related_entity_type,related_entity_id,gate_id,correlation_id,evidence_json
  from vyndi_vibpe_ui_assurance_exceptions;

insert into vyndi_vibpe_surface_registry
  (surface_id,surface_type,surface_name,domain,owner_workspace,entity_type,coverage_status,evidence_source,notes)
values
  ('route:vibpe-assurance','route','/command/ibpe-operating-workspace/assurance','governance','command','vibpe_assurance_snapshot','full','VIBPE canonical assurance backend + UI observation registry','Read-only assurance visibility plus approval-gated snapshot capture; does not become business-source authority'),
  ('view:vibpe-ui-assurance-exceptions','view','vyndi_vibpe_ui_assurance_exceptions','governance','command','audit_event','full','runtime UI observations + explicit unobserved state','UI failures and missing runtime proof are projected into the unified assurance stream')
on conflict (surface_id) do update set
  surface_type=excluded.surface_type,
  surface_name=excluded.surface_name,
  domain=excluded.domain,
  owner_workspace=excluded.owner_workspace,
  entity_type=excluded.entity_type,
  coverage_status=excluded.coverage_status,
  evidence_source=excluded.evidence_source,
  notes=excluded.notes;

comment on view vyndi_vibpe_ui_assurance_exceptions is
  'Runtime UI failures plus explicit unobserved capabilities. No UI capability is treated as passing without evidence.';
comment on view vyndi_vibpe_ui_coverage_summary is
  'Observed, passing, failing and unobserved UI assurance capability counts by domain.';
