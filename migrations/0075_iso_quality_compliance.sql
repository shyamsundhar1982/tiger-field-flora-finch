-- ISO Quality & Product Compliance authority.
-- This migration stores internal requirement mappings and evidence references only.
-- Copyrighted ISO requirement/test text and acceptance tables remain in controlled copies.

create table if not exists vyndi_iso_standards (
  id text primary key,
  standard_code text not null,
  edition text not null,
  domain text not null,
  lifecycle_status text not null check (lifecycle_status in ('current','transition_watch','watch','withdrawn')),
  scope_summary text not null,
  source_url text not null,
  controlled_copy_ref text,
  amendment_watch_ref text,
  effective_on date,
  review_on date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (standard_code, edition)
);

create table if not exists vyndi_iso_requirements (
  id text primary key,
  standard_id text not null references vyndi_iso_standards(id) on delete restrict,
  clause_ref text,
  internal_requirement text not null,
  applicability text not null,
  criticality text not null check (criticality in ('standard','major','release_critical')),
  verification_method text not null,
  acceptance_ref text not null,
  owner text not null,
  status text not null default 'active' check (status in ('draft','active','superseded')),
  source_ref text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vyndi_iso_requirements_standard_idx
  on vyndi_iso_requirements (standard_id, status, criticality);

create table if not exists vyndi_iso_test_methods (
  id text primary key,
  standard_id text not null references vyndi_iso_standards(id) on delete restrict,
  clause_ref text,
  method_family text not null,
  internal_method_name text not null,
  scope_summary text not null,
  controlled_method_ref text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vyndi_iso_test_methods_standard_idx
  on vyndi_iso_test_methods (standard_id, active, method_family);

create table if not exists vyndi_iso_itps (
  id text primary key,
  family_code text not null references vyndi_product_families(family_code) on delete restrict,
  variant_id text references vyndi_product_variants(variant_id) on delete restrict,
  engineering_revision text not null,
  name text not null,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','superseded')),
  source_ref text not null,
  prepared_by text not null,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists vyndi_iso_itp_revision_uq
  on vyndi_iso_itps (family_code, coalesce(variant_id,''), engineering_revision, id);
create index if not exists vyndi_iso_itp_release_idx
  on vyndi_iso_itps (family_code, engineering_revision, status, updated_at desc);

create table if not exists vyndi_iso_itp_items (
  id text primary key,
  itp_id text not null references vyndi_iso_itps(id) on delete restrict,
  requirement_id text not null references vyndi_iso_requirements(id) on delete restrict,
  test_method_id text references vyndi_iso_test_methods(id) on delete restrict,
  sequence_no integer not null check (sequence_no > 0),
  mandatory boolean not null default true,
  acceptance_ref text not null,
  notes text not null default '',
  unique (itp_id, requirement_id, test_method_id)
);
create index if not exists vyndi_iso_itp_items_itp_idx
  on vyndi_iso_itp_items (itp_id, sequence_no);

create table if not exists vyndi_iso_measurement_equipment (
  id text primary key,
  equipment_type text not null,
  manufacturer text,
  model text,
  serial_number text,
  calibration_required boolean not null default true,
  calibrated_on date,
  calibration_due_on date,
  certificate_ref text,
  status text not null default 'active' check (status in ('active','out_of_service','retired')),
  notes text not null default '',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (calibration_due_on is null or calibrated_on is null or calibration_due_on >= calibrated_on),
  check (not calibration_required or status <> 'active' or (calibrated_on is not null and calibration_due_on is not null and certificate_ref is not null))
);
create index if not exists vyndi_iso_equipment_calibration_idx
  on vyndi_iso_measurement_equipment (status, calibration_due_on);

create table if not exists vyndi_iso_test_runs (
  id text primary key,
  itp_id text not null references vyndi_iso_itps(id) on delete restrict,
  itp_item_id text not null references vyndi_iso_itp_items(id) on delete restrict,
  test_method_id text references vyndi_iso_test_methods(id) on delete restrict,
  family_code text not null references vyndi_product_families(family_code) on delete restrict,
  variant_id text references vyndi_product_variants(variant_id) on delete restrict,
  engineering_revision text not null,
  specimen_ref text not null,
  traveller_id text references epr_travellers(id) on delete restrict,
  serial_number text,
  laboratory_name text not null,
  lab_iso17025_status text not null default 'not_claimed' check (lab_iso17025_status in ('not_claimed','confirmed','not_applicable')),
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','completed')),
  result text not null default 'scheduled' check (result in ('scheduled','pass','fail','conditional','invalid')),
  evidence_ref text,
  analysis_ref text,
  deviation_ref text,
  ncr_id text references vyndi_quality_ncrs(id) on delete restrict,
  retest_of text references vyndi_iso_test_runs(id) on delete restrict,
  started_at timestamptz,
  completed_at timestamptz,
  notes text not null default '',
  recorded_by text not null,
  recorded_role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (result <> 'fail' or ncr_id is not null),
  check (result = 'scheduled' or evidence_ref is not null)
);
create index if not exists vyndi_iso_test_runs_itp_idx
  on vyndi_iso_test_runs (itp_id, itp_item_id, result, completed_at desc);
create index if not exists vyndi_iso_test_runs_revision_idx
  on vyndi_iso_test_runs (family_code, engineering_revision, result, completed_at desc);

create table if not exists vyndi_iso_test_run_equipment (
  test_run_id text not null references vyndi_iso_test_runs(id) on delete restrict,
  equipment_id text not null references vyndi_iso_measurement_equipment(id) on delete restrict,
  certificate_ref_snapshot text,
  calibration_due_on_snapshot date,
  calibration_valid_at_test boolean not null,
  primary key (test_run_id, equipment_id)
);

create table if not exists vyndi_iso_product_release_decisions (
  id text primary key,
  family_code text not null references vyndi_product_families(family_code) on delete restrict,
  variant_id text references vyndi_product_variants(variant_id) on delete restrict,
  engineering_revision text not null,
  itp_id text not null references vyndi_iso_itps(id) on delete restrict,
  decision text not null check (decision in ('approved','blocked')),
  evidence_completeness_pct numeric(5,2) not null check (evidence_completeness_pct between 0 and 100),
  mandatory_test_count integer not null default 0 check (mandatory_test_count >= 0),
  passed_test_count integer not null default 0 check (passed_test_count >= 0),
  open_ncr_count integer not null default 0 check (open_ncr_count >= 0),
  open_capa_count integer not null default 0 check (open_capa_count >= 0),
  invalid_calibration_count integer not null default 0 check (invalid_calibration_count >= 0),
  engineering_approval_ref text,
  quality_approval_ref text,
  decision_reason text not null,
  source_ref text not null,
  decided_by text not null,
  decided_role text not null,
  decided_at timestamptz not null default now(),
  superseded_at timestamptz,
  check (decision <> 'approved' or (engineering_approval_ref is not null and quality_approval_ref is not null))
);
create unique index if not exists vyndi_iso_release_current_uq
  on vyndi_iso_product_release_decisions (family_code, coalesce(variant_id,''), engineering_revision)
  where superseded_at is null;

insert into vyndi_iso_standards
  (id,standard_code,edition,domain,lifecycle_status,scope_summary,source_url,controlled_copy_ref,amendment_watch_ref,notes)
values
  ('ISO-4210-2-2023','ISO 4210-2','2023','bicycle_product_safety','current','Bicycle safety and performance requirements applicable to the controlled product configuration.','https://www.iso.org/standard/78077.html',null,'ISO 4210-2:2023/CD Amd 1','Use a licensed controlled copy for clause text and acceptance criteria.'),
  ('ISO-4210-3-2023','ISO 4210-3','2023','bicycle_common_test_methods','current','Common bicycle test methods supporting the ISO 4210 requirement framework.','https://www.iso.org/standard/78079.html',null,'ISO 4210-3:2023 amendment watch','Use a licensed controlled copy for detailed test methods.'),
  ('ISO-4210-6-2023','ISO 4210-6','2023','frame_fork_validation','current','Frame and fork test-method authority used for VAYU structural validation.','https://www.iso.org/standard/78081.html',null,null,'Store only internal method IDs, controlled references and evidence in VYNDI.'),
  ('ISO-9001-2015','ISO 9001','2015','quality_management_system','current','Quality-management-system control baseline pending controlled transition to the next published edition.','https://www.iso.org/standard/62085.html',null,'ISO 9001 Edition 6 / 2026 publication transition','ISO 9001 Edition 6 is under publication as of 2026-09-15; activate only after official publication and impact review.'),
  ('ISO-9001-2026-WATCH','ISO 9001','2026','quality_management_system','transition_watch','Next ISO 9001 edition held as a transition watch item until official publication and controlled adoption.','https://www.iso.org/standard/9001',null,'Publication/adoption review', 'Do not treat this watch record as an adopted certification basis until Quality approves the transition.'),
  ('ISO-10012-2026','ISO 10012','2026','measurement_management','current','Measurement-management controls for confidence in measurement validity and reliability.','https://www.iso.org/standard/10012.html',null,null,'Calibration validity is enforced at ISO test execution.'),
  ('ISO-IEC-17025-2017','ISO/IEC 17025','2017','laboratory_competence','current','Laboratory competence evidence and accreditation-status recording for test evidence.','https://www.iso.org/standard/66912.html',null,null,'Accreditation status is evidence metadata; VYNDI does not itself certify a laboratory.')
on conflict (id) do update set
  lifecycle_status=excluded.lifecycle_status,
  source_url=excluded.source_url,
  amendment_watch_ref=excluded.amendment_watch_ref,
  notes=excluded.notes,
  updated_at=now();

-- Internal requirement IDs deliberately paraphrase intent and point back to the controlled copy.
insert into vyndi_iso_requirements
  (id,standard_id,clause_ref,internal_requirement,applicability,criticality,verification_method,acceptance_ref,owner,status,source_ref)
values
  ('ISO4210-SAFETY-MATRIX','ISO-4210-2-2023',null,'Maintain an approved applicability matrix for all safety and performance requirements relevant to the released bicycle configuration.','road/racing bicycle','release_critical','document review + linked verification evidence','CONTROLLED-ISO4210-2-MATRIX','Engineering + Quality','active','ISO-COMPLIANCE-V1'),
  ('ISO4210-COMMON-METHODS','ISO-4210-3-2023',null,'Use the controlled common-test-method references applicable to each physical verification activity.','all applicable physical tests','major','test-plan review','CONTROLLED-ISO4210-3-METHOD','Quality','active','ISO-COMPLIANCE-V1'),
  ('ISO4210-FRAME-IMPACT','ISO-4210-6-2023',null,'Verify frame impact resistance through the approved controlled frame-impact method and retain raw evidence.','frame','release_critical','physical test','CONTROLLED-ISO4210-6-FRAME-IMPACT','Engineering + Quality','active','ISO-COMPLIANCE-V1'),
  ('ISO4210-FRAME-FATIGUE','ISO-4210-6-2023',null,'Verify the required frame fatigue load cases and retain test and failure-location evidence.','frame','release_critical','physical fatigue test','CONTROLLED-ISO4210-6-FRAME-FATIGUE','Engineering + Quality','active','ISO-COMPLIANCE-V1'),
  ('ISO4210-FORK-STRENGTH','ISO-4210-6-2023',null,'Verify fork strength and impact behaviour using approved controlled methods and evidence.','fork','release_critical','physical test','CONTROLLED-ISO4210-6-FORK-STRENGTH','Engineering + Quality','active','ISO-COMPLIANCE-V1'),
  ('ISO4210-FORK-FATIGUE','ISO-4210-6-2023',null,'Verify fork fatigue behaviour using approved controlled methods and evidence.','fork','release_critical','physical fatigue test','CONTROLLED-ISO4210-6-FORK-FATIGUE','Engineering + Quality','active','ISO-COMPLIANCE-V1'),
  ('ISO4210-BRAKE-MOUNT','ISO-4210-6-2023',null,'Verify applicable frame/fork brake-mount structural behaviour and evidence.','frame/fork brake mounts','release_critical','physical test','CONTROLLED-ISO4210-6-BRAKE-MOUNT','Engineering + Quality','active','ISO-COMPLIANCE-V1'),
  ('ISO10012-MEASUREMENT-VALIDITY','ISO-10012-2026',null,'Use only measurement equipment with valid calibration evidence when calibration is required.','all measured verification','release_critical','calibration-system check','CONTROLLED-ISO10012-MEASUREMENT','Quality','active','ISO-COMPLIANCE-V1'),
  ('ISO17025-LAB-EVIDENCE','ISO-IEC-17025-2017',null,'Record laboratory competence/accreditation status and link supporting evidence where external accredited testing is claimed.','laboratory testing','major','laboratory evidence review','CONTROLLED-ISO17025-LAB','Quality','active','ISO-COMPLIANCE-V1'),
  ('ISO9001-DESIGN-RELEASE','ISO-9001-2015',null,'Maintain controlled design, verification, nonconformance and approval evidence before product release.','QMS design/release','release_critical','QMS record review','CONTROLLED-QMS-DESIGN-RELEASE','Engineering + Quality','active','ISO-COMPLIANCE-V1')
on conflict (id) do update set
  standard_id=excluded.standard_id,
  internal_requirement=excluded.internal_requirement,
  acceptance_ref=excluded.acceptance_ref,
  updated_at=now();

insert into vyndi_iso_test_methods
  (id,standard_id,clause_ref,method_family,internal_method_name,scope_summary,controlled_method_ref,active)
values
  ('FR-IMP-01','ISO-4210-6-2023',null,'frame_impact','Frame impact verification A','Frame impact verification using the applicable controlled ISO 4210-6 procedure.','CONTROLLED-ISO4210-6-FR-IMP-A',true),
  ('FR-IMP-02','ISO-4210-6-2023',null,'frame_impact','Frame/fork assembly impact verification','Frame and fork assembly impact verification using the applicable controlled procedure.','CONTROLLED-ISO4210-6-FR-IMP-B',true),
  ('FR-FAT-01','ISO-4210-6-2023',null,'frame_fatigue','Frame pedalling-load fatigue verification','Controlled fatigue verification representing the applicable pedalling load case.','CONTROLLED-ISO4210-6-FR-FAT-PEDAL',true),
  ('FR-FAT-02','ISO-4210-6-2023',null,'frame_fatigue','Frame horizontal-load fatigue verification','Controlled fatigue verification representing the applicable horizontal load case.','CONTROLLED-ISO4210-6-FR-FAT-H',true),
  ('FR-FAT-03','ISO-4210-6-2023',null,'frame_fatigue','Frame vertical-load fatigue verification','Controlled fatigue verification representing the applicable vertical load case.','CONTROLLED-ISO4210-6-FR-FAT-V',true),
  ('FR-BRK-01','ISO-4210-6-2023',null,'brake_mount','Frame brake-mount verification','Controlled structural verification for the applicable frame brake-mount configuration.','CONTROLLED-ISO4210-6-FR-BRK',true),
  ('FK-STR-01','ISO-4210-6-2023',null,'fork_strength','Fork tensile/retention strength verification','Controlled fork strength verification for the applicable fork configuration.','CONTROLLED-ISO4210-6-FK-STR-A',true),
  ('FK-STR-02','ISO-4210-6-2023',null,'fork_strength','Fork static-bending verification','Controlled static fork strength verification.','CONTROLLED-ISO4210-6-FK-STR-B',true),
  ('FK-IMP-01','ISO-4210-6-2023',null,'fork_impact','Fork impact verification','Controlled fork impact verification.','CONTROLLED-ISO4210-6-FK-IMP',true),
  ('FK-FAT-01','ISO-4210-6-2023',null,'fork_fatigue','Fork fatigue verification','Controlled cyclic fork verification.','CONTROLLED-ISO4210-6-FK-FAT',true),
  ('FK-BRK-01','ISO-4210-6-2023',null,'brake_mount','Fork disc-brake structural verification','Controlled verification for the applicable disc-brake fork configuration.','CONTROLLED-ISO4210-6-FK-BRK',true),
  ('FK-STM-01','ISO-4210-6-2023',null,'steerer_interface','Fork steerer/interface fatigue verification','Controlled fatigue verification for the applicable steerer/interface assembly.','CONTROLLED-ISO4210-6-FK-STM',true)
on conflict (id) do update set
  controlled_method_ref=excluded.controlled_method_ref,
  active=excluded.active,
  updated_at=now();

create or replace view vyndi_vibpe_iso_release_status as
with approved_itp as (
  select distinct on (i.family_code,coalesce(i.variant_id,''),i.engineering_revision)
    i.*
  from vyndi_iso_itps i
  where i.status='approved'
  order by i.family_code,coalesce(i.variant_id,''),i.engineering_revision,i.approved_at desc nulls last,i.updated_at desc
),
itp_counts as (
  select
    x.itp_id,
    count(*) filter (where x.mandatory)::int as mandatory_test_count,
    count(*) filter (
      where x.mandatory and exists (
        select 1 from vyndi_iso_test_runs r
        where r.itp_item_id=x.id and r.result='pass'
      )
    )::int as passed_test_count
  from vyndi_iso_itp_items x
  group by x.itp_id
),
quality_counts as (
  select
    r.itp_id,
    count(distinct n.id) filter (where n.status not in ('closed','rejected'))::int as open_ncr_count,
    count(distinct c.id) filter (where c.status not in ('closed','rejected'))::int as open_capa_count,
    count(distinct eq.test_run_id) filter (where eq.calibration_valid_at_test=false)::int as invalid_calibration_count
  from vyndi_iso_test_runs r
  left join vyndi_quality_ncrs n on n.id=r.ncr_id
  left join vyndi_quality_capas c on c.ncr_id=n.id
  left join vyndi_iso_test_run_equipment eq on eq.test_run_id=r.id
  group by r.itp_id
),
current_decision as (
  select * from vyndi_iso_product_release_decisions where superseded_at is null
)
select
  b.family_code,
  b.variant_id,
  b.revision_code as engineering_revision,
  b.id as engineering_baseline_id,
  b.status as engineering_status,
  i.id as itp_id,
  i.status as itp_status,
  coalesce(k.mandatory_test_count,0) as mandatory_test_count,
  coalesce(k.passed_test_count,0) as passed_test_count,
  case when coalesce(k.mandatory_test_count,0)=0 then 0::numeric
       else round(100.0 * coalesce(k.passed_test_count,0) / k.mandatory_test_count,2) end as evidence_completeness_pct,
  coalesce(q.open_ncr_count,0) as open_ncr_count,
  coalesce(q.open_capa_count,0) as open_capa_count,
  coalesce(q.invalid_calibration_count,0) as invalid_calibration_count,
  d.decision as recorded_release_decision,
  d.engineering_approval_ref,
  d.quality_approval_ref,
  d.decided_at,
  case
    when d.decision='approved' then 'approved'
    when i.id is null then 'blocked_no_approved_itp'
    when coalesce(k.mandatory_test_count,0)=0 then 'blocked_no_mandatory_verification'
    when coalesce(k.passed_test_count,0) <> coalesce(k.mandatory_test_count,0) then 'blocked_incomplete_verification'
    when coalesce(q.open_ncr_count,0)>0 or coalesce(q.open_capa_count,0)>0 then 'blocked_open_quality_action'
    when coalesce(q.invalid_calibration_count,0)>0 then 'blocked_invalid_calibration'
    else 'ready_for_dual_approval'
  end as release_status
from vyndi_engineering_baselines b
left join approved_itp i
  on i.family_code=b.family_code
 and i.variant_id is not distinct from b.variant_id
 and i.engineering_revision=b.revision_code
left join itp_counts k on k.itp_id=i.id
left join quality_counts q on q.itp_id=i.id
left join current_decision d
  on d.family_code=b.family_code
 and d.variant_id is not distinct from b.variant_id
 and d.engineering_revision=b.revision_code
where b.status='released';

comment on table vyndi_iso_standards is
  'Version-controlled standards register. Full copyrighted ISO text is not stored here.';
comment on table vyndi_iso_requirements is
  'Internal requirement IDs mapped to controlled standard references and internal acceptance criteria.';
comment on view vyndi_vibpe_iso_release_status is
  'Governed VIBPE-readable ISO product-release readiness projection; it does not itself authorize release.';
