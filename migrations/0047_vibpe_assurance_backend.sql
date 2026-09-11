-- VIBPE assurance backend: evidence model, entity/workflow/gate registry, and canonical exception detection.
-- Backend only. No UI/navigation/page ownership changes.

alter table vyndi_audit_events
  add column if not exists correlation_id text,
  add column if not exists gate_id text,
  add column if not exists gate_result text,
  add column if not exists previous_state text,
  add column if not exists new_state text,
  add column if not exists reason text;

create index if not exists vyndi_audit_correlation_idx
  on vyndi_audit_events (correlation_id, created_at desc)
  where correlation_id is not null;

create index if not exists vyndi_audit_gate_idx
  on vyndi_audit_events (gate_id, gate_result, created_at desc)
  where gate_id is not null;

create table if not exists vyndi_vibpe_entity_registry (
  entity_type text primary key,
  domain text not null,
  source_table text not null,
  primary_key_column text not null default 'id',
  actor_visibility text not null default 'audit_event',
  lineage_key text,
  critical boolean not null default true,
  notes text not null default ''
);

create table if not exists vyndi_vibpe_gate_registry (
  gate_id text primary key,
  gate_family text not null,
  gate_name text not null,
  domain text not null,
  entry_criteria text not null,
  decision_criteria text not null,
  pass_effect text not null,
  evidence_sources text[] not null default '{}',
  critical boolean not null default true,
  active boolean not null default true
);

create table if not exists vyndi_vibpe_workflow_registry (
  workflow_id text not null,
  sequence_no integer not null,
  stage_id text not null,
  stage_name text not null,
  entity_type text,
  gate_id text references vyndi_vibpe_gate_registry(gate_id),
  upstream_stage_id text,
  downstream_stage_id text,
  primary key (workflow_id, sequence_no)
);

create table if not exists vyndi_vibpe_assurance_snapshots (
  id text primary key,
  captured_at timestamptz not null default now(),
  actor_user_id text not null,
  actor_role text not null,
  correlation_id text not null,
  exception_count integer not null,
  critical_count integer not null,
  warning_count integer not null,
  evidence_json jsonb not null default '{}'::jsonb
);

create table if not exists vyndi_vibpe_assurance_evidence (
  id text primary key,
  snapshot_id text not null references vyndi_vibpe_assurance_snapshots(id) on delete cascade,
  exception_key text not null,
  exception_type text not null,
  severity text not null check (severity in ('critical','warning','info')),
  domain text not null,
  entity_type text not null,
  entity_id text not null,
  related_entity_type text,
  related_entity_id text,
  gate_id text,
  correlation_id text,
  evidence_json jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now()
);

create index if not exists vyndi_vibpe_evidence_snapshot_idx
  on vyndi_vibpe_assurance_evidence (snapshot_id, severity, domain);

insert into vyndi_vibpe_entity_registry
  (entity_type,domain,source_table,lineage_key,critical,notes)
values
  ('sales_order','commercial','vyndi_sales_orders','sales_order_id',true,'Canonical customer demand / order authority'),
  ('production_job_card','production','epr_production_job_cards','sales_order_id',true,'Released production authority'),
  ('job_card_requirement','inventory','vyndi_live_job_card_requirements','job_card_id',true,'Live BOM/inventory requirement projection'),
  ('purchase_order','procurement','vyndi_purchase_orders','job_card_id',true,'Controlled procurement commitment'),
  ('goods_receipt','receiving','vyndi_goods_receipts','purchase_order_id',true,'Controlled receipt evidence'),
  ('production_traveller','production','epr_travellers','job_card_id',true,'Serialized production genealogy'),
  ('shipment','commercial','vyndi_shipments','sales_order_id',true,'Posted shipment evidence'),
  ('invoice','finance','vyndi_invoices','sales_order_id',true,'Issued receivable evidence'),
  ('collection','finance','vyndi_collections','invoice_id',true,'Posted collection evidence'),
  ('audit_event','governance','vyndi_audit_events','correlation_id',true,'Append-only business audit trail')
on conflict (entity_type) do update set
  domain=excluded.domain,
  source_table=excluded.source_table,
  lineage_key=excluded.lineage_key,
  critical=excluded.critical,
  notes=excluded.notes;

insert into vyndi_vibpe_gate_registry
  (gate_id,gate_family,gate_name,domain,entry_criteria,decision_criteria,pass_effect,evidence_sources,critical)
values
  ('G01-DATA-COMPLETE','G01','Data completeness','cross-domain','Entity exists','Mandatory business fields are present','Entity may enter its controlled workflow',array['canonical entity row'],true),
  ('G02-REF-INTEGRITY','G02','Referential integrity','cross-domain','Downstream entity exists','Referenced upstream entity exists and revision/link is valid','Lineage is accepted',array['foreign/link keys','canonical entity row'],true),
  ('G03-CONFIG','G03','Configuration validity','engineering','Confirmed order has configured product','Variant/options are valid and mapped to approved BOM content','BOM may be released',array['vyndi_sales_orders','epr_bom_inventory_mappings'],true),
  ('G05-INVENTORY','G05','Inventory readiness','inventory','Released job card has requirements','Required quantity is available or shortage is explicitly represented','Material path may continue',array['vyndi_live_job_card_requirements','epr_inventory_reservations'],true),
  ('G06-PROCUREMENT','G06','Procurement response','procurement','A live shortage exists','At least one non-cancelled procurement response exists for the job card','Shortage has an execution path',array['vyndi_live_job_card_requirements','vyndi_purchase_orders'],true),
  ('G07-PROD-RELEASE','G07','Production release','production','Confirmed current sales-order revision exists','A matching job card exists for the same sales-order revision and controlled BOM','Production workflow may proceed',array['vyndi_sales_orders','epr_production_job_cards'],true),
  ('G09-PROCESS-COMPLETE','G09','Process completion','production','Build is approved','Required traveller/genealogy evidence exists','Quality/release may proceed',array['epr_production_job_cards','epr_travellers'],true),
  ('G10-QUALITY','G10','Quality release','quality','Product build exists','Order-linked quality/release evidence exists','Shipment may proceed',array['epr_evidence','epr_travellers'],true),
  ('G12-DISPATCH','G12','Dispatch','commercial','Shipment is posted','Production build exists and has been approved','Shipment is accepted as valid fulfillment',array['vyndi_shipments','epr_production_job_cards'],true),
  ('G13-FINANCE','G13','Financial lineage','finance','Invoice/collection exists','Invoice follows posted shipment; collection follows issued invoice','Financial record is lineage-complete',array['vyndi_shipments','vyndi_invoices','vyndi_collections'],true),
  ('G14-AUTH','G14','Actor authorization','governance','Controlled action is recorded','Actor user and actor role are attributable','Action is auditable',array['vyndi_audit_events'],true),
  ('G15-AUDIT','G15','Audit evidence','governance','Material state exists','Expected audit event exists for controlled entity','State transition is reproducible',array['vyndi_audit_events'],true)
on conflict (gate_id) do update set
  gate_family=excluded.gate_family,
  gate_name=excluded.gate_name,
  domain=excluded.domain,
  entry_criteria=excluded.entry_criteria,
  decision_criteria=excluded.decision_criteria,
  pass_effect=excluded.pass_effect,
  evidence_sources=excluded.evidence_sources,
  critical=excluded.critical,
  active=true;

delete from vyndi_vibpe_workflow_registry where workflow_id='order-to-cash';
insert into vyndi_vibpe_workflow_registry
  (workflow_id,sequence_no,stage_id,stage_name,entity_type,gate_id,upstream_stage_id,downstream_stage_id)
values
  ('order-to-cash',10,'demand','Demand / Order','sales_order','G01-DATA-COMPLETE',null,'job-card'),
  ('order-to-cash',20,'job-card','Job Card','production_job_card','G07-PROD-RELEASE','demand','material'),
  ('order-to-cash',30,'material','Material Check','job_card_requirement','G05-INVENTORY','job-card','procurement'),
  ('order-to-cash',40,'procurement','Procurement','purchase_order','G06-PROCUREMENT','material','receiving'),
  ('order-to-cash',50,'receiving','Receiving','goods_receipt','G02-REF-INTEGRITY','procurement','traveller'),
  ('order-to-cash',60,'traveller','Traveller','production_traveller','G09-PROCESS-COMPLETE','receiving','shipment'),
  ('order-to-cash',70,'shipment','Shipment','shipment','G12-DISPATCH','traveller','invoice'),
  ('order-to-cash',80,'invoice','Invoice','invoice','G13-FINANCE','shipment','collection'),
  ('order-to-cash',90,'collection','Collection','collection','G13-FINANCE','invoice',null);

create or replace view vyndi_vibpe_assurance_exceptions as
with current_cards as (
  select c.*,
         row_number() over (
           partition by c.sales_order_id, c.sales_order_revision
           order by c.updated_at desc nulls last, c.created_at desc nulls last, c.id desc
         ) as rn,
         count(*) over (partition by c.sales_order_id, c.sales_order_revision) as sibling_count
    from epr_production_job_cards c
   where c.status <> 'cancelled'
),
confirmed_orders as (
  select * from vyndi_sales_orders where status='confirmed'
),
shortage_cards as (
  select r.job_card_id,
         count(*) filter (where r.sku is not null and r.shortage_quantity > 0)::int as shortage_lines,
         coalesce(sum(r.shortage_quantity) filter (where r.sku is not null and r.shortage_quantity > 0),0) as shortage_units
    from vyndi_live_job_card_requirements r
   group by r.job_card_id
),
po_cards as (
  select p.job_card_id, count(*) filter (where p.status <> 'cancelled')::int as po_count
    from vyndi_purchase_orders p
   group by p.job_card_id
),
traveller_cards as (
  select t.job_card_id, count(*) filter (where t.status <> 'rejected')::int as traveller_count
    from epr_travellers t
   group by t.job_card_id
),
shipment_orders as (
  select s.sales_order_id, count(*) filter (where s.status='posted')::int as shipment_count
    from vyndi_shipments s
   group by s.sales_order_id
),
invoice_orders as (
  select i.sales_order_id, count(*) filter (where i.status='issued')::int as invoice_count
    from vyndi_invoices i
   group by i.sales_order_id
)
select
  'confirmed-order-missing-job-card|'||o.id||'|R'||o.revision as exception_key,
  'confirmed_order_missing_job_card' as exception_type,
  'critical' as severity,
  'production' as domain,
  'sales_order' as entity_type,
  o.id as entity_id,
  'production_job_card'::text as related_entity_type,
  null::text as related_entity_id,
  'G07-PROD-RELEASE'::text as gate_id,
  'ORDER|'||o.id||'|R'||o.revision as correlation_id,
  jsonb_build_object('salesOrderRevision',o.revision,'status',o.status,'variantId',o.variant_id,'planMonth',o.plan_month) as evidence_json
from confirmed_orders o
left join current_cards c
  on c.sales_order_id=o.id and c.sales_order_revision=o.revision and c.rn=1
where c.id is null

union all
select
  'orphan-job-card|'||c.id,
  'orphan_job_card',
  'critical',
  'production',
  'production_job_card',
  c.id,
  'sales_order',
  c.sales_order_id,
  'G02-REF-INTEGRITY',
  'ORDER|'||coalesce(c.sales_order_id,'UNKNOWN')||'|R'||coalesce(c.sales_order_revision,0),
  jsonb_build_object('jobCardRevision',c.sales_order_revision,'status',c.status)
from current_cards c
left join vyndi_sales_orders o on o.id=c.sales_order_id
where c.rn=1 and o.id is null

union all
select
  'stale-job-card-revision|'||c.id,
  'stale_job_card_revision',
  'critical',
  'production',
  'production_job_card',
  c.id,
  'sales_order',
  o.id,
  'G07-PROD-RELEASE',
  'ORDER|'||o.id||'|R'||o.revision,
  jsonb_build_object('currentSalesOrderRevision',o.revision,'jobCardRevision',c.sales_order_revision)
from vyndi_sales_orders o
join current_cards c on c.sales_order_id=o.id and c.rn=1
where o.status='confirmed' and c.sales_order_revision <> o.revision

union all
select
  'duplicate-job-card|'||c.sales_order_id||'|R'||c.sales_order_revision,
  'duplicate_job_card_for_revision',
  'critical',
  'production',
  'sales_order',
  c.sales_order_id,
  'production_job_card',
  c.id,
  'G07-PROD-RELEASE',
  'ORDER|'||c.sales_order_id||'|R'||c.sales_order_revision,
  jsonb_build_object('jobCardCount',c.sibling_count,'sampleJobCardId',c.id)
from current_cards c
where c.rn=1 and c.sibling_count > 1

union all
select
  'shortage-without-procurement|'||c.id,
  'shortage_without_procurement_action',
  'critical',
  'procurement',
  'production_job_card',
  c.id,
  'purchase_order',
  null,
  'G06-PROCUREMENT',
  'ORDER|'||c.sales_order_id||'|R'||c.sales_order_revision,
  jsonb_build_object('shortageLines',coalesce(s.shortage_lines,0),'shortageUnits',coalesce(s.shortage_units,0))
from current_cards c
join shortage_cards s on s.job_card_id=c.id and s.shortage_lines>0
left join po_cards p on p.job_card_id=c.id
where c.rn=1 and coalesce(p.po_count,0)=0

union all
select
  'approved-build-missing-traveller|'||c.id,
  'approved_build_missing_traveller',
  'critical',
  'production',
  'production_job_card',
  c.id,
  'production_traveller',
  null,
  'G09-PROCESS-COMPLETE',
  'ORDER|'||c.sales_order_id||'|R'||c.sales_order_revision,
  jsonb_build_object('approvedAt',c.approved_at,'units',c.units,'travellerCount',coalesce(t.traveller_count,0))
from current_cards c
left join traveller_cards t on t.job_card_id=c.id
where c.rn=1 and c.approved_at is not null and coalesce(t.traveller_count,0) < c.units

union all
select
  'shipment-without-approved-build|'||s.id,
  'shipment_without_approved_build',
  'critical',
  'commercial',
  'shipment',
  s.id,
  'sales_order',
  s.sales_order_id,
  'G12-DISPATCH',
  'ORDER|'||s.sales_order_id,
  jsonb_build_object('shipmentStatus',s.status,'units',s.units)
from vyndi_shipments s
left join lateral (
  select c.id,c.approved_at
    from current_cards c
   where c.sales_order_id=s.sales_order_id and c.rn=1
   limit 1
) c on true
where s.status='posted' and (c.id is null or c.approved_at is null)

union all
select
  'invoice-without-shipment|'||i.id,
  'invoice_without_posted_shipment',
  'critical',
  'finance',
  'invoice',
  i.id,
  'sales_order',
  i.sales_order_id,
  'G13-FINANCE',
  'ORDER|'||i.sales_order_id,
  jsonb_build_object('invoiceStatus',i.status,'amountLakh',i.amount_lakh)
from vyndi_invoices i
left join shipment_orders s on s.sales_order_id=i.sales_order_id
where i.status='issued' and coalesce(s.shipment_count,0)=0

union all
select
  'missing-sales-order-audit|'||o.id||'|R'||o.revision,
  'missing_audit_event',
  'warning',
  'governance',
  'sales_order',
  o.id,
  'audit_event',
  null,
  'G15-AUDIT',
  'ORDER|'||o.id||'|R'||o.revision,
  jsonb_build_object('expectedEntityRevision',o.revision)
from vyndi_sales_orders o
left join vyndi_audit_events a
  on a.entity_type='sales_order'
 and a.entity_id=o.id
 and a.entity_revision=o.revision
where a.id is null

union all
select
  'audit-actor-attribution|'||a.id,
  'audit_actor_attribution_missing',
  'warning',
  'governance',
  'audit_event',
  a.id,
  a.entity_type,
  a.entity_id,
  'G14-AUTH',
  coalesce(a.correlation_id,'AUDIT|'||a.entity_type||'|'||a.entity_id),
  jsonb_build_object('actorUserId',a.actor_user_id,'actorRole',a.actor_role,'action',a.action)
from vyndi_audit_events a
where btrim(coalesce(a.actor_user_id,''))='' or btrim(coalesce(a.actor_role,''))='';

create or replace function capture_vibpe_assurance_snapshot(
  p_actor_user_id text,
  p_actor_role text
) returns table(snapshot_id text, exception_count integer, critical_count integer, warning_count integer)
language plpgsql
as $$
declare
  v_id text := 'VIBPE-ASR-' || gen_random_uuid()::text;
  v_correlation text := 'VIBPE-ASR|' || v_id;
  v_total integer;
  v_critical integer;
  v_warning integer;
begin
  select count(*)::int,
         count(*) filter (where severity='critical')::int,
         count(*) filter (where severity='warning')::int
    into v_total,v_critical,v_warning
    from vyndi_vibpe_assurance_exceptions;

  insert into vyndi_vibpe_assurance_snapshots
    (id,actor_user_id,actor_role,correlation_id,exception_count,critical_count,warning_count,evidence_json)
  values
    (v_id,p_actor_user_id,p_actor_role,v_correlation,v_total,v_critical,v_warning,
     jsonb_build_object('exceptionView','vyndi_vibpe_assurance_exceptions','capturedAt',now()));

  insert into vyndi_vibpe_assurance_evidence
    (id,snapshot_id,exception_key,exception_type,severity,domain,entity_type,entity_id,
     related_entity_type,related_entity_id,gate_id,correlation_id,evidence_json)
  select
    'VIBPE-EVD-'||gen_random_uuid()::text,
    v_id,exception_key,exception_type,severity,domain,entity_type,entity_id,
    related_entity_type,related_entity_id,gate_id,correlation_id,evidence_json
  from vyndi_vibpe_assurance_exceptions;

  insert into vyndi_audit_events
    (id,entity_type,entity_id,action,actor_user_id,actor_role,correlation_id,gate_id,gate_result,payload_json)
  values
    ('AUD-'||v_id,'vibpe_assurance_snapshot',v_id,'captured',p_actor_user_id,p_actor_role,
     v_correlation,'G15-AUDIT',case when v_critical=0 then 'PASS' else 'FAIL' end,
     jsonb_build_object('exceptionCount',v_total,'criticalCount',v_critical,'warningCount',v_warning));

  return query select v_id,v_total,v_critical,v_warning;
end;
$$;
