-- Register the complete governed VIBPE operating sequence for UI assurance.
-- Evidence-only: this migration does not alter business-source authority or transaction truth.

insert into vyndi_vibpe_ui_capability_registry
  (capability_id,domain,route_path,capability_name,capability_type,selector_hint,required_role,expected_service,expected_result,critical,notes)
values
  ('UI-VIBPE-WORKSPACE','governance','/command/ibpe-operating-workspace','VIBPE Operating Workspace renders','route',null,'observe','ibpe-operating-workspace','Governed operating report renders without error or authentication loop',true,'Canonical report-pack intelligence surface; advisory except for explicitly governed adapters'),
  ('UI-VIBPE-AUTHORITY','governance','/command/ibpe-operating-workspace/authority','Advanced Planning Authority renders','route',null,'observe','advanced-planning-authority','Capacity, routing and supplier-lane authority readiness renders without error',true,'Human authority workbench; no inferred supplier facts'),
  ('UI-VIBPE-OPTIMIZER','governance','/command/ibpe-operating-workspace/optimizer','Governed Optimizer renders','route',null,'observe','advanced-optimizer-control','Frozen packet, preparation gate and optimizer execution surface render without error',true,'Human initiated optimizer; advisory-only output'),
  ('UI-VIBPE-OUTPUTS','governance','/command/ibpe-operating-workspace/outputs','Outputs & Evidence renders','route',null,'observe','vibpe-governed-evidence','Consolidated authority, optimizer, assurance and release evidence renders without error',true,'Read-only evidence consolidation; no business writes'),
  ('UI-VIBPE-ASSURANCE','governance','/command/ibpe-operating-workspace/assurance','VIBPE Assurance renders','route',null,'observe','vibpe-assurance','Assurance page renders backend coverage, explicit gaps, exceptions and UI observations without mutating business truth',true,'Canonical assurance visibility surface'),
  ('UI-VIBPE-RELEASE','governance','/command/ibpe-operating-workspace/release','Release Readiness renders','route',null,'observe','vibpe-optimizer-release-closure','Production closure verdict and exact packet/run/audit lineage render without error',true,'Final GREEN / NOT GREEN evidence surface')
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

insert into vyndi_vibpe_surface_registry
  (surface_id,surface_type,surface_name,domain,owner_workspace,entity_type,coverage_status,evidence_source,notes)
values
  ('route:vibpe-workspace','route','/command/ibpe-operating-workspace','governance','command','ibpe_report','full','canonical ERP report pack + IBPE operating model','Management intelligence; runtime route proof remains independently observed'),
  ('route:vibpe-authority','route','/command/ibpe-operating-workspace/authority','governance','command','advanced_planning_authority','full','persisted capacity/routing/supplier-lane authorities','Governed approval workbench; runtime route proof remains independently observed'),
  ('route:vibpe-optimizer','route','/command/ibpe-operating-workspace/optimizer','governance','command','advanced_optimization_run','full','immutable advanced packet + HiGHS execution authority','Advisory-only optimizer; runtime route proof remains independently observed'),
  ('route:vibpe-outputs','route','/command/ibpe-operating-workspace/outputs','governance','command','governed_evidence_bundle','full','authority + optimizer + assurance + release evidence','Read-only consolidated evidence surface'),
  ('route:vibpe-assurance','route','/command/ibpe-operating-workspace/assurance','governance','command','vibpe_assurance_snapshot','full','VIBPE canonical assurance backend + UI observation registry','Read-only assurance visibility plus approval-gated snapshot capture'),
  ('route:vibpe-release','route','/command/ibpe-operating-workspace/release','governance','command','optimizer_release_closure','full','runtime + packet + optimizer run + audit lineage','Final production closure verdict; runtime route proof remains independently observed')
on conflict (surface_id) do update set
  surface_type=excluded.surface_type,
  surface_name=excluded.surface_name,
  domain=excluded.domain,
  owner_workspace=excluded.owner_workspace,
  entity_type=excluded.entity_type,
  coverage_status=excluded.coverage_status,
  evidence_source=excluded.evidence_source,
  notes=excluded.notes;
