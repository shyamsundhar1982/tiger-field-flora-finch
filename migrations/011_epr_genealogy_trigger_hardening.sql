create or replace function epr_genealogy_source_insert()
returns trigger
language plpgsql
as $$
declare
  t record;
  relation text;
  source_type text := TG_TABLE_NAME;
  actor text;
  payload jsonb := to_jsonb(NEW);
begin
  if NEW.traveller_id is null then return NEW; end if;

  select id, venture, serial_number into t
    from epr_travellers where id=NEW.traveller_id;
  if not found then return NEW; end if;

  relation := case TG_TABLE_NAME
    when 'epr_material_lots' then 'material_lot'
    when 'epr_process_operations' then 'process_operation'
    when 'epr_inspections' then 'inspection'
    when 'epr_ncr_capa' then 'ncr_capa'
    when 'epr_inventory_movements' then 'inventory_movement'
    when 'epr_evidence' then 'evidence'
    else null
  end;
  if relation is null then return NEW; end if;

  actor := coalesce(payload->>'recorded_by', payload->>'inspected_by', payload->>'created_by', 'system');

  insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
  values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,relation,NEW.id,source_type,'backward',actor);
  insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
  values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,relation,NEW.id,source_type,'forward',actor);
  return NEW;
end;
$$;
