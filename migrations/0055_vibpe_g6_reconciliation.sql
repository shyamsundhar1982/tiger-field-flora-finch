-- G6 reconciliation after two additive 0054 coverage migrations landed on the same branch.
-- Forward-only convergence: do not rewrite/delete migrations that a preview database may have applied.
-- This migration removes semantic aliases, preserves truthful UI gaps, and standardises the
-- unified assurance exception stream without changing navigation/page ownership.

-- Remove aliases introduced by the first 0054 draft where the extension now has one canonical name.
delete from vyndi_vibpe_entity_registry
 where entity_type='people_office_cost';

delete from vyndi_vibpe_gate_registry
 where gate_id in ('G04-PRODUCT-MASTER','G08-PEOPLE-OFFICE');

-- The extension establishes Operations as the Dispatch authority and uses the canonical
-- people_office_cost_item entity key. Keep the final registry deterministic on every database.
update vyndi_vibpe_entity_registry
   set domain='operations',
       source_table='vyndi_shipments',
       primary_key_column='id',
       lineage_key='job_card_id',
       notes='Canonical Operations/Fulfilment dispatch authority; Finance owns invoice/collection downstream only'
 where entity_type='shipment';

-- Backend authority can be full while an existing pre-R3 page is not yet proven to consume it.
-- Mark route binding truthfully; table/view/service surfaces remain FULL in the extension migration.
update vyndi_vibpe_surface_registry
   set coverage_status='gap',
       notes='Canonical Product backend authority exists, but this pre-R3 branch does not claim the existing page is bound exclusively to it; route binding remains an R3 reconciliation item'
 where surface_id='route:product';

update vyndi_vibpe_surface_registry
   set coverage_status='gap',
       notes='Canonical Engineering baseline/ECR authority exists, but this pre-R3 branch does not claim the existing page is fully bound to it; route binding remains an R3 reconciliation item'
 where surface_id='route:engineering';

update vyndi_vibpe_surface_registry
   set coverage_status='gap',
       notes='Canonical People & Office backend authority and approved Finance feed exist, but the pre-R3 page binding is not claimed as fully canonical'
 where surface_id='route:people-office';

update vyndi_vibpe_surface_registry
   set coverage_status='gap',
       domain='operations',
       owner_workspace='operations',
       notes='Canonical Dispatch writer/register are Operations-owned; dedicated UI placement is intentionally deferred by the protected pre-R3 boundary'
 where surface_id='route:dispatch-visibility';

-- Route-level Finance/Governance gaps from the first 0054 are intentionally retained where the
-- extension proves backend tables but not exclusive page binding. Do not convert those gaps to passes.
update vyndi_vibpe_surface_registry
   set notes=case surface_id
     when 'route:payables' then 'Canonical supplier invoice/payment backend authority exists, but exclusive /command/payables binding has not been proved in this pre-R3 branch'
     when 'route:cash' then 'Canonical cash authority has not yet been proved by this remediation'
     when 'route:balance-sheet' then 'Canonical balance-sheet posting authority has not yet been proved by this remediation'
     when 'route:risk' then 'Canonical risk-register authority has not yet been proved by this remediation'
     when 'route:legal' then 'Canonical legal/IP authority has not yet been proved by this remediation'
     else notes
   end
 where surface_id in ('route:payables','route:cash','route:balance-sheet','route:risk','route:legal')
   and coverage_status='gap';

-- Standardise the public unified exception stream on the extension's explicit name.
insert into vyndi_vibpe_surface_registry
  (surface_id,surface_type,surface_name,domain,owner_workspace,entity_type,coverage_status,evidence_source,notes)
values
  ('view:vibpe-authority-exceptions','view','vyndi_vibpe_authority_exceptions','governance','finance-governance','audit_event','full','migrations/0054_vibpe_authority_coverage_extension.sql','Deterministic Product/Engineering/Quality/People & Office/Dispatch/Finance/Governance authority exceptions'),
  ('view:vibpe-assurance-exceptions-all','view','vyndi_vibpe_assurance_exceptions_all','governance','finance-governance','audit_event','full','core VIBPE exceptions + G6 authority exceptions','Canonical unified assurance exception stream used by live reads and snapshot capture')
on conflict (surface_id) do update set
  surface_type=excluded.surface_type,
  surface_name=excluded.surface_name,
  domain=excluded.domain,
  owner_workspace=excluded.owner_workspace,
  entity_type=excluded.entity_type,
  coverage_status=excluded.coverage_status,
  evidence_source=excluded.evidence_source,
  notes=excluded.notes;

delete from vyndi_vibpe_surface_registry
 where surface_id='view:vibpe-all-exceptions';

drop view if exists vyndi_vibpe_all_exceptions;

comment on view vyndi_vibpe_assurance_exceptions_all is
  'Canonical unified VIBPE exception stream after G6 reconciliation; combines original cross-domain and extended authority detectors.';
