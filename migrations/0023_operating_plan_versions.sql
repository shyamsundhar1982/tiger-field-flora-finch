create table if not exists operating_plan_versions (
  id uuid primary key,
  revision_no bigserial unique,
  status text not null check (status in ('draft','submitted','published','superseded','rejected')),
  label text not null default 'Rolling 36-month Operating Plan',
  plan jsonb not null,
  change_reason text not null,
  source_version_id uuid references operating_plan_versions(id),
  created_by text not null,
  created_role text not null,
  created_at timestamptz not null default now(),
  submitted_by text,
  submitted_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  published_by text,
  published_at timestamptz,
  rejected_by text,
  rejected_at timestamptz
);

create unique index if not exists operating_plan_one_published
  on operating_plan_versions ((status))
  where status = 'published';

create index if not exists operating_plan_versions_status_created
  on operating_plan_versions (status, created_at desc);

create index if not exists operating_plan_versions_source
  on operating_plan_versions (source_version_id);
