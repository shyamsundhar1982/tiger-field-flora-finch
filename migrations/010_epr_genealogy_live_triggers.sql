-- Keep genealogy current as execution records are created.
-- The trigger writes both backward and forward views for each source record.

create or replace function epr_genealogy_source_insert()
returns trigger
language plpgsql
as $$
declare
  t record;
  relation text;
  source_type text := TG_TABLE_NAME;
  actor text;
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

  actor := coalesce(NEW.recorded_by, NEW.recorded_by, NEW.inspected_by, NEW.created_by, NEW.recorded_by, 'system');

  insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
  values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,relation,NEW.id,source_type,'backward',actor);
  insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
  values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,relation,NEW.id,source_type,'forward',actor);
  return NEW;
end;
$$;

-- Drop first so migration is idempotent across environments.
drop trigger if exists epr_genealogy_material_lot_insert on epr_material_lots;
drop trigger if exists epr_genealogy_process_operation_insert on epr_process_operations;
drop trigger if exists epr_genealogy_inspection_insert on epr_inspections;
drop trigger if exists epr_genealogy_ncr_capa_insert on epr_ncr_capa;
drop trigger if exists epr_genealogy_inventory_movement_insert on epr_inventory_movements;
drop trigger if exists epr_genealogy_evidence_insert on epr_evidence;

create trigger epr_genealogy_material_lot_insert after insert on epr_material_lots
for each row execute function epr_genealogy_source_insert();
create trigger epr_genealogy_process_operation_insert after insert on epr_process_operations
for each row execute function epr_genealogy_source_insert();
create trigger epr_genealogy_inspection_insert after insert on epr_inspections
for each row execute function epr_genealogy_source_insert();
create trigger epr_genealogy_ncr_capa_insert after insert on epr_ncr_capa
for each row execute function epr_genealogy_source_insert();
create trigger epr_genealogy_inventory_movement_insert after insert on epr_inventory_movements
for each row execute function epr_genealogy_source_insert();
create trigger epr_genealogy_evidence_insert after insert on epr_evidence
for each row execute function epr_genealogy_source_insert();
