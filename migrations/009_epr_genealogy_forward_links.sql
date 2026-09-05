-- Complete genealogy semantics: every source record gets both views.
-- backward = serial/traveller -> source record
-- forward  = source record -> affected serial/traveller

create or replace function rebuild_epr_genealogy(p_traveller_id text, p_actor text)
returns integer
language plpgsql
as $$
declare
  t record;
  n integer := 0;
  r record;
begin
  select id, venture, serial_number into t
    from epr_travellers where id = p_traveller_id for share;
  if not found then raise exception 'Traveller not found.'; end if;

  delete from epr_genealogy_links where traveller_id = p_traveller_id;

  for r in select id, venture from epr_material_lots where traveller_id=p_traveller_id loop
    insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
    values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,'material_lot',r.id,'epr_material_lots','backward',p_actor);
    insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
    values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,'material_lot',r.id,'epr_material_lots','forward',p_actor);
    n:=n+2;
  end loop;
  for r in select id, venture from epr_process_operations where traveller_id=p_traveller_id loop
    insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
    values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,'process_operation',r.id,'epr_process_operations','backward',p_actor);
    insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
    values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,'process_operation',r.id,'epr_process_operations','forward',p_actor);
    n:=n+2;
  end loop;
  for r in select id, venture from epr_inspections where traveller_id=p_traveller_id loop
    insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
    values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,'inspection',r.id,'epr_inspections','backward',p_actor);
    insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
    values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,'inspection',r.id,'epr_inspections','forward',p_actor);
    n:=n+2;
  end loop;
  for r in select id, venture from epr_ncr_capa where traveller_id=p_traveller_id loop
    insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
    values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,'ncr_capa',r.id,'epr_ncr_capa','backward',p_actor);
    insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
    values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,'ncr_capa',r.id,'epr_ncr_capa','forward',p_actor);
    n:=n+2;
  end loop;
  for r in select id, venture from epr_inventory_movements where traveller_id=p_traveller_id loop
    insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
    values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,'inventory_movement',r.id,'epr_inventory_movements','backward',p_actor);
    insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
    values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,'inventory_movement',r.id,'epr_inventory_movements','forward',p_actor);
    n:=n+2;
  end loop;
  for r in select id, venture from epr_evidence where traveller_id=p_traveller_id loop
    insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
    values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,'evidence',r.id,'epr_evidence','backward',p_actor);
    insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
    values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,'evidence',r.id,'epr_evidence','forward',p_actor);
    n:=n+2;
  end loop;

  insert into epr_audit_events(id,venture,entity_type,entity_id,action,actor,payload_json)
  values ('AUD-'||md5(random()::text||clock_timestamp()::text),t.venture,'traveller',t.id,'genealogy_rebuilt',p_actor,json_build_object('records',n)::text);
  return n;
end;
$$;
