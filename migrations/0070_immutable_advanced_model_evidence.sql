-- Freeze the exact compiled advanced-planning model beside each new packet.
-- This is derived reproducibility evidence, not canonical transaction truth.
-- Historical packets remain readable with model_json = null.

alter table vyndi_advanced_planning_packets
  add column if not exists model_json jsonb;

alter table vyndi_advanced_planning_packets
  drop constraint if exists vyndi_advanced_planning_packets_model_json_ck;
alter table vyndi_advanced_planning_packets
  add constraint vyndi_advanced_planning_packets_model_json_ck check (
    model_json is null or jsonb_typeof(model_json)='object'
  );

create or replace function persist_vyndi_advanced_planning_packet_v2(
  p_id text,
  p_parent_ibpe_run_id text,
  p_packet_version text,
  p_advanced_model_version text,
  p_source_sha text,
  p_source_input_hash text,
  p_source_snapshot_at timestamptz,
  p_packet_json jsonb,
  p_model_json jsonb,
  p_authority_json jsonb,
  p_adapter_notices_json jsonb,
  p_actor_user_id text,
  p_actor_role text
) returns text
language plpgsql
as $$
declare
  v_existing record;
  v_parent record;
begin
  if trim(coalesce(p_id,''))='' then raise exception 'Advanced planning packet ID is required.'; end if;
  if trim(coalesce(p_packet_version,''))='' then raise exception 'Advanced planning packet version is required.'; end if;
  if trim(coalesce(p_advanced_model_version,''))='' then raise exception 'Advanced planning model version is required.'; end if;
  if length(trim(coalesce(p_source_sha,'')))<7 then raise exception 'Advanced planning source SHA is required.'; end if;
  if coalesce(p_source_input_hash,'') !~ '^[a-f0-9]{64}$' then raise exception 'Advanced planning source input hash must be SHA-256 hex.'; end if;
  if p_packet_json is null or jsonb_typeof(p_packet_json)<>'object' then raise exception 'Advanced planning packet JSON is required.'; end if;
  if p_model_json is null or jsonb_typeof(p_model_json)<>'object' then raise exception 'Advanced planning model JSON is required.'; end if;
  if coalesce(p_model_json->>'modelVersion','')<>p_advanced_model_version then
    raise exception 'Advanced planning model JSON version does not match advanced model version.';
  end if;
  if p_authority_json is null or jsonb_typeof(p_authority_json)<>'object' then raise exception 'Advanced planning authority JSON is required.'; end if;
  if p_adapter_notices_json is null or jsonb_typeof(p_adapter_notices_json)<>'array' then raise exception 'Advanced planning adapter notices must be a JSON array.'; end if;
  if coalesce(p_packet_json#>>'{lineage,sourceSnapshotId}','')<>p_parent_ibpe_run_id then
    raise exception 'Advanced planning packet lineage does not match parent IBPE run.';
  end if;
  if coalesce(p_packet_json#>>'{lineage,sourceInputHash}','')<>p_source_input_hash then
    raise exception 'Advanced planning packet lineage input hash does not match persisted input hash.';
  end if;
  if coalesce(p_packet_json#>>'{lineage,sourceSha}','')<>p_source_sha then
    raise exception 'Advanced planning packet lineage source SHA does not match persisted source SHA.';
  end if;

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
  select id,model_json into v_existing
    from vyndi_advanced_planning_packets
   where parent_ibpe_run_id=p_parent_ibpe_run_id
     and packet_version=p_packet_version
     and advanced_model_version=p_advanced_model_version
     and source_input_hash=p_source_input_hash
   limit 1;
  if v_existing.id is not null then
    if v_existing.model_json is null then
      raise exception 'Existing historical advanced packet lacks frozen model evidence; create a new governed IBPE snapshot before optimization.';
    end if;
    if v_existing.model_json<>p_model_json then
      raise exception 'Existing advanced packet model evidence differs from the proposed frozen model.';
    end if;
    return v_existing.id;
  end if;

  insert into vyndi_advanced_planning_packets(
    id,parent_ibpe_run_id,packet_version,advanced_model_version,source_sha,source_input_hash,
    source_snapshot_at,packet_json,model_json,authority_json,adapter_notices_json,created_by,created_role)
  values(
    p_id,p_parent_ibpe_run_id,p_packet_version,p_advanced_model_version,p_source_sha,p_source_input_hash,
    p_source_snapshot_at,p_packet_json,p_model_json,p_authority_json,p_adapter_notices_json,p_actor_user_id,p_actor_role);

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
      'frozenModelEvidence',true,
      'advisoryOnly',true));

  return p_id;
end;
$$;

create or replace function guard_vyndi_advanced_planning_packet_mutation()
returns trigger language plpgsql as $$
begin
  if old.status='invalidated' then
    raise exception 'Invalidated advanced planning packet % is immutable.',old.id;
  end if;
  if new.status<>'invalidated' then
    raise exception 'Persisted advanced planning packet % is immutable; only governed invalidation is allowed.',old.id;
  end if;
  if row(
    new.id,new.parent_ibpe_run_id,new.packet_version,new.advanced_model_version,new.source_sha,new.source_input_hash,
    new.source_snapshot_at,new.packet_json,new.model_json,new.authority_json,new.adapter_notices_json,
    new.created_by,new.created_role,new.created_at
  ) is distinct from row(
    old.id,old.parent_ibpe_run_id,old.packet_version,old.advanced_model_version,old.source_sha,old.source_input_hash,
    old.source_snapshot_at,old.packet_json,old.model_json,old.authority_json,old.adapter_notices_json,
    old.created_by,old.created_role,old.created_at
  ) then
    raise exception 'Advanced planning evidence % cannot be edited during invalidation.',old.id;
  end if;
  if nullif(trim(coalesce(new.invalidated_by,'')),'') is null
     or new.invalidated_at is null
     or nullif(trim(coalesce(new.invalidation_reason,'')),'') is null then
    raise exception 'Advanced planning invalidation requires actor, time and reason.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_vyndi_advanced_planning_packet on vyndi_advanced_planning_packets;
create trigger trg_guard_vyndi_advanced_planning_packet
before update on vyndi_advanced_planning_packets
for each row execute function guard_vyndi_advanced_planning_packet_mutation();

comment on column vyndi_advanced_planning_packets.model_json is
  'Immutable derived snapshot of the exact advanced constraint model used to create the packet. It exists for reproducible optimization and is not canonical transaction truth.';
