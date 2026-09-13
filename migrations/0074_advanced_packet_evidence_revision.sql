-- Allow a governed advanced-planning packet to be re-frozen when authority/model
-- evidence changes after the parent IBPE run was captured, without mutating the
-- previous immutable packet. The existing lineage uniqueness is preserved by
-- using an evidence-revision suffix on the persisted packet_version only.

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
  v_revision_hash text;
  v_target_id text;
  v_target_packet_version text;
  v_packet_json jsonb;
begin
  if trim(coalesce(p_id,''))='' then raise exception 'Advanced planning packet ID is required.'; end if;
  if trim(coalesce(p_packet_version,''))='' then raise exception 'Advanced planning packet version is required.'; end if;
  if trim(coalesce(p_advanced_model_version,''))='' then raise exception 'Advanced planning model version is required.'; end if;
  if length(trim(coalesce(p_source_sha,'')))<7 then raise exception 'Advanced planning source SHA is required.'; end if;
  if coalesce(p_source_input_hash,'') !~ '^[a-f0-9]{64}$' then raise exception 'Advanced planning source input hash must be SHA-256 hex.'; end if;
  if p_packet_json is null or jsonb_typeof(p_packet_json)<>'object' then raise exception 'Advanced planning packet JSON is required.'; end if;
  if p_model_json is null or jsonb_typeof(p_model_json)<>'object' then raise exception 'Advanced planning model JSON is required.'; end if;
  if coalesce(p_model_json->>'modelVersion','')<>p_advanced_model_version then raise exception 'Advanced planning model JSON version does not match advanced model version.'; end if;
  if p_authority_json is null or jsonb_typeof(p_authority_json)<>'object' then raise exception 'Advanced planning authority JSON is required.'; end if;
  if p_adapter_notices_json is null or jsonb_typeof(p_adapter_notices_json)<>'array' then raise exception 'Advanced planning adapter notices must be a JSON array.'; end if;
  if coalesce(p_packet_json#>>'{lineage,sourceSnapshotId}','')<>p_parent_ibpe_run_id then raise exception 'Advanced planning packet lineage does not match parent IBPE run.'; end if;
  if coalesce(p_packet_json#>>'{lineage,sourceInputHash}','')<>p_source_input_hash then raise exception 'Advanced planning packet lineage input hash does not match persisted input hash.'; end if;
  if coalesce(p_packet_json#>>'{lineage,sourceSha}','')<>p_source_sha then raise exception 'Advanced planning packet lineage source SHA does not match persisted source SHA.'; end if;

  select id,source_sha,input_hash,snapshot_at,status into v_parent
    from vyndi_ibpe_runs where id=p_parent_ibpe_run_id;
  if v_parent.id is null then raise exception 'Parent governed IBPE run was not found.'; end if;
  if v_parent.status<>'complete' then raise exception 'Advanced planning requires a complete parent IBPE run.'; end if;
  if v_parent.source_sha<>p_source_sha then raise exception 'Advanced planning source SHA does not match parent IBPE lineage.'; end if;
  if v_parent.input_hash<>p_source_input_hash then raise exception 'Advanced planning input hash does not match parent IBPE lineage.'; end if;
  if v_parent.snapshot_at<>p_source_snapshot_at then raise exception 'Advanced planning snapshot time does not match parent IBPE lineage.'; end if;

  v_revision_hash:=substr(md5(p_model_json::text||'|'||p_authority_json::text||'|'||p_adapter_notices_json::text),1,16);
  v_target_id:=p_id;
  v_target_packet_version:=p_packet_version;

  perform pg_advisory_xact_lock(hashtext('advanced-planning|'||p_parent_ibpe_run_id||'|'||p_source_input_hash)::bigint);

  select id,model_json,authority_json,adapter_notices_json into v_existing
    from vyndi_advanced_planning_packets
   where parent_ibpe_run_id=p_parent_ibpe_run_id
     and packet_version=p_packet_version
     and advanced_model_version=p_advanced_model_version
     and source_input_hash=p_source_input_hash
   limit 1;

  if v_existing.id is not null then
    if v_existing.model_json=p_model_json
       and v_existing.authority_json=p_authority_json
       and v_existing.adapter_notices_json=p_adapter_notices_json then
      return v_existing.id;
    end if;
    v_target_id:=p_id||'-E'||v_revision_hash;
    v_target_packet_version:=p_packet_version||'-E'||v_revision_hash;
  end if;

  select id,model_json,authority_json,adapter_notices_json into v_existing
    from vyndi_advanced_planning_packets
   where parent_ibpe_run_id=p_parent_ibpe_run_id
     and packet_version=v_target_packet_version
     and advanced_model_version=p_advanced_model_version
     and source_input_hash=p_source_input_hash
   limit 1;

  if v_existing.id is not null then
    if v_existing.model_json=p_model_json
       and v_existing.authority_json=p_authority_json
       and v_existing.adapter_notices_json=p_adapter_notices_json then
      return v_existing.id;
    end if;
    raise exception 'Advanced planning packet evidence revision collision for %.',v_target_packet_version;
  end if;

  v_packet_json:=jsonb_set(p_packet_json,'{packetId}',to_jsonb(v_target_id),true);

  insert into vyndi_advanced_planning_packets(
    id,parent_ibpe_run_id,packet_version,advanced_model_version,source_sha,source_input_hash,
    source_snapshot_at,packet_json,model_json,authority_json,adapter_notices_json,created_by,created_role)
  values(
    v_target_id,p_parent_ibpe_run_id,v_target_packet_version,p_advanced_model_version,p_source_sha,p_source_input_hash,
    p_source_snapshot_at,v_packet_json,p_model_json,p_authority_json,p_adapter_notices_json,p_actor_user_id,p_actor_role);

  insert into vyndi_audit_events(
    id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
  values(
    'AUD-'||v_target_id,'advanced_planning_packet',v_target_id,'computed',p_actor_user_id,p_actor_role,p_parent_ibpe_run_id,
    jsonb_build_object(
      'parentIbpeRunId',p_parent_ibpe_run_id,
      'packetVersion',p_packet_version,
      'persistenceRevision',v_target_packet_version,
      'advancedModelVersion',p_advanced_model_version,
      'sourceSha',p_source_sha,
      'sourceInputHash',p_source_input_hash,
      'evidenceRevisionHash',v_revision_hash,
      'frozenModelEvidence',true,
      'advisoryOnly',true));

  return v_target_id;
end;
$$;
