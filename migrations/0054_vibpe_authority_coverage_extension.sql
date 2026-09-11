-- G6: extend VIBPE assurance coverage across the canonical authorities introduced by G1-G5.
-- Additive only. This migration does not alter navigation, page ownership or authentication/RBAC.
-- Backend persistence coverage and UI visibility are deliberately represented separately so an
-- unproven surface can remain a GAP even when canonical server evidence exists.

-- -----------------------------------------------------------------------------
-- Canonical entity coverage
-- -----------------------------------------------------------------------------
insert into vyndi_vibpe_entity_registry
  (entity_type,domain,source_table,primary_key_column,actor_visibility,lineage_key,critical,notes)
values
  ('product_family','product','vyndi_product_families','family_code','audit_event','family_code',true,'Canonical Longitude / Latitude / Altitude product-family authority'),
  ('product_variant','product','vyndi_product_variants','variant_id','audit_event','family_code',true,'Canonical business variant authority with legacy compatibility identifier'),
  ('engineering_baseline','engineering','vyndi_engineering_baselines','id','audit_event','family_code',true,'Released Engineering revision authority'),
  ('engineering_change_request','engineering','vyndi_engineering_change_requests','id','audit_event','family_code',true,'Controlled ECR lifecycle and impact authority'),
  ('quality_inspection','quality','vyndi_quality_inspections','id','audit_event','job_card_id',true,'Canonical incoming / in-process / final inspection evidence'),
  ('quality_ncr','quality','vyndi_quality_ncrs','id','audit_event','job_card_id',true,'Canonical non-conformance authority'),
  ('quality_capa','quality','vyndi_quality_capas','id','audit_event','ncr_id',true,'Canonical corrective/preventive-action authority'),
  ('quality_release','quality','vyndi_quality_releases','id','audit_event','traveller_id',true,'Serialized release/block decision authority'),
  ('people_record','people-office','vyndi_people_records','id','audit_event','id',false,'People lifecycle source authority'),
  ('people_office_cost_item','people-office','vyndi_people_office_cost_items','id','audit_event','person_id',false,'Payroll, office, statutory and outsourcing cost source authority'),
  ('people_office_asset','people-office','vyndi_people_office_assets','id','audit_event','id',false,'Office/admin asset and consumable source authority'),
  ('supplier_invoice','finance','vyndi_supplier_invoices','id','audit_event','purchase_order_id',true,'Canonical accounts-payable invoice authority'),
  ('supplier_payment','finance','vyndi_supplier_payments','id','audit_event','supplier_invoice_id',true,'Canonical supplier-payment authority'),
  ('ibpe_run','governance','vyndi_ibpe_runs','id','audit_event','id',false,'Governed VIBPE analytical-run evidence'),
  ('ibpe_report_snapshot','governance','vyndi_ibpe_report_snapshots','id','audit_event','id',false,'Immutable report-pack snapshot evidence'),
  ('ibpe_management_action','governance','vyndi_ibpe_management_actions','id','audit_event','source_proposal_id',false,'Governed management action lifecycle'),
  ('ibpe_decision','governance','vyndi_ibpe_decisions','id','audit_event','id',true,'Governed management decision authority'),
  ('ibpe_business_update_proposal','governance','vyndi_ibpe_business_update_proposals','id','audit_event','id',true,'Governed interpretation/confirmation queue; never canonical ERP truth by itself'),
  ('vibpe_assurance_snapshot','governance','vyndi_vibpe_assurance_snapshots','id','audit_event','correlation_id',true,'Immutable VIBPE assurance capture')
on conflict (entity_type) do update set
  domain=excluded.domain,
  source_table=excluded.source_table,
  primary_key_column=excluded.primary_key_column,
  actor_visibility=excluded.actor_visibility,
  lineage_key=excluded.lineage_key,
  critical=excluded.critical,
  notes=excluded.notes;

-- Dispatch was historically catalogued as a Commercial surface. G5 established Operations as
-- the source authority while Finance remains a downstream consumer of posted dispatch evidence.
update vyndi_vibpe_entity_registry
   set domain='operations',
       source_table='vyndi_shipments',
       primary_key_column='id',
       lineage_key='job_card_id',
       notes='Canonical Operations/Fulfilment dispatch authority; Finance owns invoice/collection downstream only'
 where entity_type='shipment';

-- -----------------------------------------------------------------------------
-- Gate coverage
-- -----------------------------------------------------------------------------
insert into vyndi_vibpe_gate_registry
  (gate_id,gate_family,gate_name,domain,entry_criteria,decision_criteria,pass_effect,evidence_sources,critical)
values
  ('G04-ENG-RELEASE','G04','Engineering release','engineering',
   'A canonical product family/variant requires controlled Engineering truth',
   'A released Engineering baseline exists with attributable revision/drawing/source evidence; ECR lifecycle remains controlled',
   'The released revision may be consumed by configuration/BOM and downstream execution',
   array['vyndi_product_families','vyndi_product_variants','vyndi_engineering_baselines','vyndi_engineering_change_requests'],true),
  ('G08-AP-MATCH','G08','Procure-to-pay financial control','finance',
   'A supplier invoice/payment exists against an authorised purchase commitment',
   'Supplier invoice follows PO/receipt evidence and payment follows an approved/part-paid/paid supplier invoice',
   'The payable/payment record is accepted into controlled financial lineage',
   array['vyndi_purchase_orders','vyndi_goods_receipts','vyndi_supplier_invoices','vyndi_supplier_payments','vyndi_accounts_payable'],true),
  ('G11-PEOPLE-OFFICE','G11','People & Office approval','people-office',
   'A People, office, statutory, outsourcing or office-asset source record is proposed for financial consumption',
   'Only explicitly approved source records with approval attribution may feed Finance',
   'Approved People & Office values may flow to the downstream Finance feed without duplicate Finance ownership',
   array['vyndi_people_records','vyndi_people_office_cost_items','vyndi_people_office_assets','vyndi_people_office_finance_feed'],true)
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

update vyndi_vibpe_gate_registry
   set domain='product',
       decision_criteria='Confirmed configuration resolves to a canonical approved product family/variant and approved BOM content',
       evidence_sources=array['vyndi_product_families','vyndi_product_variants','vyndi_sales_orders','epr_bom_inventory_mappings']
 where gate_id='G03-CONFIG';

update vyndi_vibpe_gate_registry
   set entry_criteria='A serialized Production traveller/build requires release disposition',
       decision_criteria='Current serialized release evidence exists and is RELEASED, with canonical inspection/NCR/CAPA lineage available',
       pass_effect='The released serialized unit may enter Operations dispatch',
       evidence_sources=array['vyndi_quality_inspections','vyndi_quality_ncrs','vyndi_quality_capas','vyndi_quality_releases','vyndi_quality_lineage']
 where gate_id='G10-QUALITY';

update vyndi_vibpe_gate_registry
   set domain='operations',
       entry_criteria='A current-revision Production Job Card is complete and dispatch quantity is requested',
       decision_criteria='Dispatch quantity does not exceed confirmed order quantity or the count of current serialized Quality releases',
       pass_effect='Operations/Fulfilment may post dispatch; Finance may consume posted evidence downstream',
       evidence_sources=array['vyndi_shipments','vyndi_dispatch_register','epr_production_job_cards','vyndi_quality_releases']
 where gate_id='G12-DISPATCH';

update vyndi_vibpe_gate_registry
   set decision_criteria='Customer invoice follows posted Operations dispatch and collection follows invoice; supplier payment follows controlled AP invoice/receipt lineage',
       evidence_sources=array['vyndi_shipments','vyndi_invoices','vyndi_collections','vyndi_supplier_invoices','vyndi_supplier_payments','vyndi_accounts_payable']
 where gate_id='G13-FINANCE';

update vyndi_vibpe_gate_registry
   set evidence_sources=array['vyndi_audit_events','vyndi_ibpe_runs','vyndi_ibpe_report_snapshots','vyndi_ibpe_management_actions','vyndi_ibpe_decisions','vyndi_ibpe_business_update_proposals','vyndi_vibpe_assurance_snapshots']
 where gate_id='G15-AUDIT';

-- -----------------------------------------------------------------------------
-- Workflow registry extension
-- -----------------------------------------------------------------------------
delete from vyndi_vibpe_workflow_registry where workflow_id='order-to-cash';
insert into vyndi_vibpe_workflow_registry
  (workflow_id,sequence_no,stage_id,stage_name,entity_type,gate_id,upstream_stage_id,downstream_stage_id)
values
  ('order-to-cash',10,'demand','Demand / Order','sales_order','G01-DATA-COMPLETE',null,'job-card'),
  ('order-to-cash',20,'job-card','Job Card','production_job_card','G07-PROD-RELEASE','demand','material'),
  ('order-to-cash',30,'material','Material Check','job_card_requirement','G05-INVENTORY','job-card','procurement'),
  ('order-to-cash',40,'procurement','Procurement','purchase_order','G06-PROCUREMENT','material','receiving'),
  ('order-to-cash',50,'receiving','Receiving','goods_receipt','G02-REF-INTEGRITY','procurement','traveller'),
  ('order-to-cash',60,'traveller','Traveller / Build','production_traveller','G09-PROCESS-COMPLETE','receiving','quality'),
  ('order-to-cash',65,'quality','Quality Release','quality_release','G10-QUALITY','traveller','dispatch'),
  ('order-to-cash',70,'dispatch','Operations Dispatch','shipment','G12-DISPATCH','quality','invoice'),
  ('order-to-cash',80,'invoice','Customer Invoice','invoice','G13-FINANCE','dispatch','collection'),
  ('order-to-cash',90,'collection','Collection','collection','G13-FINANCE','invoice',null);

delete from vyndi_vibpe_workflow_registry where workflow_id in ('product-to-release','procure-to-pay','people-office-to-finance','governed-management');
insert into vyndi_vibpe_workflow_registry
  (workflow_id,sequence_no,stage_id,stage_name,entity_type,gate_id,upstream_stage_id,downstream_stage_id)
values
  ('product-to-release',10,'product-family','Product Family','product_family','G03-CONFIG',null,'product-variant'),
  ('product-to-release',20,'product-variant','Product Variant','product_variant','G03-CONFIG','product-family','engineering-baseline'),
  ('product-to-release',30,'engineering-baseline','Engineering Baseline','engineering_baseline','G04-ENG-RELEASE','product-variant','engineering-change'),
  ('product-to-release',40,'engineering-change','Engineering Change','engineering_change_request','G04-ENG-RELEASE','engineering-baseline',null),
  ('procure-to-pay',10,'purchase-order','Purchase Order','purchase_order','G06-PROCUREMENT',null,'goods-receipt'),
  ('procure-to-pay',20,'goods-receipt','Goods Receipt','goods_receipt','G02-REF-INTEGRITY','purchase-order','supplier-invoice'),
  ('procure-to-pay',30,'supplier-invoice','Supplier Invoice','supplier_invoice','G08-AP-MATCH','goods-receipt','supplier-payment'),
  ('procure-to-pay',40,'supplier-payment','Supplier Payment','supplier_payment','G08-AP-MATCH','supplier-invoice',null),
  ('people-office-to-finance',10,'people-office-source','People & Office Source','people_office_cost_item','G11-PEOPLE-OFFICE',null,'finance-feed'),
  ('people-office-to-finance',20,'finance-feed','Approved Finance Feed','people_office_cost_item','G13-FINANCE','people-office-source',null),
  ('governed-management',10,'ibpe-run','VIBPE Governed Run','ibpe_run','G15-AUDIT',null,'management-action'),
  ('governed-management',20,'management-action','Management Action','ibpe_management_action','G14-AUTH','ibpe-run','decision'),
  ('governed-management',30,'decision','Management Decision','ibpe_decision','G15-AUDIT','management-action','assurance'),
  ('governed-management',40,'assurance','Assurance Snapshot','vibpe_assurance_snapshot','G15-AUDIT','decision',null);

-- -----------------------------------------------------------------------------
-- Surface coverage. Backend persistence may be full while an existing UI route stays a gap.
-- -----------------------------------------------------------------------------
insert into vyndi_vibpe_surface_registry
  (surface_id,surface_type,surface_name,domain,owner_workspace,entity_type,coverage_status,evidence_source,notes)
values
  ('table:product-families','table','vyndi_product_families','product','engineering','product_family','full','migrations/0049_canonical_product_authority.sql','Canonical Product family persistence'),
  ('table:product-variants','table','vyndi_product_variants','product','engineering','product_variant','full','migrations/0049_canonical_product_authority.sql','Canonical Product variant persistence'),
  ('service:product-authority','service','src/lib/product-authority.ts','product','engineering','product_variant','full','server authority service','Server-backed Product read/write authority'),
  ('table:engineering-baselines','table','vyndi_engineering_baselines','engineering','engineering','engineering_baseline','full','migrations/0050_engineering_revision_authority.sql','Canonical released Engineering baseline persistence'),
  ('table:engineering-ecrs','table','vyndi_engineering_change_requests','engineering','engineering','engineering_change_request','full','migrations/0050_engineering_revision_authority.sql','Canonical ECR lifecycle persistence'),
  ('service:engineering-authority','service','src/lib/engineering-authority.ts','engineering','engineering','engineering_baseline','full','server authority service','Server-backed Engineering authority'),
  ('table:quality-inspections','table','vyndi_quality_inspections','quality','quality','quality_inspection','full','migrations/0051_quality_lineage_authority.sql','Canonical Quality inspection persistence'),
  ('table:quality-releases','table','vyndi_quality_releases','quality','quality','quality_release','full','migrations/0051_quality_lineage_authority.sql','Serialized Quality release authority'),
  ('view:quality-lineage','view','vyndi_quality_lineage','quality','quality','quality_release','full','inspection/NCR/CAPA/release lineage','Canonical Quality lineage view'),
  ('service:quality-authority','service','src/lib/quality-authority.ts','quality','quality','quality_release','full','server authority service','Server-backed Quality authority exists independently of route binding'),
  ('route:quality','route','/command/quality','quality','operations','quality_release','gap','vyndi_quality_lineage + src/lib/quality-authority.ts','Canonical backend evidence exists, but this pre-R3 branch does not claim the existing page is bound to it; route visibility intentionally remains a gap'),
  ('table:people-records','table','vyndi_people_records','people-office','people-office','people_record','full','migrations/0052_people_office_authority.sql','Canonical People lifecycle persistence'),
  ('table:people-office-costs','table','vyndi_people_office_cost_items','people-office','people-office','people_office_cost_item','full','migrations/0052_people_office_authority.sql','Canonical payroll/office/statutory/outsourcing source persistence'),
  ('table:people-office-assets','table','vyndi_people_office_assets','people-office','people-office','people_office_asset','full','migrations/0052_people_office_authority.sql','Canonical office asset source persistence'),
  ('view:people-office-finance-feed','view','vyndi_people_office_finance_feed','people-office','finance-governance','people_office_cost_item','full','approved source records only','Finance consumes approved source feed and does not own duplicate source records'),
  ('service:people-office-authority','service','src/lib/people-office-authority.ts','people-office','people-office','people_office_cost_item','full','server authority service','Server-backed People & Office authority'),
  ('table:dispatch','table','vyndi_shipments','operations','operations','shipment','full','migrations/0053_dispatch_operations_authority.sql','Canonical Operations/Fulfilment dispatch persistence'),
  ('view:dispatch-register','view','vyndi_dispatch_register','operations','operations','shipment','full','Production completion + serialized Quality release + downstream invoice visibility','Operations dispatch authority with Finance downstream visibility'),
  ('service:dispatch-authority','service','src/lib/dispatch-authority.ts','operations','operations','shipment','full','server authority service','Canonical shipment writer implementation'),
  ('table:supplier-invoices','table','vyndi_supplier_invoices','finance','finance-governance','supplier_invoice','full','migrations/0035_closed_loop_procure_to_pay.sql','Canonical accounts-payable invoice persistence'),
  ('table:supplier-payments','table','vyndi_supplier_payments','finance','finance-governance','supplier_payment','full','migrations/0035_closed_loop_procure_to_pay.sql','Canonical supplier-payment persistence'),
  ('view:accounts-payable','view','vyndi_accounts_payable','finance','finance-governance','supplier_invoice','full','closed-loop procure-to-pay authority','Supplier invoice/payment lineage'),
  ('table:ibpe-runs','table','vyndi_ibpe_runs','governance','finance-governance','ibpe_run','full','migrations/0033_ibpe_governed_runs.sql','Governed analytical-run evidence'),
  ('table:ibpe-actions','table','vyndi_ibpe_management_actions','governance','finance-governance','ibpe_management_action','full','migrations/0044 + 0045','Governed action lifecycle'),
  ('table:ibpe-decisions','table','vyndi_ibpe_decisions','governance','finance-governance','ibpe_decision','full','migrations/0044_ibpe_operating_workspace_governance.sql','Governed management decision persistence'),
  ('table:vibpe-assurance-snapshots','table','vyndi_vibpe_assurance_snapshots','governance','finance-governance','vibpe_assurance_snapshot','full','migrations/0047_vibpe_assurance_backend.sql','Immutable assurance evidence capture')
on conflict (surface_id) do update set
  surface_type=excluded.surface_type,
  surface_name=excluded.surface_name,
  domain=excluded.domain,
  owner_workspace=excluded.owner_workspace,
  entity_type=excluded.entity_type,
  coverage_status=excluded.coverage_status,
  evidence_source=excluded.evidence_source,
  notes=excluded.notes;

-- -----------------------------------------------------------------------------
-- Deterministic authority exceptions. These extend (never replace) the original
-- cross-domain assurance detector from migration 0047.
-- -----------------------------------------------------------------------------
create or replace view vyndi_vibpe_authority_exceptions as
with people_office_approved as (
  select 'people_record'::text as entity_type,id,lifecycle_status as status,approved_by,source_ref
    from vyndi_people_records
  union all
  select 'people_office_cost_item',id,lifecycle_status,approved_by,source_ref
    from vyndi_people_office_cost_items
  union all
  select 'people_office_asset',id,lifecycle_status,approved_by,source_ref
    from vyndi_people_office_assets
)
select
  'confirmed-order-unknown-product|'||o.id||'|R'||o.revision as exception_key,
  'confirmed_order_unknown_product_variant' as exception_type,
  'critical' as severity,
  'product' as domain,
  'sales_order' as entity_type,
  o.id as entity_id,
  'product_variant'::text as related_entity_type,
  o.variant_id::text as related_entity_id,
  'G03-CONFIG'::text as gate_id,
  'ORDER|'||o.id||'|R'||o.revision as correlation_id,
  jsonb_build_object('variantId',o.variant_id,'status',o.status) as evidence_json
from vyndi_sales_orders o
left join vyndi_product_variants v
  on v.variant_id=o.variant_id or v.compatibility_variant_id=o.variant_id
where o.status='confirmed' and v.variant_id is null

union all
select
  'approved-product-missing-engineering|'||f.family_code,
  'approved_product_missing_released_engineering',
  'critical',
  'engineering',
  'product_family',
  f.family_code,
  'engineering_baseline',
  null::text,
  'G04-ENG-RELEASE',
  'ENGINEERING|'||f.family_code,
  jsonb_build_object('familyCode',f.family_code,'familyRevision',f.revision,'status',f.status)
from vyndi_product_families f
where f.status='approved'
  and not exists (
    select 1 from vyndi_engineering_baselines b
     where b.family_code=f.family_code and b.status='released'
  )

union all
select
  'quality-release-without-final-pass|'||r.id,
  'quality_release_without_passing_final_inspection',
  'critical',
  'quality',
  'quality_release',
  r.id,
  'production_traveller',
  r.traveller_id,
  'G10-QUALITY',
  'ORDER|'||coalesce(r.sales_order_id,'UNKNOWN')||'|JOB|'||r.job_card_id,
  jsonb_build_object('travellerId',r.traveller_id,'serialNumber',r.serial_number,'decision',r.decision,'evidenceRef',r.evidence_ref)
from vyndi_quality_releases r
where r.superseded_at is null
  and r.decision='released'
  and not exists (
    select 1 from vyndi_quality_inspections i
     where i.traveller_id=r.traveller_id
       and i.inspection_stage='final'
       and i.result='pass'
       and i.disposition='accepted'
  )

union all
select
  'complete-job-missing-quality-release|'||c.id,
  'completed_job_card_missing_quality_release',
  'critical',
  'quality',
  'production_job_card',
  c.id,
  'quality_release',
  null::text,
  'G10-QUALITY',
  'ORDER|'||c.sales_order_id||'|R'||c.sales_order_revision,
  jsonb_build_object(
    'jobCardUnits',c.units,
    'releasedUnits',(select count(*)::int from vyndi_quality_releases q where q.job_card_id=c.id and q.decision='released' and q.superseded_at is null)
  )
from epr_production_job_cards c
where c.status='complete'
  and (select count(*) from vyndi_quality_releases q where q.job_card_id=c.id and q.decision='released' and q.superseded_at is null) < c.units

union all
select
  'people-office-approval-attribution|'||p.entity_type||'|'||p.id,
  'people_office_approval_attribution_missing',
  'warning',
  'people-office',
  p.entity_type,
  p.id,
  'audit_event',
  null::text,
  'G11-PEOPLE-OFFICE',
  'PEOPLE-OFFICE|'||p.entity_type||'|'||p.id,
  jsonb_build_object('status',p.status,'approvedBy',p.approved_by,'sourceRef',p.source_ref)
from people_office_approved p
where p.status='approved' and btrim(coalesce(p.approved_by,''))=''

union all
select
  'dispatch-missing-job-card|'||s.id,
  'dispatch_missing_job_card_lineage',
  'critical',
  'operations',
  'shipment',
  s.id,
  'production_job_card',
  null::text,
  'G12-DISPATCH',
  'ORDER|'||s.sales_order_id,
  jsonb_build_object('units',s.units,'status',s.status,'ownerWorkspace',s.owner_workspace)
from vyndi_shipments s
where s.status='posted' and s.job_card_id is null

union all
select
  'dispatch-exceeds-quality-release|'||s.id,
  'dispatch_exceeds_quality_release',
  'critical',
  'operations',
  'shipment',
  s.id,
  'quality_release',
  s.job_card_id,
  'G12-DISPATCH',
  'ORDER|'||s.sales_order_id,
  jsonb_build_object(
    'shipmentUnits',s.units,
    'qualityReleasedUnits',(select count(*)::int from vyndi_quality_releases q where q.job_card_id=s.job_card_id and q.decision='released' and q.superseded_at is null),
    'ownerWorkspace',s.owner_workspace
  )
from vyndi_shipments s
where s.status='posted'
  and s.job_card_id is not null
  and (select count(*) from vyndi_quality_releases q where q.job_card_id=s.job_card_id and q.decision='released' and q.superseded_at is null) < s.units

union all
select
  'supplier-payment-without-approved-invoice|'||p.id,
  'supplier_payment_without_approved_invoice',
  'critical',
  'finance',
  'supplier_payment',
  p.id,
  'supplier_invoice',
  p.supplier_invoice_id,
  'G08-AP-MATCH',
  'AP|'||p.supplier_invoice_id,
  jsonb_build_object('invoiceStatus',i.status,'amountInr',p.amount_inr,'paidOn',p.paid_on)
from vyndi_supplier_payments p
join vyndi_supplier_invoices i on i.id=p.supplier_invoice_id
where i.status not in ('approved','part_paid','paid')

union all
select
  'ibpe-decision-attribution|'||d.id,
  'ibpe_decision_attribution_missing',
  'warning',
  'governance',
  'ibpe_decision',
  d.id,
  'audit_event',
  null::text,
  'G15-AUDIT',
  'IBPE-DECISION|'||d.id||'|R'||d.revision,
  jsonb_build_object('status',d.status,'decidedBy',d.decided_by,'decidedByRole',d.decided_by_role,'decidedAt',d.decided_at)
from vyndi_ibpe_decisions d
where d.status='approved'
  and (btrim(coalesce(d.decided_by,''))='' or btrim(coalesce(d.decided_by_role,''))='' or d.decided_at is null);

create or replace view vyndi_vibpe_assurance_exceptions_all as
select exception_key,exception_type,severity,domain,entity_type,entity_id,
       related_entity_type,related_entity_id,gate_id,correlation_id,evidence_json
  from vyndi_vibpe_assurance_exceptions
union all
select exception_key,exception_type,severity,domain,entity_type,entity_id,
       related_entity_type,related_entity_id,gate_id,correlation_id,evidence_json
  from vyndi_vibpe_authority_exceptions;

-- Keep the public snapshot function signature stable while extending its evidence source.
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
    from vyndi_vibpe_assurance_exceptions_all;

  insert into vyndi_vibpe_assurance_snapshots
    (id,actor_user_id,actor_role,correlation_id,exception_count,critical_count,warning_count,evidence_json)
  values
    (v_id,p_actor_user_id,p_actor_role,v_correlation,v_total,v_critical,v_warning,
     jsonb_build_object('exceptionView','vyndi_vibpe_assurance_exceptions_all','capturedAt',now()));

  insert into vyndi_vibpe_assurance_evidence
    (id,snapshot_id,exception_key,exception_type,severity,domain,entity_type,entity_id,
     related_entity_type,related_entity_id,gate_id,correlation_id,evidence_json)
  select
    'VIBPE-EVD-'||gen_random_uuid()::text,
    v_id,exception_key,exception_type,severity,domain,entity_type,entity_id,
    related_entity_type,related_entity_id,gate_id,correlation_id,evidence_json
  from vyndi_vibpe_assurance_exceptions_all;

  insert into vyndi_audit_events
    (id,entity_type,entity_id,action,actor_user_id,actor_role,correlation_id,gate_id,gate_result,payload_json)
  values
    ('AUD-'||v_id,'vibpe_assurance_snapshot',v_id,'captured',p_actor_user_id,p_actor_role,
     v_correlation,'G15-AUDIT',case when v_critical=0 then 'PASS' else 'FAIL' end,
     jsonb_build_object('exceptionCount',v_total,'criticalCount',v_critical,'warningCount',v_warning,'exceptionView','vyndi_vibpe_assurance_exceptions_all'));

  return query select v_id,v_total,v_critical,v_warning;
end;
$$;

comment on view vyndi_vibpe_authority_exceptions is
  'G6 deterministic exceptions for Product, Engineering, Quality, People & Office, Dispatch, Finance and Governance authorities.';
comment on view vyndi_vibpe_assurance_exceptions_all is
  'Combined VIBPE exception stream. Original cross-domain detector remains intact and G6 authority checks are additive.';
