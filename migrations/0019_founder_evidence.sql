create table if not exists founder_evidence_events (
  id uuid primary key,
  action_id text not null,
  evidence_type text not null,
  evidence_ref text,
  note text not null,
  actor_user_id text not null,
  actor_role text not null,
  created_at timestamptz not null default now()
);

create index if not exists founder_evidence_action_created_idx
  on founder_evidence_events (action_id, created_at desc);

create index if not exists founder_evidence_created_idx
  on founder_evidence_events (created_at desc);
