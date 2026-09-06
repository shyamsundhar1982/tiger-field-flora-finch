create table if not exists governance_audit_events (
  id uuid primary key,
  event_type text not null,
  gate_id text not null,
  actor_user_id text not null,
  actor_role text not null,
  decision text not null,
  evidence_ref text,
  outcome text not null,
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists governance_audit_events_gate_created_idx
  on governance_audit_events (gate_id, created_at desc);

create index if not exists governance_audit_events_actor_created_idx
  on governance_audit_events (actor_user_id, created_at desc);
