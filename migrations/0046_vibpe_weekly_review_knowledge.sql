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
