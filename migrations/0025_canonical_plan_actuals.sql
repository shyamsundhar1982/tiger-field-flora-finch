-- ---------------------------------------------------------------------------
-- 5. Central Actuals + approved/draft plan revisions + operating action state.
--    The existing Zustand state may remain a local editing cache, but these are
--    the multi-user business records and approval history.
-- ---------------------------------------------------------------------------
create table if not exists vyndi_plan_revisions (
  id text primary key,
  revision integer not null unique check (revision > 0),
  status text not null check (status in ('draft','pending_approval','approved','superseded','rejected')),
  horizon_months integer not null default 36 check (horizon_months = 36),
  scenario text not null check (scenario in ('base','delayed','stress')),
  draw_standby boolean not null default true,
  finance_json jsonb not null,
  accounting_json jsonb not null,
  change_reason text not null default '',
  created_by text not null,
  created_at timestamptz not null default now(),
  submitted_by text,
  submitted_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  supersedes_id text references vyndi_plan_revisions(id) on delete restrict
);

create unique index if not exists vyndi_plan_one_approved_uidx
  on vyndi_plan_revisions ((status)) where status='approved';
create index if not exists vyndi_plan_revision_idx
  on vyndi_plan_revisions (revision desc, created_at desc);
create unique index if not exists vyndi_plan_one_draft_per_actor_uidx
  on vyndi_plan_revisions (created_by) where status='draft';

create or replace function save_vyndi_plan_draft(
  p_id text,
  p_scenario text,
  p_draw_standby boolean,
  p_horizon_months integer,
  p_finance_json jsonb,
  p_accounting_json jsonb,
  p_change_reason text,
  p_actor_user_id text,
  p_actor_role text
) returns table (plan_id text, revision integer)
language plpgsql
as $$
declare v_id text; v_revision integer;
begin
  if p_horizon_months<>36 then raise exception 'VYNDI operating plan horizon must remain 36 months.'; end if;
  perform pg_advisory_xact_lock(hashtext('plan-draft|' || p_actor_user_id)::bigint);
  select pr.id,pr.revision into v_id,v_revision
    from vyndi_plan_revisions as pr where pr.created_by=p_actor_user_id and pr.status='draft'
    order by pr.created_at desc limit 1 for update;
  if not found then
    perform pg_advisory_xact_lock(hashtext('vyndi-plan-revision-sequence')::bigint);
    select coalesce(max(pr.revision),0)+1 into v_revision from vyndi_plan_revisions as pr;
    v_id:=p_id;
    insert into vyndi_plan_revisions
      (id,revision,status,horizon_months,scenario,draw_standby,finance_json,accounting_json,change_reason,created_by)
    values
      (v_id,v_revision,'draft',36,p_scenario,p_draw_standby,p_finance_json,p_accounting_json,coalesce(p_change_reason,''),p_actor_user_id);
  else
    update vyndi_plan_revisions set
      horizon_months=36,scenario=p_scenario,draw_standby=p_draw_standby,
      finance_json=p_finance_json,accounting_json=p_accounting_json,
      change_reason=coalesce(p_change_reason,'')
    where id=v_id;
  end if;
  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,payload_json)
  values
    ('AUD-PLAN-DRAFT-' || v_id || '-' || extract(epoch from clock_timestamp())::bigint,
     'operating_plan',v_id,v_revision,'draft_saved',p_actor_user_id,p_actor_role,
     jsonb_build_object('scenario',p_scenario,'horizonMonths',36,'drawStandby',p_draw_standby));
  return query select v_id,v_revision;
end;
$$;

create or replace function submit_vyndi_plan_for_approval(
  p_plan_id text,p_actor_user_id text,p_actor_role text
) returns integer
language plpgsql
as $$
declare v_revision integer;
begin
  update vyndi_plan_revisions set status='pending_approval',submitted_by=p_actor_user_id,submitted_at=now()
   where id=p_plan_id and status='draft' and created_by=p_actor_user_id
   returning revision into v_revision;
  if not found then raise exception 'Editable draft plan not found for this actor.'; end if;
  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,payload_json)
  values
    ('AUD-PLAN-SUBMIT-' || p_plan_id || '-' || extract(epoch from clock_timestamp())::bigint,
     'operating_plan',p_plan_id,v_revision,'submitted_for_approval',p_actor_user_id,p_actor_role,'{}'::jsonb);
  return v_revision;
end;
$$;

create or replace function approve_vyndi_plan_revision(
  p_plan_id text,p_decision_note text,p_actor_user_id text,p_actor_role text
) returns integer
language plpgsql
as $$
declare v_revision integer; v_old_id text;
begin
  perform pg_advisory_xact_lock(hashtext('approved-operating-plan')::bigint);
  if not exists(select 1 from vyndi_plan_revisions where id=p_plan_id and status='pending_approval') then
    raise exception 'Pending plan revision not found.';
  end if;
  select id into v_old_id from vyndi_plan_revisions where status='approved' limit 1 for update;
  if v_old_id is not null then
    update vyndi_plan_revisions set status='superseded' where id=v_old_id;
  end if;
  update vyndi_plan_revisions set status='approved',approved_by=p_actor_user_id,approved_at=now(),
         supersedes_id=v_old_id,change_reason=case when trim(coalesce(p_decision_note,''))<>'' then p_decision_note else change_reason end
   where id=p_plan_id and status='pending_approval'
   returning revision into v_revision;
  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    ('AUD-PLAN-APPROVE-' || p_plan_id || '-' || extract(epoch from clock_timestamp())::bigint,
     'operating_plan',p_plan_id,v_revision,'approved',p_actor_user_id,p_actor_role,v_old_id,
     jsonb_build_object('decisionNote',coalesce(p_decision_note,''),'supersededPlanId',v_old_id));
  return v_revision;
end;
$$;

create table if not exists vyndi_monthly_actuals (
  plan_month integer primary key check (plan_month >= 1),
  revision integer not null default 1 check (revision > 0),
  revenue numeric(18,4),
  units numeric(14,4),
  cogs numeric(18,4),
  opex numeric(18,4),
  closing_cash numeric(18,4),
  inventory numeric(18,4),
  receivables numeric(18,4),
  payables numeric(18,4),
  source_reference text not null default '',
  verified boolean not null default false,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create table if not exists vyndi_monthly_actual_revisions (
  id text primary key,
  plan_month integer not null,
  revision integer not null check (revision > 0),
  snapshot jsonb not null,
  action text not null check (action in ('upserted','cleared')),
  actor_user_id text not null,
  actor_role text not null,
  source_reference text,
  created_at timestamptz not null default now(),
  unique(plan_month,revision)
);

create index if not exists vyndi_monthly_actual_revisions_month_idx
  on vyndi_monthly_actual_revisions(plan_month,revision desc);

create or replace function save_vyndi_monthly_actual(
  p_plan_month integer,
  p_revenue numeric,
  p_units numeric,
  p_cogs numeric,
  p_opex numeric,
  p_closing_cash numeric,
  p_inventory numeric,
  p_receivables numeric,
  p_payables numeric,
  p_source_reference text,
  p_verified boolean,
  p_actor_user_id text,
  p_actor_role text
) returns integer
language plpgsql
as $$
declare v_revision integer; v_snapshot jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('actual|' || p_plan_month)::bigint);
  select coalesce(revision,0)+1 into v_revision from vyndi_monthly_actuals where plan_month=p_plan_month for update;
  if not found then v_revision:=1; end if;
  insert into vyndi_monthly_actuals
    (plan_month,revision,revenue,units,cogs,opex,closing_cash,inventory,receivables,payables,source_reference,verified,updated_by,updated_at)
  values
    (p_plan_month,v_revision,p_revenue,p_units,p_cogs,p_opex,p_closing_cash,p_inventory,p_receivables,p_payables,coalesce(p_source_reference,''),p_verified,p_actor_user_id,now())
  on conflict (plan_month) do update set
    revision=excluded.revision,revenue=excluded.revenue,units=excluded.units,cogs=excluded.cogs,opex=excluded.opex,
    closing_cash=excluded.closing_cash,inventory=excluded.inventory,receivables=excluded.receivables,payables=excluded.payables,
    source_reference=excluded.source_reference,verified=excluded.verified,updated_by=excluded.updated_by,updated_at=now();
  v_snapshot:=jsonb_build_object('planMonth',p_plan_month,'revision',v_revision,'revenue',p_revenue,'units',p_units,
    'cogs',p_cogs,'opex',p_opex,'closingCash',p_closing_cash,'inventory',p_inventory,
    'receivables',p_receivables,'payables',p_payables,'sourceReference',coalesce(p_source_reference,''),'verified',p_verified);
  insert into vyndi_monthly_actual_revisions
    (id,plan_month,revision,snapshot,action,actor_user_id,actor_role,source_reference)
  values
    ('ACT-M' || p_plan_month || '-R' || v_revision,p_plan_month,v_revision,v_snapshot,'upserted',p_actor_user_id,p_actor_role,p_source_reference);
  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    ('AUD-ACTUAL-M' || p_plan_month || '-R' || v_revision,'monthly_actual','M' || p_plan_month,v_revision,'upserted',p_actor_user_id,p_actor_role,p_source_reference,v_snapshot);
  return v_revision;
end;
$$;

create or replace function clear_vyndi_monthly_actual(
  p_plan_month integer,p_actor_user_id text,p_actor_role text
) returns integer
language plpgsql
as $$
declare v_revision integer; v_snapshot jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('actual|' || p_plan_month)::bigint);
  select revision+1 into v_revision from vyndi_monthly_actuals where plan_month=p_plan_month for update;
  if not found then return 0; end if;
  update vyndi_monthly_actuals set revision=v_revision,revenue=null,units=null,cogs=null,opex=null,closing_cash=null,
    inventory=null,receivables=null,payables=null,source_reference='',verified=false,updated_by=p_actor_user_id,updated_at=now()
  where plan_month=p_plan_month;
  v_snapshot:=jsonb_build_object('planMonth',p_plan_month,'revision',v_revision,'cleared',true);
  insert into vyndi_monthly_actual_revisions
    (id,plan_month,revision,snapshot,action,actor_user_id,actor_role)
  values
    ('ACT-M' || p_plan_month || '-R' || v_revision,p_plan_month,v_revision,v_snapshot,'cleared',p_actor_user_id,p_actor_role);
  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,payload_json)
  values
    ('AUD-ACTUAL-M' || p_plan_month || '-R' || v_revision,'monthly_actual','M' || p_plan_month,v_revision,'cleared',p_actor_user_id,p_actor_role,v_snapshot);
  return v_revision;
end;
$$;

create table if not exists vyndi_operating_actions (
  action_id text primary key,
  status text not null check (status in ('open','doing','done')),
  owner text,
  due_on date,
  note text not null default '',
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create or replace function set_vyndi_operating_action(
  p_action_id text,p_status text,p_owner text,p_due_on date,p_note text,p_actor_user_id text,p_actor_role text
) returns text
language plpgsql
as $$
begin
  insert into vyndi_operating_actions(action_id,status,owner,due_on,note,updated_by,updated_at)
  values(p_action_id,p_status,p_owner,p_due_on,coalesce(p_note,''),p_actor_user_id,now())
  on conflict(action_id) do update set status=excluded.status,owner=excluded.owner,due_on=excluded.due_on,
    note=excluded.note,updated_by=excluded.updated_by,updated_at=now();
  insert into vyndi_audit_events
    (id,entity_type,entity_id,action,actor_user_id,actor_role,payload_json)
  values
    ('AUD-ACTION-' || p_action_id || '-' || extract(epoch from clock_timestamp())::bigint,
     'operating_action',p_action_id,'status_changed',p_actor_user_id,p_actor_role,
     jsonb_build_object('status',p_status,'owner',p_owner,'dueOn',p_due_on,'note',coalesce(p_note,'')));
  return p_action_id;
end;
$$;