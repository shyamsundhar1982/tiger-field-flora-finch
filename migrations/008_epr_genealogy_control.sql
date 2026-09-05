-- EPR genealogy control: links a serialized traveller to every traceable
-- material, process, inspection, inventory and evidence record.
-- This is intentionally additive: existing execution records remain valid.

create table if not exists epr_genealogy_links (
  id text primary key,
  traveller_id text not null references epr_travellers(id) on delete restrict,
  venture text not null check (venture in ('carbon','aluminium')),
  serial_number text not null,
  relation_type text not null check (relation_type in (
    'material_lot','process_operation','inspection','ncr_capa',
    'inventory_movement','evidence','equipment','operator','work_instruction'
  )),
  source_entity_id text not null,
  source_entity_type text not null,
  direction text not null check (direction in ('backward','forward')),
  metadata_json text not null default '{}',
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists epr_genealogy_traveller_idx
  on epr_genealogy_links (traveller_id, created_at);
create index if not exists epr_genealogy_serial_idx
  on epr_genealogy_links (serial_number, created_at);
create index if not exists epr_genealogy_source_idx
  on epr_genealogy_links (source_entity_type, source_entity_id);

-- Build/rebuild genealogy from authoritative existing EPR records.
-- No mutation of source records occurs.
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
    n:=n+1;
  end loop;
  for r in select id, venture from epr_process_operations where traveller_id=p_traveller_id loop
    insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
    values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,'process_operation',r.id,'epr_process_operations','backward',p_actor);
    n:=n+1;
  end loop;
  for r in select id, venture from epr_inspections where traveller_id=p_traveller_id loop
    insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
    values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,'inspection',r.id,'epr_inspections','backward',p_actor);
    n:=n+1;
  end loop;
  for r in select id, venture from epr_ncr_capa where traveller_id=p_traveller_id loop
    insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
    values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,'ncr_capa',r.id,'epr_ncr_capa','backward',p_actor);
    n:=n+1;
  end loop;
  for r in select id, venture from epr_inventory_movements where traveller_id=p_traveller_id loop
    insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
    values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,'inventory_movement',r.id,'epr_inventory_movements','backward',p_actor);
    n:=n+1;
  end loop;
  for r in select id, venture from epr_evidence where traveller_id=p_traveller_id loop
    insert into epr_genealogy_links(id,traveller_id,venture,serial_number,relation_type,source_entity_id,source_entity_type,direction,created_by)
    values ('GEN-'||md5(random()::text||clock_timestamp()::text),t.id,t.venture,t.serial_number,'evidence',r.id,'epr_evidence','backward',p_actor);
    n:=n+1;
  end loop;

  insert into epr_audit_events(id,venture,entity_type,entity_id,action,actor,payload_json)
  values ('AUD-'||md5(random()::text||clock_timestamp()::text),t.venture,'traveller',t.id,'genealogy_rebuilt',p_actor,json_build_object('records',n)::text);
  return n;
end;
$$;
