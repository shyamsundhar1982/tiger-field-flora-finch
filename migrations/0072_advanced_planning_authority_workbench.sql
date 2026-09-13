-- Governed advanced-planning authority workbench.
-- Adds approval for existing capacity standards and deterministic draft-routing
-- creation from those approved standards. No supplier-lane facts are inferred.

create or replace function approve_vyndi_capacity_standards(
  p_actor_user_id text,
  p_actor_role text
) returns integer
language plpgsql
as $$
declare
  v_row vyndi_capacity_standards%rowtype;
  v_count integer := 0;
begin
  if nullif(trim(coalesce(p_actor_user_id,'')),'') is null
     or nullif(trim(coalesce(p_actor_role,'')),'') is null then
    raise exception 'Capacity approval requires an attributed actor and role';
  end if;

  for v_row in
    update vyndi_capacity_standards
       set planning_status='approved',
           updated_by=p_actor_user_id,
           updated_at=now()
     where planning_status='planning-default'
     returning *
  loop
    v_count := v_count + 1;
    insert into vyndi_audit_events
      (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,
       payload_json,correlation_id,gate_id,gate_result,previous_state,new_state,reason)
    values
      ('AUDIT-CAPACITY-APPROVE-'||v_row.work_centre_id||'-'||extract(epoch from clock_timestamp())::bigint,
       'capacity_standard',v_row.work_centre_id,1,'CAPACITY_STANDARD_APPROVED',
       p_actor_user_id,p_actor_role,v_row.source_ref,
       jsonb_build_object(
         'workCentreId',v_row.work_centre_id,
         'workCentreName',v_row.work_centre_name,
         'availableHoursPerMonth',v_row.available_hours_per_month,
         'efficiency',v_row.efficiency,
         'standardHoursPerUnit',v_row.standard_hours_per_unit,
         'sourceSha256',v_row.source_sha256),
       'CAPACITY|'||v_row.work_centre_id,
       'ADV-CAPACITY','pass','planning-default','approved',
       'Approved existing controlled capacity standard for governed advanced planning.');
  end loop;

  return v_count;
end;
$$;

create or replace function create_vyndi_routing_drafts_from_capacity(
  p_ibpe_run_id text,
  p_actor_user_id text,
  p_actor_role text
) returns table(revision_id text, product_id text)
language plpgsql
as $$
declare
  v_input jsonb;
  v_plan_revision integer;
  v_product text;
  v_revision_id text;
  v_revision_code text;
  v_capacity vyndi_capacity_standards%rowtype;
  v_operation_id text;
  v_previous_operation_id text;
begin
  if nullif(trim(coalesce(p_actor_user_id,'')),'') is null
     or nullif(trim(coalesce(p_actor_role,'')),'') is null then
    raise exception 'Routing draft creation requires an attributed actor and role';
  end if;

  select input_json,approved_plan_revision::integer
    into v_input,v_plan_revision
    from vyndi_ibpe_runs
   where id=p_ibpe_run_id and status='complete'
   limit 1;
  if not found then
    raise exception 'Complete governed IBPE run % was not found',p_ibpe_run_id;
  end if;

  if not exists(select 1 from vyndi_capacity_standards where planning_status='approved') then
    raise exception 'Approved capacity standards are required before routing drafts can be created';
  end if;
  if exists(select 1 from vyndi_capacity_standards where planning_status<>'approved' and planning_status<>'retired') then
    raise exception 'All active capacity standards must be approved before routing drafts can be created';
  end if;

  for v_product in
    select distinct product
    from (
      select nullif(trim(d->>'productId'),'') as product
        from jsonb_array_elements(coalesce(v_input->'demand','[]'::jsonb)) d
      union
      select nullif(trim(b->>'productId'),'') as product
        from jsonb_array_elements(coalesce(v_input->'bom','[]'::jsonb)) b
       where coalesce((b->>'approved')::boolean,false)
    ) q
    where product is not null
    order by product
  loop
    v_revision_code := 'IBPE-R'||v_plan_revision;

    select r.id into v_revision_id
      from vyndi_routing_revisions r
     where r.product_id=v_product
       and r.revision_code=v_revision_code
       and r.status in ('draft','approved')
     limit 1;

    if v_revision_id is null then
      v_revision_id := 'ROUTE-'||regexp_replace(upper(v_product),'[^A-Z0-9]+','-','g')||'-'||substring(md5(p_ibpe_run_id||'|'||v_product) from 1 for 12);
      insert into vyndi_routing_revisions
        (id,product_id,revision_code,status,effective_from,effective_to,source_ref,record_revision,created_by,created_role)
      values
        (v_revision_id,v_product,v_revision_code,'draft',current_date,null,
         'DERIVED-FROM-APPROVED-CAPACITY|'||p_ibpe_run_id,1,p_actor_user_id,p_actor_role);

      v_previous_operation_id := null;
      for v_capacity in
        select * from vyndi_capacity_standards
         where planning_status='approved'
         order by sequence,work_centre_id
      loop
        v_operation_id := v_revision_id||'-'||v_capacity.work_centre_id;
        insert into vyndi_routing_operations
          (id,revision_id,operation_code,sequence,run_hours_per_unit,setup_hours,yield_pct,epr_gate_id,traveller_operation,source_ref)
        values
          (v_operation_id,v_revision_id,v_capacity.work_centre_id,v_capacity.sequence,
           v_capacity.standard_hours_per_unit,0,1,null,v_capacity.traveller_operation,
           'CAPACITY-STANDARD|'||v_capacity.work_centre_id||'|'||v_capacity.source_ref);

        insert into vyndi_routing_operation_resources(operation_id,resource_id)
        values(v_operation_id,v_capacity.work_centre_id);

        if v_previous_operation_id is not null then
          insert into vyndi_routing_operation_predecessors(operation_id,predecessor_operation_id)
          values(v_operation_id,v_previous_operation_id);
        end if;
        v_previous_operation_id := v_operation_id;
      end loop;

      insert into vyndi_audit_events
        (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,
         payload_json,correlation_id,gate_id,gate_result,previous_state,new_state,reason)
      values
        ('AUDIT-ROUTING-DRAFT-'||v_revision_id||'-'||extract(epoch from clock_timestamp())::bigint,
         'routing_revision',v_revision_id,1,'ROUTING_REVISION_DRAFT_CREATED',
         p_actor_user_id,p_actor_role,'DERIVED-FROM-APPROVED-CAPACITY|'||p_ibpe_run_id,
         jsonb_build_object('productId',v_product,'revisionCode',v_revision_code,'parentIbpeRunId',p_ibpe_run_id),
         'ROUTING|'||v_product||'|'||v_revision_code,
         'ADV-ROUTING','advisory','none','draft',
         'Draft routing created deterministically from approved capacity standards; human approval is still required.');
    end if;

    revision_id := v_revision_id;
    product_id := v_product;
    return next;
    v_revision_id := null;
  end loop;
end;
$$;
