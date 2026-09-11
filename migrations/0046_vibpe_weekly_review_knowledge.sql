-- VIBPE governed weekly-review knowledge ingestion
-- Weekly status reviews are evidence inputs, not authoritative master data.

create table if not exists vibpe_knowledge_sources (
  id text primary key,
  source_type text not null check (source_type in ('google-drive-folder','google-drive-document','manual','repository')),
  name text not null,
  external_id text,
  external_url text,
  authority text not null default 'advisory' check (authority in ('authoritative','advisory','unresolved')),
  is_enabled boolean not null default true,
  last_ingested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vibpe_knowledge_sources_external_id_uq
  on vibpe_knowledge_sources(source_type, external_id)
  where external_id is not null;

create table if not exists vibpe_knowledge_documents (
  id text primary key,
  source_id text not null references vibpe_knowledge_sources(id) on delete cascade,
  external_id text not null,
  external_url text,
  title text not null,
  review_date date,
  source_revision text,
  content_hash text not null,
  ingested_at timestamptz not null default now(),
  superseded_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  unique (source_id, external_id, content_hash)
);

create index if not exists vibpe_knowledge_documents_source_date_idx
  on vibpe_knowledge_documents(source_id, review_date desc, ingested_at desc);

create table if not exists vibpe_knowledge_claims (
  id text primary key,
  document_id text not null references vibpe_knowledge_documents(id) on delete cascade,
  domain text not null,
  claim_class text not null check (
    claim_class in ('verified_fact','unresolved_item','assumption','decision','blocker','priority','material_change')
  ),
  subject_key text,
  claim_text text not null,
  authority text not null check (authority in ('authoritative','advisory','unresolved')),
  confidence numeric(4,3) not null default 0.500 check (confidence >= 0 and confidence <= 1),
  conflicts_with text,
  source_locator text,
  created_at timestamptz not null default now()
);

create index if not exists vibpe_knowledge_claims_lookup_idx
  on vibpe_knowledge_claims(domain, subject_key, authority, created_at desc);

insert into vibpe_knowledge_sources
  (id, source_type, name, external_id, external_url, authority, is_enabled)
values
  (
    'VIBPE-SRC-WEEKLY-REVIEWS',
    'google-drive-folder',
    'VYNDI Weekly Status Reviews — VIBPE Knowledge',
    '1_2Py8ORHfR2zyhT4S-nUL0PYihK87T12',
    'https://drive.google.com/drive/folders/1_2Py8ORHfR2zyhT4S-nUL0PYihK87T12',
    'advisory',
    true
  )
on conflict (id) do update set
  external_id = excluded.external_id,
  external_url = excluded.external_url,
  name = excluded.name,
  is_enabled = true,
  updated_at = now();


-- Bootstrap the first approved weekly review so VIBPE has governed evidence
-- immediately after migration. A later Drive sync of the same file may create a
-- new content-hash version and supersede this bootstrap while preserving lineage.
insert into vibpe_knowledge_documents
  (id, source_id, external_id, external_url, title, review_date, source_revision, content_hash, metadata_json)
values
  (
    'VIBPE-DOC-2026-09-11-WEEKLY',
    'VIBPE-SRC-WEEKLY-REVIEWS',
    '1coxzliGfYBnWYEapT-taD73ygsC7wBnMrKMV-LUvI1g',
    'https://docs.google.com/document/d/1coxzliGfYBnWYEapT-taD73ygsC7wBnMrKMV-LUvI1g/edit',
    'VYNDI Weekly Status Review — 2026-09-11',
    date '2026-09-11',
    'bootstrap-approved-review',
    '11e9f7bd4d81c2373d48d15c8bb44c25cfe8c89551f55572378579638495a2fa',
    '{"provider":"google-drive","bootstrap":true,"knowledge_role":"governed-weekly-review-evidence"}'::jsonb
  )
on conflict (id) do nothing;

insert into vibpe_knowledge_claims
  (id, document_id, domain, claim_class, subject_key, claim_text, authority, confidence, source_locator)
values
  ('VIBPE-CLAIM-20260911-01','VIBPE-DOC-2026-09-11-WEEKLY','engineering','verified_fact','engineering.baseline','Engineering baseline remains substantially defined around the VEDM dossier structure, T47i 85.5 mm bottom bracket, IS52/IS41 headset, 380 mm fork axle-to-crown, 27.2 mm seatpost and 12×100/12×142 axles.','advisory',0.750,'Design / Engineering'),
  ('VIBPE-CLAIM-20260911-02','VIBPE-DOC-2026-09-11-WEEKLY','engineering','unresolved_item','engineering.700x40','The 700×40 requirement and resulting fork, down-tube, toe-overlap and rear-triangle clearance validation remain unresolved before final CAD design freeze.','unresolved',0.850,'Design / Engineering'),
  ('VIBPE-CLAIM-20260911-03','VIBPE-DOC-2026-09-11-WEEKLY','manufacturing','unresolved_item','prototype.physical-evidence','No newly verified evidence in the review established tooling release, prototype manufacture, physical coupon testing or completed frame validation.','unresolved',0.800,'Prototype & Manufacturing'),
  ('VIBPE-CLAIM-20260911-04','VIBPE-DOC-2026-09-11-WEEKLY','incubation','unresolved_item','incubation.current-status','TANSAM/TANCAM engagement, NDA/FRS work and NX/Simcenter discussions remain established tracks, but the review did not verify a new incubation approval, facility allocation or engineering work package.','unresolved',0.750,'Incubation'),
  ('VIBPE-CLAIM-20260911-05','VIBPE-DOC-2026-09-11-WEEKLY','operations','material_change','vibpe.operating-system','VIBPE/ERP operating infrastructure advanced through management-action lifecycle, Action Inbox integration, shortage reconciliation and scalable operational registers.','advisory',0.800,'Business Operating System / VIBPE'),
  ('VIBPE-CLAIM-20260911-06','VIBPE-DOC-2026-09-11-WEEKLY','launch','verified_fact','launch.readiness','Launch readiness remains AMBER because physical design validation, prototype evidence and manufacturing readiness are not yet sufficient for a GREEN assessment.','advisory',0.750,'Launch Readiness'),
  ('VIBPE-CLAIM-20260911-07','VIBPE-DOC-2026-09-11-WEEKLY','engineering','blocker','engineering.design-freeze','Freeze the clearance architecture around the 700×40 requirement before production CAD release.','unresolved',0.900,'Blockers and Decisions'),
  ('VIBPE-CLAIM-20260911-08','VIBPE-DOC-2026-09-11-WEEKLY','manufacturing','blocker','prototype.transition','The programme must transition from dossiers and software into physical evidence through CAD release, FEA/CFD, laminate/manufacturing definition, prototype and test.','unresolved',0.900,'Blockers and Decisions'),
  ('VIBPE-CLAIM-20260911-09','VIBPE-DOC-2026-09-11-WEEKLY','engineering','priority','priority.1','Close engineering design freeze with one authoritative Rev 5.3.8 geometry/interface/clearance baseline across all sizes, including 700×40 proof and corrected 380 mm fork architecture.','advisory',0.900,'Next Three Priorities'),
  ('VIBPE-CLAIM-20260911-10','VIBPE-DOC-2026-09-11-WEEKLY','manufacturing','priority','priority.2','Move into physical prototype evidence: manufacturable CAD/laminate data, FEA/CFD and DFM review, then the first prototype build-and-test gate.','advisory',0.900,'Next Three Priorities'),
  ('VIBPE-CLAIM-20260911-11','VIBPE-DOC-2026-09-11-WEEKLY','operations','priority','priority.3','Stabilize VIBPE by validating the controlled end-to-end workflow from confirmed demand through BOM, shortage, Action Inbox, procurement, inventory/GRN, production/job card/traveller, finance and audit.','advisory',0.900,'Next Three Priorities')
on conflict (id) do nothing;

insert into vyndi_audit_events
  (id, entity_type, entity_id, entity_revision, action, actor_user_id, actor_role, source_reference, payload_json)
values
  (
    'AUD-VIBPE-KNOWLEDGE-BOOTSTRAP-20260911',
    'vibpe_knowledge_document',
    'VIBPE-DOC-2026-09-11-WEEKLY',
    1,
    'knowledge_bootstrap',
    'system:migration',
    'system',
    'GOOGLE-DRIVE:1coxzliGfYBnWYEapT-taD73ygsC7wBnMrKMV-LUvI1g',
    '{"source_id":"VIBPE-SRC-WEEKLY-REVIEWS","review_date":"2026-09-11","claim_count":11}'::jsonb
  )
on conflict (id) do nothing;
