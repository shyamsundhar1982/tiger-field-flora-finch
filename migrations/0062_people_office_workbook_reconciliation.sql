-- Reconcile the VYNDI 36-month operating workbook into canonical People & Office authority.
-- Workbook source: VYNDI_36_Month_Integrated_Business_Operating_Model_v3 final.xlsx.
-- Safety rule: every imported value is a DRAFT planning proposal. Nothing in this
-- migration becomes approved accounting/operating truth and therefore nothing
-- feeds Finance until an authorised reviewer explicitly approves the source rows.
--
-- The workbook contains internal decomposition differences that must remain visible:
--   payroll envelope vs role-detail total: S3 1.85 vs 2.10, S4 2.80 vs 3.80 ₹L/mo
--   outsourcing envelope vs service-detail total: S3 2.00 vs 1.85, S4 2.20 vs 1.90 ₹L/mo
-- These values are deliberately not auto-reconciled or auto-approved.

-- ---------------------------------------------------------------------------
-- 1. Stage-wise OPEX proposals.  These rows reproduce the finance-engine envelope
--    exactly when, and only when, every row is subsequently approved.
-- ---------------------------------------------------------------------------
insert into vyndi_people_office_cost_items (
  id,cost_group,person_id,name,stage,quantity,monthly_unit_cost_lakh,start_month,end_month,
  one_time_cost_lakh,one_time_month,lifecycle_status,source_ref,notes,created_by
)
values
  ('wbv3-s1-rent','office',null,'Rent','S1 Foundation',1,0.30,1,3,0,1,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation; M1-M3. Review before approval.','system:migration'),
  ('wbv3-s1-payroll','payroll',null,'Payroll & manpower envelope','S1 Foundation',1,0.80,1,3,0,1,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook envelope matches role-detail total for S1.','system:migration'),
  ('wbv3-s1-gst-ca','statutory',null,'GST / CA filing','S1 Foundation',1,0.08,1,3,0,1,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Planning fee only; not statutory books.','system:migration'),
  ('wbv3-s1-utilities','office',null,'Utilities / internet','S1 Foundation',1,0.12,1,3,0,1,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),
  ('wbv3-s1-admin','office',null,'Admin / insurance','S1 Foundation',1,0.15,1,3,0,1,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),
  ('wbv3-s1-travel','office',null,'Travel / marketing','S1 Foundation',1,0.15,1,3,0,1,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),
  ('wbv3-s1-outsourcing','outsourcing',null,'Outsourcing envelope','S1 Foundation',1,0.90,1,3,0,1,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook envelope matches service-detail total for S1.','system:migration'),
  ('wbv3-s1-consumables','office',null,'Office consumables','S1 Foundation',1,0.10,1,3,0,1,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Stage-varying OPEX proposal; kept in cost authority rather than perpetual consumable asset feed.','system:migration'),
  ('wbv3-s1-contingency','office',null,'Other / contingency','S1 Foundation',1,0.20,1,3,0,1,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),

  ('wbv3-s2-rent','office',null,'Rent','S2 Engineering',1,0.45,4,8,0,4,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation; M4-M8.','system:migration'),
  ('wbv3-s2-payroll','payroll',null,'Payroll & manpower envelope','S2 Engineering',1,1.25,4,8,0,4,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook envelope matches role-detail total for S2.','system:migration'),
  ('wbv3-s2-gst-ca','statutory',null,'GST / CA filing','S2 Engineering',1,0.10,4,8,0,4,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Planning fee only; not statutory books.','system:migration'),
  ('wbv3-s2-utilities','office',null,'Utilities / internet','S2 Engineering',1,0.18,4,8,0,4,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),
  ('wbv3-s2-admin','office',null,'Admin / insurance','S2 Engineering',1,0.20,4,8,0,4,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),
  ('wbv3-s2-travel','office',null,'Travel / marketing','S2 Engineering',1,0.25,4,8,0,4,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),
  ('wbv3-s2-outsourcing','outsourcing',null,'Outsourcing envelope','S2 Engineering',1,1.35,4,8,0,4,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook envelope matches service-detail total for S2.','system:migration'),
  ('wbv3-s2-consumables','office',null,'Office consumables','S2 Engineering',1,0.12,4,8,0,4,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Stage-varying OPEX proposal.','system:migration'),
  ('wbv3-s2-contingency','office',null,'Other / contingency','S2 Engineering',1,0.30,4,8,0,4,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),

  ('wbv3-s3-rent','office',null,'Rent','S3 Validation',1,0.60,9,11,0,9,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation; M9-M11.','system:migration'),
  ('wbv3-s3-payroll','payroll',null,'Payroll & manpower envelope','S3 Validation',1,1.85,9,11,0,9,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','REVIEW REQUIRED: operating envelope 1.85 differs from role-detail total 2.10 ₹L/mo by 0.25.','system:migration'),
  ('wbv3-s3-gst-ca','statutory',null,'GST / CA filing','S3 Validation',1,0.12,9,11,0,9,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Planning fee only; not statutory books.','system:migration'),
  ('wbv3-s3-utilities','office',null,'Utilities / internet','S3 Validation',1,0.23,9,11,0,9,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),
  ('wbv3-s3-admin','office',null,'Admin / insurance','S3 Validation',1,0.25,9,11,0,9,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),
  ('wbv3-s3-travel','office',null,'Travel / marketing','S3 Validation',1,0.35,9,11,0,9,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),
  ('wbv3-s3-outsourcing','outsourcing',null,'Outsourcing envelope','S3 Validation',1,2.00,9,11,0,9,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','REVIEW REQUIRED: operating envelope 2.00 differs from service-detail total 1.85 ₹L/mo by 0.15.','system:migration'),
  ('wbv3-s3-consumables','office',null,'Office consumables','S3 Validation',1,0.15,9,11,0,9,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Stage-varying OPEX proposal.','system:migration'),
  ('wbv3-s3-contingency','office',null,'Other / contingency','S3 Validation',1,0.45,9,11,0,9,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),

  ('wbv3-s4-rent','office',null,'Rent','S4 Launch Readiness',1,0.80,12,14,0,12,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation; M12-M14.','system:migration'),
  ('wbv3-s4-payroll','payroll',null,'Payroll & manpower envelope','S4 Launch Readiness',1,2.80,12,14,0,12,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','REVIEW REQUIRED: operating envelope 2.80 differs from role-detail total 3.80 ₹L/mo by 1.00.','system:migration'),
  ('wbv3-s4-gst-ca','statutory',null,'GST / CA filing','S4 Launch Readiness',1,0.15,12,14,0,12,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Planning fee only; not statutory books.','system:migration'),
  ('wbv3-s4-utilities','office',null,'Utilities / internet','S4 Launch Readiness',1,0.30,12,14,0,12,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),
  ('wbv3-s4-admin','office',null,'Admin / insurance','S4 Launch Readiness',1,0.35,12,14,0,12,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),
  ('wbv3-s4-travel','office',null,'Travel / marketing','S4 Launch Readiness',1,0.50,12,14,0,12,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),
  ('wbv3-s4-outsourcing','outsourcing',null,'Outsourcing envelope','S4 Launch Readiness',1,2.20,12,14,0,12,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','REVIEW REQUIRED: operating envelope 2.20 differs from service-detail total 1.90 ₹L/mo by 0.30.','system:migration'),
  ('wbv3-s4-consumables','office',null,'Office consumables','S4 Launch Readiness',1,0.20,12,14,0,12,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Stage-varying OPEX proposal.','system:migration'),
  ('wbv3-s4-contingency','office',null,'Other / contingency','S4 Launch Readiness',1,0.50,12,14,0,12,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),

  ('wbv3-s5-rent','office',null,'Rent','S5 Commercial Scale',1,1.00,15,36,0,15,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation; M15-M36.','system:migration'),
  ('wbv3-s5-payroll','payroll',null,'Payroll & manpower envelope','S5 Commercial Scale',1,4.20,15,36,0,15,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook envelope matches role-detail total for S5.','system:migration'),
  ('wbv3-s5-gst-ca','statutory',null,'GST / CA filing','S5 Commercial Scale',1,0.18,15,36,0,15,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Planning fee only; not statutory books.','system:migration'),
  ('wbv3-s5-utilities','office',null,'Utilities / internet','S5 Commercial Scale',1,0.38,15,36,0,15,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),
  ('wbv3-s5-admin','office',null,'Admin / insurance','S5 Commercial Scale',1,0.44,15,36,0,15,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),
  ('wbv3-s5-travel','office',null,'Travel / marketing','S5 Commercial Scale',1,0.70,15,36,0,15,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration'),
  ('wbv3-s5-outsourcing','outsourcing',null,'Outsourcing envelope','S5 Commercial Scale',1,1.45,15,36,0,15,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook envelope matches service-detail total for S5.','system:migration'),
  ('wbv3-s5-consumables','office',null,'Office consumables','S5 Commercial Scale',1,0.25,15,36,0,15,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Stage-varying OPEX proposal.','system:migration'),
  ('wbv3-s5-contingency','office',null,'Other / contingency','S5 Commercial Scale',1,0.60,15,36,0,15,'draft','WORKBOOK:V3-FINAL:OPERATING-COST-DETAIL','Workbook proposed allocation.','system:migration')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Office / administration equipment proposals.  Unique workbook IDs avoid
--    overwriting any operator-edited catalogue row that already exists.
-- ---------------------------------------------------------------------------
insert into vyndi_people_office_assets (
  id,name,category,asset_class,cost_lakh,monthly_cost_lakh,purchase_month,useful_life_months,
  allocation_pct,lifecycle_status,source_ref,notes,created_by
)
values
  ('wbv3-asset-computers','Computers / laptops','IT','office_admin',3.00,0,1,36,100,'draft','WORKBOOK:V3-FINAL:OFFICE-EQUIPMENT','Proposed: qty 4 @ ₹75,000 each.','system:migration'),
  ('wbv3-asset-desks','Tables / desks','Furniture','office_admin',0.60,0,1,60,100,'draft','WORKBOOK:V3-FINAL:OFFICE-EQUIPMENT','Proposed: qty 4 @ ₹15,000 each.','system:migration'),
  ('wbv3-asset-chairs','Chairs','Furniture','office_admin',0.48,0,1,60,100,'draft','WORKBOOK:V3-FINAL:OFFICE-EQUIPMENT','Proposed: qty 6 @ ₹8,000 each.','system:migration'),
  ('wbv3-asset-ac','Air conditioners','Facilities','office_admin',0.90,0,4,60,100,'draft','WORKBOOK:V3-FINAL:OFFICE-EQUIPMENT','Proposed: qty 2 @ ₹45,000 each.','system:migration'),
  ('wbv3-asset-water','Water dispenser','Facilities','office_admin',0.15,0,4,60,100,'draft','WORKBOOK:V3-FINAL:OFFICE-EQUIPMENT','Proposed: qty 1 @ ₹15,000.','system:migration'),
  ('wbv3-asset-sofa','Sofa / meeting seating','Furniture','office_admin',0.60,0,4,60,100,'draft','WORKBOOK:V3-FINAL:OFFICE-EQUIPMENT','Proposed: qty 1 @ ₹60,000.','system:migration'),
  ('wbv3-asset-eng-workstations','Additional engineering workstations','IT','office_admin',3.00,0,9,36,100,'draft','WORKBOOK:V3-FINAL:OFFICE-EQUIPMENT','Proposed: qty 3 @ ₹1,00,000 each.','system:migration'),
  ('wbv3-asset-qa-admin-it','QA / admin IT additions','IT','office_admin',1.50,0,12,36,100,'draft','WORKBOOK:V3-FINAL:OFFICE-EQUIPMENT','Proposed: qty 2 @ ₹75,000 each.','system:migration'),
  ('wbv3-asset-commercial-it','Commercial / support laptops','IT','office_admin',1.50,0,15,36,100,'draft','WORKBOOK:V3-FINAL:OFFICE-EQUIPMENT','Proposed: qty 2 @ ₹75,000 each.','system:migration')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Append-only audit evidence for the migration import itself.
-- ---------------------------------------------------------------------------
insert into vyndi_audit_events (
  id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,
  source_reference,payload_json,correlation_id,new_state,reason
)
select
  'AUD-WBV3-COST-' || c.id,
  'people_office_cost',c.id,c.record_revision,'PEOPLE_OFFICE_WORKBOOK_DRAFT_IMPORTED',
  'system:migration','system',c.source_ref,
  jsonb_build_object('stage',c.stage,'cost_group',c.cost_group,'monthly_unit_cost_lakh',c.monthly_unit_cost_lakh,'review_required',c.notes like 'REVIEW REQUIRED:%'),
  'PEOPLE_OFFICE|WORKBOOK_V3_FINAL',c.lifecycle_status,
  case when c.notes like 'REVIEW REQUIRED:%' then c.notes else 'Imported as reviewable workbook proposal; explicit approval required.' end
from vyndi_people_office_cost_items c
where c.id like 'wbv3-%'
on conflict (id) do nothing;

insert into vyndi_audit_events (
  id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,
  source_reference,payload_json,correlation_id,new_state,reason
)
select
  'AUD-WBV3-ASSET-' || a.id,
  'people_office_asset',a.id,a.record_revision,'PEOPLE_OFFICE_WORKBOOK_DRAFT_IMPORTED',
  'system:migration','system',a.source_ref,
  jsonb_build_object('category',a.category,'cost_lakh',a.cost_lakh,'purchase_month',a.purchase_month),
  'PEOPLE_OFFICE|WORKBOOK_V3_FINAL',a.lifecycle_status,
  'Imported as reviewable workbook proposal; invoice/evidence and explicit approval required.'
from vyndi_people_office_assets a
where a.id like 'wbv3-%'
on conflict (id) do nothing;

insert into vyndi_audit_events (
  id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json,
  correlation_id,new_state,reason
)
values (
  'AUD-WBV3-RECONCILIATION',
  'people_office_reconciliation','workbook-v3-final','PEOPLE_OFFICE_WORKBOOK_RECONCILIATION_FLAGGED',
  'system:migration','system','WORKBOOK:V3-FINAL',
  jsonb_build_object(
    'engine_36m_opex_lakh',273.2,
    'workbook_36m_detailed_opex_lakh',273.2,
    'office_equipment_lakh',11.73,
    'payroll_mismatches',jsonb_build_array(
      jsonb_build_object('stage','S3 Validation','envelope_lakh_per_month',1.85,'role_detail_lakh_per_month',2.10,'delta_lakh_per_month',0.25),
      jsonb_build_object('stage','S4 Launch Readiness','envelope_lakh_per_month',2.80,'role_detail_lakh_per_month',3.80,'delta_lakh_per_month',1.00)
    ),
    'outsourcing_mismatches',jsonb_build_array(
      jsonb_build_object('stage','S3 Validation','envelope_lakh_per_month',2.00,'service_detail_lakh_per_month',1.85,'delta_lakh_per_month',0.15),
      jsonb_build_object('stage','S4 Launch Readiness','envelope_lakh_per_month',2.20,'service_detail_lakh_per_month',1.90,'delta_lakh_per_month',0.30)
    )
  ),
  'PEOPLE_OFFICE|WORKBOOK_V3_FINAL','draft',
  'Workbook envelope reconciles to 36M finance model, but S3/S4 payroll and outsourcing decompositions require authorised review before approval.'
)
on conflict (id) do nothing;
