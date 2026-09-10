-- Fix PL/pgSQL name ambiguity in the traveller creation primitive. The function
-- returns sales_order_id/job_card_id columns, so internal SQL must avoid exposing
-- unqualified names that can collide with those output variables.

create or replace function raise_epr_traveller_for_job_card(
  p_traveller_id text,
  p_job_card_id text,
  p_serial_number text,
  p_engineering_revision text,
  p_supplier text,
  p_actor_user_id text,
  p_actor_role text
) returns table (
  traveller_id text,
  traveller_status text,
  model_name text,
  bom_revision text,
  sales_order_id text,
  job_card_id text
)
language plpgsql
as $$
declare
  c record;
  v_active_count integer:=0;
  v_model_name text;
  v_venture text;
  v_serial text:=trim(coalesce(p_serial_number,''));
  v_engineering_revision text:=trim(coalesce(p_engineering_revision,''));
  v_supplier text:=trim(coalesce(p_supplier,''));
begin
  select
      jc.id as job_card_id_value,
      jc.sales_order_id as sales_order_id_value,
      jc.sales_order_revision,
      jc.status,
      jc.units,
      jc.model_tier,
      jc.variant_id,
      jc.bom_revision
    into c
    from epr_production_job_cards jc
   where jc.id=p_job_card_id
   for update;
  if not found then raise exception 'Production job card not found.'; end if;
  if c.status not in ('released','in_progress') then
    raise exception 'Traveller can only be raised for a released or in-progress job card; current status is %.',c.status;
  end if;
  if c.model_tier is null or c.model_tier not in ('core','pro','apex') then
    raise exception 'Job card has no controlled VINDY model tier.';
  end if;
  if c.variant_id is null or trim(c.variant_id)='' then
    raise exception 'Job card has no exact released VINDY variant.';
  end if;
  if c.bom_revision is null or trim(c.bom_revision)='' then
    raise exception 'Job card has no released BOM revision.';
  end if;
  if v_serial='' then raise exception 'Serial number is required.'; end if;
  if v_engineering_revision='' then raise exception 'Engineering revision is required.'; end if;
  if exists(select 1 from epr_travellers tr where tr.serial_number=v_serial) then
    raise exception 'Serial number % already exists.',v_serial;
  end if;

  select count(*)::integer
    into v_active_count
    from epr_travellers tr
   where tr.job_card_id=c.job_card_id_value and tr.status<>'rejected';
  if v_active_count >= ceil(c.units)::integer then
    raise exception 'Job card % already has % active/completed traveller(s) for % unit(s).',c.job_card_id_value,v_active_count,c.units;
  end if;

  v_model_name:=case c.model_tier
    when 'core' then 'Longitude'
    when 'pro' then 'Latitude'
    when 'apex' then 'Altitude'
  end;
  v_venture:=case when c.model_tier='core' then 'aluminium' else 'carbon' end;

  insert into epr_travellers
    (id,venture,model_id,model_name,sku,bom_revision,engineering_revision,serial_number,supplier,status,created_by,
     job_card_id,job_card_revision)
  values
    (p_traveller_id,v_venture,c.model_tier,v_model_name,c.variant_id,c.bom_revision,v_engineering_revision,v_serial,v_supplier,
     'draft',p_actor_user_id,c.job_card_id_value,c.sales_order_revision);

  insert into epr_gate_events (id,traveller_id,gate_id,status,actor)
  values ('GATE-' || p_traveller_id || '-EPR04',p_traveller_id,'EPR-04','planned',p_actor_user_id);

  insert into epr_audit_events
    (id,venture,entity_type,entity_id,action,actor,payload_json)
  values
    ('AUD-' || p_traveller_id || '-CREATE',v_venture,'traveller',p_traveller_id,'raised_from_production_job_card',p_actor_user_id,
     json_build_object('jobCardId',c.job_card_id_value,'salesOrderId',c.sales_order_id_value,'salesOrderRevision',c.sales_order_revision,
       'variantId',c.variant_id,'bomRevision',c.bom_revision,'serialNumber',v_serial)::text);

  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    ('AUD-' || p_traveller_id || '-PROD','production_traveller',p_traveller_id,c.sales_order_revision,
     'raised_from_job_card',p_actor_user_id,p_actor_role,c.job_card_id_value,
     jsonb_build_object('jobCardId',c.job_card_id_value,'salesOrderId',c.sales_order_id_value,'variantId',c.variant_id,
       'bomRevision',c.bom_revision,'serialNumber',v_serial,'engineeringRevision',v_engineering_revision));

  return query select p_traveller_id,'draft'::text,v_model_name,c.bom_revision,c.sales_order_id_value,c.job_card_id_value;
end;
$$;
