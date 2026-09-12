-- Harden routing revision lifecycle so authoritative state cannot be created by
-- an accidental insert/update that skips the governed approval/retirement shape.

create or replace function guard_vyndi_routing_revision_lifecycle()
returns trigger language plpgsql as $$
begin
  if tg_op='INSERT' then
    if new.status <> 'draft' then
      raise exception 'New routing revisions must begin in draft state';
    end if;
    if new.approved_by is not null or new.approved_role is not null or new.approved_at is not null
       or new.retired_by is not null or new.retired_at is not null then
      raise exception 'Draft routing revisions cannot carry approval or retirement evidence';
    end if;
    return new;
  end if;

  if old.status='retired' then
    raise exception 'Retired routing revision % is immutable', old.id;
  end if;

  if row(new.product_id,new.revision_code,new.effective_from,new.effective_to,new.source_ref,new.created_by,new.created_role)
     is distinct from
     row(old.product_id,old.revision_code,old.effective_from,old.effective_to,old.source_ref,old.created_by,old.created_role) then
    if old.status <> 'draft' or new.status <> 'draft' then
      raise exception 'Released routing identity/effectivity is immutable; create a new revision instead';
    end if;
  end if;

  if old.status='draft' and new.status='draft' then
    if new.approved_by is not null or new.approved_role is not null or new.approved_at is not null
       or new.retired_by is not null or new.retired_at is not null then
      raise exception 'Draft routing revisions cannot carry approval or retirement evidence';
    end if;
    return new;
  end if;

  if old.status='draft' and new.status='approved' then
    if nullif(trim(coalesce(new.approved_by,'')),'') is null
       or nullif(trim(coalesce(new.approved_role,'')),'') is null
       or new.approved_at is null then
      raise exception 'Routing approval requires approver, role and timestamp evidence';
    end if;
    if new.record_revision <> old.record_revision + 1 then
      raise exception 'Routing approval must increment record revision exactly once';
    end if;
    if new.retired_by is not null or new.retired_at is not null then
      raise exception 'Approved routing revision cannot already carry retirement evidence';
    end if;
    return new;
  end if;

  if old.status='approved' and new.status='approved' then
    if row(new.approved_by,new.approved_role,new.approved_at,new.record_revision)
       is distinct from row(old.approved_by,old.approved_role,old.approved_at,old.record_revision) then
      raise exception 'Approval evidence for routing revision % is immutable', old.id;
    end if;
    return new;
  end if;

  if old.status='approved' and new.status='retired' then
    if nullif(trim(coalesce(new.retired_by,'')),'') is null or new.retired_at is null then
      raise exception 'Routing retirement requires actor and timestamp evidence';
    end if;
    if new.record_revision <> old.record_revision + 1 then
      raise exception 'Routing retirement must increment record revision exactly once';
    end if;
    return new;
  end if;

  raise exception 'Invalid routing revision lifecycle transition % -> %', old.status, new.status;
end;
$$;

drop trigger if exists trg_guard_vyndi_approved_routing_revision on vyndi_routing_revisions;
drop trigger if exists trg_guard_vyndi_routing_revision_lifecycle on vyndi_routing_revisions;
create trigger trg_guard_vyndi_routing_revision_lifecycle
before insert or update on vyndi_routing_revisions
for each row execute function guard_vyndi_routing_revision_lifecycle();
