-- VIBPE assurance surface inventory.
-- Records route/API/entity visibility without changing navigation or page ownership.

create table if not exists vyndi_vibpe_surface_registry (
  surface_id text primary key,
  surface_type text not null check (surface_type in ('route','service','table','view','function')),
  surface_name text not null,
  domain text not null,
  owner_workspace text,
  entity_type text,
  coverage_status text not null check (coverage_status in ('full','partial','gap','informational')),
  evidence_source text,
  notes text not null default ''
);

insert into vyndi_vibpe_surface_registry
  (surface_id,surface_type,surface_name,domain,owner_workspace,entity_type,coverage_status,evidence_source,notes)
values
  ('route:sales','route','/command/sales','commercial','plan-sales','sales_order','full','vyndi_sales_orders + vyndi_audit_events','Canonical demand/order source'),
  ('route:bom-control','route','/command/bom-control','engineering','engineering','job_card_requirement','partial','epr_bom_inventory_mappings','BOM mapping is visible; complete engineering revision lineage remains domain-owned'),
  ('route:inventory','route','/command/inventory','inventory','operations','job_card_requirement','full','vyndi_live_job_card_requirements + reservations','Live material requirement/shortage state'),
  ('route:procurement-planning','route','/command/procurement-planning','procurement','operations','purchase_order','full','vyndi_purchase_orders','Shortage-to-procurement linkage'),
  ('route:purchase-execution','route','/command/purchase-execution','procurement','operations','purchase_order','full','vyndi_purchase_orders + audit events','Controlled PO execution'),
  ('route:receiving','route','/command/receiving','receiving','operations','goods_receipt','full','vyndi_goods_receipts','PO-linked receiving evidence'),
  ('route:production','route','/command/production','production','operations','production_job_card','full','epr_production_job_cards + epr_travellers','Job card and genealogy source'),
  ('route:quality','route','/command/quality','quality','operations',null,'gap','current quality module','Order/job-card-linked inspection evidence is not yet persisted into the canonical operating lineage'),
  ('route:receivables','route','/command/receivables','finance','finance-governance','invoice','full','vyndi_shipments + vyndi_invoices + vyndi_collections','Order-to-cash evidence'),
  ('service:operating-lineage','service','src/lib/operating-lineage.ts','cross-domain',null,null,'full','getOperatingLineage','Read-only persisted order-to-cash genealogy'),
  ('service:production-job-card','service','src/lib/production-job-card.ts','production',null,'production_job_card','full','canonical job-card synchronization','Current sales-order revision to job-card authority'),
  ('service:vibpe-assurance','service','src/lib/vibpe-assurance.ts','governance',null,'audit_event','full','VIBPE assurance service','Coverage, exception listing and snapshot capture'),
  ('view:vibpe-exceptions','view','vyndi_vibpe_assurance_exceptions','governance',null,'audit_event','full','live SQL exception view','Canonical exception detector'),
  ('function:vibpe-snapshot','function','capture_vibpe_assurance_snapshot','governance',null,'audit_event','full','snapshot + evidence tables','Reproducible assurance evidence capture')
on conflict (surface_id) do update set
  surface_type=excluded.surface_type,
  surface_name=excluded.surface_name,
  domain=excluded.domain,
  owner_workspace=excluded.owner_workspace,
  entity_type=excluded.entity_type,
  coverage_status=excluded.coverage_status,
  evidence_source=excluded.evidence_source,
  notes=excluded.notes;

create or replace view vyndi_vibpe_coverage_summary as
select
  domain,
  count(*)::int as surface_count,
  count(*) filter (where coverage_status='full')::int as fully_covered,
  count(*) filter (where coverage_status='partial')::int as partially_covered,
  count(*) filter (where coverage_status='gap')::int as visibility_gaps
from vyndi_vibpe_surface_registry
group by domain
order by domain;
