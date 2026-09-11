-- VYNDI IBPE action idempotency and smoke-test duplicate reconciliation.
-- Additive governance hardening: protected ERP transaction tables are untouched.

alter table vyndi_ibpe_management_actions
  add column if not exists source_proposal_id text;

-- Backfill proposal lineage from the append-only audit trail where available.
update vyndi_ibpe_management_actions a
   set source_proposal_id = (
     select e.payload_json->>'proposalId'
       from vyndi_audit_events e
      where e.entity_type='ibpe_management_action'
        and e.entity_id=a.id
        and e.action='created_from_confirmed_update'
        and coalesce(e.payload_json->>'proposalId','')<>''
      order by e.created_at asc
      limit 1
   )
 where a.source_proposal_id is null
   and exists (
     select 1
       from vyndi_audit_events e
      where e.entity_type='ibpe_management_action'
        and e.entity_id=a.id
        and e.action='created_from_confirmed_update'
        and coalesce(e.payload_json->>'proposalId','')<>''
   );

create unique index if not exists vyndi_ibpe_management_actions_source_proposal_uidx
  on vyndi_ibpe_management_actions (source_proposal_id)
  where source_proposal_id is not null;

-- Reconcile existing exact duplicate active actions created during repeated smoke tests.
-- Preserve the earliest action as canonical; cancel later exact duplicates and audit them.
with ranked as (
  select id,
         first_value(id) over (
           partition by lower(trim(title)),lower(trim(issue))
           order by created_at,id
         ) as canonical_id,
         row_number() over (
           partition by lower(trim(title)),lower(trim(issue))
           order by created_at,id
         ) as rn
    from vyndi_ibpe_management_actions
   where status in ('open','in_progress','blocked')
)
insert into vyndi_audit_events
  (id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
select 'AUD-IBPE-DEDUP-'||id,
       'ibpe_management_action',
       id,
       'cancelled_duplicate',
       'system:0045',
       'migration',
       '0045_ibpe_action_idempotency_lifecycle',
       jsonb_build_object('canonicalActionId',canonical_id,'reason','Exact active duplicate reconciled during IBPE smoke-test hardening')
  from ranked
 where rn>1
on conflict (id) do nothing;

with ranked as (
  select id,
         row_number() over (
           partition by lower(trim(title)),lower(trim(issue))
           order by created_at,id
         ) as rn
    from vyndi_ibpe_management_actions
   where status in ('open','in_progress','blocked')
)
update vyndi_ibpe_management_actions a
   set status='cancelled',
       revision=revision+1,
       updated_by='system:0045',
       updated_by_role='migration',
       updated_at=now()
  from ranked r
 where a.id=r.id and r.rn>1;

comment on column vyndi_ibpe_management_actions.source_proposal_id is
  'Authorised IBPE Business Update proposal that created this action. Unique when present so retries cannot create duplicate actions.';
