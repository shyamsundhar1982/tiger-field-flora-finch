-- G6: extend VIBPE assurance coverage across newly canonical authorities.
-- Backend assurance only: no navigation, workspace ownership, or page-structure changes.

insert into vyndi_vibpe_entity_registry
  (entity_type,domain,source_table,lineage_key,critical,notes)
values
  ('product_family','product','vyndi_product_families','family_code',true,'Canonical VYNDI product-family authority'),
  ('product_variant','product','vyndi_product_variants','family_code',true,'Canonical controlled product-variant authority'),
  ('engineering_baseline','engineering','vyndi_engineering_baselines','family_code',true,'Released Engineering baseline authority'),
  ('engineering_change_request','engineering','vyndi_engineering_change_requests','family_code',true,'Controlled ECR lifecycle authority'),
  ('quality_inspection','quality','vyndi_quality_inspections','job_card_id',true,'Canonical inspection evidence'),
  ('quality_ncr','quality','vyndi_quality_ncrs','job_card_id',true,'Canonical non-conformance authority'),
  ('quality_capa','quality','vyndi_quality_capas','ncr_id',true,'Canonical corrective/preventive action authority'),
  ('quality_release','quality','vyndi_quality_releases','job_card_id',true,'Serialized Quality release authority'),
  ('people_record','people-office','vyndi_people_records','id',true,'People source-record authority'),
  ('people_office_cost','people-office','vyndi_people_office_cost_items','id',true,'Payroll/office/statutory/outsourcing source authority'),
  ('people_office_asset','people-office','vyndi_people_office_assets','id',true,'Office asset source authority')
on conflict (entity_type) do update set
  domain=excluded.domain,
  source_table=excluded.source_table,
  lineage_key=excluded.lineage_key,
  critical=excluded.critical,
  notes=excluded.notes;

-- G5 established shipment as an Operations/Fulfilment authority. Reflect that truth in VIBPE.
update vyndi_vibpe_entity_registry
   set domain='dispatch',
       source_table='vyndi_shipments',
       lineage_key='sales_order_id',
       notes='Canonical Operations/Fulfilment dispatch authority; Finance is downstream for invoice/collection'
 where entity_type='shipment';

insert into vyndi_vibpe_gate_registry
  (gate_id,gate_family,gate_name,domain,entry_criteria,decision_criteria,pass_effect,evidence_sources,critical,active)
values
  ('G04-PRODUCT-MASTER','G04','Product master authority','product','Product family/variant is used by a controlled workflow','Family and variant are approved, active where applicable, and resolve through canonical product persistence','Product identity is accepted as canonical configuration input',array['vyndi_product_families','vyndi_product_variants'],true,true),
  ('G08-PEOPLE-OFFICE','G08','People & Office approval','people-office','People/office source record is proposed for downstream financial use','Source record is approved with attributable approval evidence','Approved source record may enter the Finance summary/feed',array['vyndi_people_records','vyndi_people_office_cost_items','vyndi_people_office_assets','vyndi_people_office_finance_feed'],true,true)
on conflict (gate_id) do update set
  gate_family=excluded.gate_family,
  gate_name=excluded.gate_name,
  domain=excluded.domain,
  entry_criteria=excluded.entry_criteria,
  decision_criteria=excluded.decision_criteria,
  pass_effect=excluded.pass_effect,
  evidence_sources=excluded.evidence_sources,
  critical=excluded.critical,
  active=excluded.active;

update vyndi_vibpe_gate_registry
   set domain='quality',
       evidence_sources=array['vyndi_quality_inspections','vyndi_quality_ncrs','vyndi_quality_capas','vyndi_quality_releases','vyndi_quality_lineage'],
       decision_criteria='Serialized build has passing final inspection evidence, no blocking NCR/CAPA chain, and a current auditable release decision'
 where gate_id='G10-QUALITY';

update vyndi_vibpe_gate_registry
   set domain='dispatch',
       evidence_sources=array['vyndi_shipments','vyndi_dispatch_register','epr_production_job_cards','vyndi_quality_releases'],
       entry_criteria='Operations dispatch is requested for a confirmed order',
       decision_criteria='Current-revision Production Job Card is complete and requested units are covered by current serialized Quality releases',
       pass_effect='Operations/Fulfilment may post shipment evidence for downstream Finance invoicing'
 where gate_id='G12-DISPATCH';

insert into vyndi_vibpe_surface_registry
  (surface_id,surface_type,surface_name,domain,owner_workspace,entity_type,coverage_status,evidence_source,notes)
values
  ('route:product','route','/command/product','product','engineering','product_variant','full','vyndi_product_families + vyndi_product_variants','Product catalogue/validation surface backed by canonical product authority'),
  ('route:engineering','route','/command/engineering','engineering','engineering','engineering_baseline','full','vyndi_engineering_baselines + vyndi_engineering_change_requests','Engineering overview backed by baseline/ECR authority'),
  ('route:quality','route','/command/quality','quality','operations','quality_release','full','vyndi_quality_inspections + NCR/CAPA + vyndi_quality_releases','Canonical inspection through serialized release evidence now persists'),
  ('route:people-office','route','/command/people-office','people-office','people-office','people_office_cost','full','vyndi_people_records + vyndi_people_office_cost_items + vyndi_people_office_assets','People & Office owns source records; Finance consumes approved feed only'),
  ('route:dispatch-visibility','route','/command/operations','dispatch','operations','shipment','partial','vyndi_dispatch_register + dispatch authority service','Canonical dispatch execution is Operations-owned; dedicated R3 page placement remains intentionally deferred by protected UI boundary'),
  ('service:product-authority','service','src/lib/product-authority.ts','product','engineering','product_variant','full','canonical product queries/resolution','Server-backed product identity and compatibility resolution'),
  ('service:engineering-authority','service','src/lib/engineering-authority.ts','engineering','engineering','engineering_change_request','full','baseline/ECR lifecycle + audit','Controlled Engineering lifecycle writer'),
  ('service:quality-authority','service','src/lib/quality-authority.ts','quality','operations','quality_release','full','inspection/NCR/CAPA/release lifecycle + audit','Controlled Quality lifecycle writer'),
  ('service:people-office-authority','service','src/lib/people-office-authority.ts','people-office','people-office','people_office_cost','full','source lifecycle + approved Finance feed','Controlled People & Office lifecycle writer'),
  ('service:dispatch-authority','service','src/lib/dispatch-authority.ts','dispatch','operations','shipment','full','post/reverse dispatch + G12 audit','Single canonical shipment writer'),
  ('view:dispatch-register','view','vyndi_dispatch_register','dispatch','operations','shipment','full','shipment + quality release + downstream invoice visibility','Operations dispatch register with downstream Finance visibility'),
  ('route:finance-overview','route','/command/financial-cockpit','finance','finance-governance',null,'informational','aggregate Finance cockpit','Aggregate surface; not itself a source-record authority'),
  ('route:cash','route','/command/cash','finance','finance-governance',null,'gap','current finance module','Canonical cash authority has not yet been proven by this remediation'),
  ('route:payables','route','/command/payables','finance','finance-governance',null,'gap','current finance module','Canonical accounts-payable authority has not yet been proven by this remediation'),
  ('route:receivables','route','/command/receivables','finance','finance-governance','invoice','full','vyndi_shipments + vyndi_invoices + vyndi_collections','Finance owns invoice/collection downstream of Operations dispatch'),
  ('route:balance-sheet','route','/command/balance-sheet','finance','finance-governance',null,'gap','current finance module','Canonical balance-sheet posting authority has not yet been proven by this remediation'),
  ('route:ca-audit','route','/command/ca-audit','governance','finance-governance','audit_event','partial','vyndi_audit_events + current CA audit surface','Audit evidence exists; CA-specific source authority remains only partially mapped'),
  ('route:governance','route','/command/governance','governance','finance-governance','audit_event','partial','vyndi_audit_events + controlled approvals','Core actor/audit evidence is canonical; remaining governance authorities require later reconciliation'),
  ('route:risk','route','/command/risk','governance','finance-governance',null,'gap','current risk module','Canonical risk-register authority has not yet been proven by this remediation'),
  ('route:legal','route','/command/legal','governance','finance-governance',null,'gap','current legal/IP module','Canonical legal/IP authority has not yet been proven by this remediation'),
  ('route:audit-actions','route','/command/actions','governance','finance-governance','audit_event','partial','vyndi_audit_events','Append-only audit truth is canonical; action-source coverage remains partially mapped')
on conflict (surface_id) do update set
  surface_type=excluded.surface_type,
  surface_name=excluded.surface_name,
  domain=excluded.domain,
  owner_workspace=excluded.owner_workspace,
  entity_type=excluded.entity_type,
  coverage_status=excluded.coverage_status,
  evidence_source=excluded.evidence_source,
  notes=excluded.notes;

-- Deterministic checks for newly canonical authorities. These checks detect violated
-- invariants; unresolved/non-canonical Finance/Governance areas remain explicit surface gaps.
create or replace view vyndi_vibpe_authority_exceptions as
select
  'product-family-missing-engineering|'||f.family_code as exception_key,
  'product_family_missing_released_engineering_baseline'::text as exception_type,
  'critical'::text as severity,
  'product'::text as domain,
  'product_family'::text as entity_type,
  f.family_code::text as entity_id,
  'engineering_baseline'::text as related_entity_type,
  null::text as related_entity_id,
  'G04-PRODUCT-MASTER'::text as gate_id,
  'PRODUCT|'||f.family_code as correlation_id,
  jsonb_build_object('familyStatus',f.status,'familyRevision',f.revision) as evidence_json
from vyndi_product_families f
where f.status='approved'
  and not exists (
    select 1 from vyndi_engineering_baselines b
     where b.family_code=f.family_code and b.status='released'
  )

union all
select
  'released-engineering-missing-approver|'||b.id,
  'released_engineering_baseline_missing_approver',
  'critical',
  'engineering',
  'engineering_baseline',
  b.id,
  'audit_event',
  null,
  'G14-AUTH',
  'ENGINEERING|'||b.family_code||'|'||b.revision_code,
  jsonb_build_object('status',b.status,'approvedBy',b.approved_by,'sourceRef',b.source_ref)
from vyndi_engineering_baselines b
where b.status='released' and btrim(coalesce(b.approved_by,''))=''

union all
select
  'completed-traveller-missing-quality-release|'||t.id,
  'completed_traveller_missing_quality_release',
  'critical',
  'quality',
  'production_traveller',
  t.id,
  'quality_release',
  null,
  'G10-QUALITY',
  'ORDER|'||coalesce(c.sales_order_id,'UNKNOWN')||'|R'||coalesce(c.sales_order_revision,0),
  jsonb_build_object('jobCardId',c.id,'jobCardStatus',c.status,'serialNumber',t.serial_number)
from epr_production_job_cards c
join epr_travellers t on t.job_card_id=c.id and t.status<>'rejected'
where c.status='complete'
  and not exists (
    select 1 from vyndi_quality_releases q
     where q.traveller_id=t.id and q.decision='released' and q.superseded_at is null
  )

union all
select
  'quality-release-open-ncr|'||q.id,
  'quality_release_with_open_ncr',
  'critical',
  'quality',
  'quality_release',
  q.id,
  'quality_ncr',
  n.id,
  'G10-QUALITY',
  'ORDER|'||coalesce(q.sales_order_id,'UNKNOWN'),
  jsonb_build_object('travellerId',q.traveller_id,'ncrStatus',n.status,'decision',q.decision)
from vyndi_quality_releases q
join vyndi_quality_ncrs n on n.traveller_id=q.traveller_id and n.status not in ('closed','rejected')
where q.decision='released' and q.superseded_at is null

union all
select
  'approved-people-record-missing-approver|'||p.id,
  'approved_people_record_missing_approver',
  'warning',
  'people-office',
  'people_record',
  p.id,
  'audit_event',
  null,
  'G08-PEOPLE-OFFICE',
  'PEOPLE|'||p.id,
  jsonb_build_object('lifecycleStatus',p.lifecycle_status,'approvedBy',p.approved_by,'sourceRef',p.source_ref)
from vyndi_people_records p
where p.lifecycle_status='approved' and btrim(coalesce(p.approved_by,''))=''

union all
select
  'approved-people-office-cost-missing-approver|'||c.id,
  'approved_people_office_cost_missing_approver',
  'warning',
  'people-office',
  'people_office_cost',
  c.id,
  'audit_event',
  null,
  'G08-PEOPLE-OFFICE',
  'PEOPLE-OFFICE-COST|'||c.id||'|R'||c.record_revision,
  jsonb_build_object('costGroup',c.cost_group,'lifecycleStatus',c.lifecycle_status,'approvedBy',c.approved_by)
from vyndi_people_office_cost_items c
where c.lifecycle_status='approved' and btrim(coalesce(c.approved_by,''))=''

union all
select
  'approved-people-office-asset-missing-approver|'||a.id,
  'approved_people_office_asset_missing_approver',
  'warning',
  'people-office',
  'people_office_asset',
  a.id,
  'audit_event',
  null,
  'G08-PEOPLE-OFFICE',
  'PEOPLE-OFFICE-ASSET|'||a.id||'|R'||a.record_revision,
  jsonb_build_object('assetClass',a.asset_class,'lifecycleStatus',a.lifecycle_status,'approvedBy',a.approved_by)
from vyndi_people_office_assets a
where a.lifecycle_status='approved' and btrim(coalesce(a.approved_by,''))=''

union all
select
  'posted-dispatch-missing-job-card|'||s.id,
  'posted_dispatch_missing_job_card',
  'critical',
  'dispatch',
  'shipment',
  s.id,
  'production_job_card',
  null,
  'G12-DISPATCH',
  'ORDER|'||s.sales_order_id,
  jsonb_build_object('status',s.status,'ownerWorkspace',s.owner_workspace,'sourceReference',s.source_reference)
from vyndi_shipments s
where s.status='posted' and s.job_card_id is null

union all
select
  'dispatch-owner-mismatch|'||s.id,
  'dispatch_owner_mismatch',
  'critical',
  'dispatch',
  'shipment',
  s.id,
  'owner_workspace',
  s.owner_workspace,
  'G12-DISPATCH',
  'ORDER|'||s.sales_order_id,
  jsonb_build_object('expectedOwner','operations','actualOwner',s.owner_workspace)
from vyndi_shipments s
where s.owner_workspace<>'operations'

union all
select
  'assurance-surface-gap|'||r.surface_id,
  'assurance_surface_gap',
  'warning',
  r.domain,
  'assurance_surface',
  r.surface_id,
  null,
  null,
  'G15-AUDIT',
  'VIBPE-COVERAGE|'||r.surface_id,
  jsonb_build_object('surfaceType',r.surface_type,'surfaceName',r.surface_name,'ownerWorkspace',r.owner_workspace,'notes',r.notes)
from vyndi_vibpe_surface_registry r
where r.coverage_status='gap';

create or replace view vyndi_vibpe_all_exceptions as
select * from vyndi_vibpe_assurance_exceptions
union all
select * from vyndi_vibpe_authority_exceptions;

insert into vyndi_vibpe_surface_registry
  (surface_id,surface_type,surface_name,domain,owner_workspace,entity_type,coverage_status,evidence_source,notes)
values
  ('view:vibpe-authority-exceptions','view','vyndi_vibpe_authority_exceptions','governance',null,'audit_event','full','deterministic G6 authority invariant checks','Newly canonical authority exception detector'),
  ('view:vibpe-all-exceptions','view','vyndi_vibpe_all_exceptions','governance',null,'audit_event','full','core + G6 authority exceptions','Unified VIBPE assurance exception stream')
on conflict (surface_id) do update set
  surface_type=excluded.surface_type,
  surface_name=excluded.surface_name,
  domain=excluded.domain,
  owner_workspace=excluded.owner_workspace,
  entity_type=excluded.entity_type,
  coverage_status=excluded.coverage_status,
  evidence_source=excluded.evidence_source,
  notes=excluded.notes;

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
    from vyndi_vibpe_all_exceptions;

  insert into vyndi_vibpe_assurance_snapshots
    (id,actor_user_id,actor_role,correlation_id,exception_count,critical_count,warning_count,evidence_json)
  values
    (v_id,p_actor_user_id,p_actor_role,v_correlation,v_total,v_critical,v_warning,
     jsonb_build_object('exceptionView','vyndi_vibpe_all_exceptions','capturedAt',now()));

  insert into vyndi_vibpe_assurance_evidence
    (id,snapshot_id,exception_key,exception_type,severity,domain,entity_type,entity_id,
     related_entity_type,related_entity_id,gate_id,correlation_id,evidence_json)
  select
    'VIBPE-EVD-'||gen_random_uuid()::text,
    v_id,exception_key,exception_type,severity,domain,entity_type,entity_id,
    related_entity_type,related_entity_id,gate_id,correlation_id,evidence_json
  from vyndi_vibpe_all_exceptions;

  insert into vyndi_audit_events
    (id,entity_type,entity_id,action,actor_user_id,actor_role,correlation_id,gate_id,gate_result,payload_json)
  values
    ('AUD-'||v_id,'vibpe_assurance_snapshot',v_id,'captured',p_actor_user_id,p_actor_role,
     v_correlation,'G15-AUDIT',case when v_critical=0 then 'PASS' else 'FAIL' end,
     jsonb_build_object('exceptionCount',v_total,'criticalCount',v_critical,'warningCount',v_warning));

  return query select v_id,v_total,v_critical,v_warning;
end;
$$;
