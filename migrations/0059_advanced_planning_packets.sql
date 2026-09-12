-- VYNDI advanced-planning derived decision packets.
-- Advisory only: every packet is derived from one persisted governed IBPE run and
-- cannot mutate Sales, Inventory, Procurement, Production, Finance or Accounting truth.

create table if not exists vyndi_advanced_planning_packets (
  id text primary key,
  parent_ibpe_run_id text not null references vyndi_ibpe_runs(id) on delete restrict,
  packet_version text not null,
  advanced_model_version text not null,
  source_sha text not null check (length(trim(source_sha)) >= 7),
  source_input_hash text not null check (source_input_hash ~ '^[a-f0-9]{64}$'),
  source_snapshot_at timestamptz not null,
  packet_json jsonb not null,
  authority_json jsonb not null,
  adapter_notices_json jsonb not null default '[]'::jsonb,
  status text not null default 'complete' check (status in ('complete','invalidated')),
  created_by text not null,
  created_role text not null,
  created_at timestamptz not null default now(),
  invalidated_by text,
  invalidated_at timestamptz,
  invalidation_reason text,
  unique(parent_ibpe_run_id,packet_version,advanced_model_version,source_input_hash)
);

create index if not exists vyndi_advanced_planning_packets_created_idx
  on vyndi_advanced_planning_packets(created_at desc);
create index if not exists vyndi_advanced_planning_packets_parent_idx
  on vyndi_advanced_planning_packets(parent_ibpe_run_id,created_at desc);

create or replace function persist_vyndi_advanced_planning_packet(
  p_id text,
  p_parent_ibpe_run_id text,
  p_packet_version text,
  p_advanced_model_version text,
  p_source_sha text,
  p_source_input_hash text,
  p_source_snapshot_at timestamptz,
  p_packet_json jsonb,
  p_authority_json jsonb,
  p_adapter_notices_json jsonb,
  p_actor_user_id text,
  p_actor_role text
) returns text
language plpgsql
as $$
declare
  v_existing text;
  v_parent record;
begin
  if trim(coalesce(p_id,''))='' then raise exception 'Advanced planning packet ID is required.'; end if;
  if trim(coalesce(p_packet_version,''))='' then raise exception 'Advanced planning packet version is required.'; end if;
  if trim(coalesce(p_advanced_model_version,''))='' then raise exception 'Advanced planning model version is required.'; end if;
  if length(trim(coalesce(p_source_sha,'')))<7 then raise exception 'Advanced planning source SHA is required.'; end if;
  if coalesce(p_source_input_hash,'') !~ '^[a-f0-9]{64}$' then raise exception 'Advanced planning source input hash must be SHA-256 hex.'; end if;
  if p_packet_json is null or jsonb_typeof(p_packet_json)<>'object' then raise exception 'Advanced planning packet JSON is required.'; end if;
  if p_authority_json is null or jsonb_typeof(p_authority_json)<>'object' then raise exception 'Advanced planning authority JSON is required.'; end if;
  if p_adapter_notices_json is null or jsonb_typeof(p_adapter_notices_json)<>'array' then raise exception 'Advanced planning adapter notices must be a JSON array.'; end if;

  select id,source_sha,input_hash,snapshot_at,status
    into v_parent
    from vyndi_ibpe_runs
   where id=p_parent_ibpe_run_id;
  if v_parent.id is null then raise exception 'Parent governed IBPE run was not found.'; end if;
  if v_parent.status<>'complete' then raise exception 'Advanced planning requires a complete parent IBPE run.'; end if;
  if v_parent.source_sha<>p_source_sha then raise exception 'Advanced planning source SHA does not match parent IBPE lineage.'; end if;
  if v_parent.input_hash<>p_source_input_hash then raise exception 'Advanced planning input hash does not match parent IBPE lineage.'; end if;
  if v_parent.snapshot_at<>p_source_snapshot_at then raise exception 'Advanced planning snapshot time does not match parent IBPE lineage.'; end if;

  perform pg_advisory_xact_lock(hashtext('advanced-planning|'||p_parent_ibpe_run_id||'|'||p_packet_version||'|'||p_source_input_hash)::bigint);
  select id into v_existing
    from vyndi_advanced_planning_packets
   where parent_ibpe_run_id=p_parent_ibpe_run_id
     and packet_version=p_packet_version
     and advanced_model_version=p_advanced_model_version
     and source_input_hash=p_source_input_hash
   limit 1;
  if v_existing is not null then return v_existing; end if;

  insert into vyndi_advanced_planning_packets(
    id,parent_ibpe_run_id,packet_version,advanced_model_version,source_sha,source_input_hash,
    source_snapshot_at,packet_json,authority_json,adapter_notices_json,created_by,created_role)
  values(
    p_id,p_parent_ibpe_run_id,p_packet_version,p_advanced_model_version,p_source_sha,p_source_input_hash,
    p_source_snapshot_at,p_packet_json,p_authority_json,p_adapter_notices_json,p_actor_user_id,p_actor_role);

  insert into vyndi_audit_events(
    id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
  values(
    'AUD-'||p_id,'advanced_planning_packet',p_id,'computed',p_actor_user_id,p_actor_role,p_parent_ibpe_run_id,
    jsonb_build_object(
      'parentIbpeRunId',p_parent_ibpe_run_id,
      'packetVersion',p_packet_version,
      'advancedModelVersion',p_advanced_model_version,
      'sourceSha',p_source_sha,
      'sourceInputHash',p_source_input_hash,
      'advisoryOnly',true));

  return p_id;
end;
$$;

comment on table vyndi_advanced_planning_packets is
  'Derived advisory feasibility/CTP decision packets with exact lineage to one persisted governed IBPE input snapshot. These records cannot directly mutate transaction truth.';
