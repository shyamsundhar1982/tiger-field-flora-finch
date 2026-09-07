-- Final operator guard for Production reservation -> traveller -> FIFO issue.
-- Keep the existing canonical consume implementation as the accounting engine, but
-- wrap it with line-completeness and traveller-release invariants so the UI cannot
-- falsely close a partially reserved requirement or issue to an unreleased serial.

do $$
begin
  if to_regprocedure('consume_epr_inventory_reservation_unchecked(text,text,text,text,text,text)') is null then
    if to_regprocedure('consume_epr_inventory_reservation(text,text,text,text,text,text)') is null then
      raise exception 'Canonical reservation consume function is missing before migration 0028.';
    end if;
    execute 'alter function consume_epr_inventory_reservation(text,text,text,text,text,text) rename to consume_epr_inventory_reservation_unchecked';
  end if;
end;
$$;

create or replace function consume_epr_inventory_reservation(
  p_reservation_id text,
  p_traveller_id text,
  p_movement_id text,
  p_ledger_id text,
  p_actor_user_id text,
  p_actor_role text
) returns table (movement_id text, ledger_id text, resulting_balance numeric, cogs_inr numeric)
language plpgsql
as $$
declare
  r record;
  l record;
  t record;
begin
  select id,job_card_line_id,quantity_reserved,status
    into r
    from epr_inventory_reservations
   where id=p_reservation_id
   for update;
  if not found then raise exception 'Inventory reservation not found.'; end if;
  if r.status<>'active' then
    raise exception 'Only active reservations can be consumed; current status is %.',r.status;
  end if;

  select id,quantity,issue_status
    into l
    from epr_production_job_card_lines
   where id=r.job_card_line_id
   for update;
  if not found then raise exception 'Reserved job-card line not found.'; end if;
  if l.issue_status='issued' then raise exception 'Job-card line is already issued.'; end if;
  if r.quantity_reserved + 0.0001 < l.quantity then
    raise exception 'Partial reservation cannot be posted as a complete material issue: required %, reserved %. Receive/reconcile the shortage before kitting.',
      l.quantity,r.quantity_reserved;
  end if;

  select id,status
    into t
    from epr_travellers
   where id=p_traveller_id
   for update;
  if not found then raise exception 'Traveller not found.'; end if;
  if t.status not in ('released','in_build') then
    raise exception 'Traveller must be released or in build before reserved material can be issued; current status is %.',t.status;
  end if;

  return query
  select x.movement_id,x.ledger_id,x.resulting_balance,x.cogs_inr
    from consume_epr_inventory_reservation_unchecked(
      p_reservation_id,p_traveller_id,p_movement_id,p_ledger_id,p_actor_user_id,p_actor_role
    ) as x;
end;
$$;
