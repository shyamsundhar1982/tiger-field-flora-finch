-- Do not re-reserve stock for Production lines that have already been physically issued.
-- Receipt auto-allocation is only allowed to reconcile still-open material requirements.
create or replace function vyndi_auto_allocate_receipt_reservations_trigger()
returns trigger
language plpgsql
as $$
declare line record;
begin
  if new.quantity_delta<=0 then return new; end if;
  for line in
    select c.id as job_card_id,l.id as job_card_line_id
      from epr_production_job_cards c
      join epr_production_job_card_lines l on l.job_card_id=c.id
      left join epr_inventory_reservations r on r.job_card_line_id=l.id and r.status='active'
     where c.status in ('released','in_progress')
       and l.sku=new.sku
       and l.issue_status in ('pending','short','reserved')
       and vyndi_canonical_unit(l.unit)=vyndi_canonical_unit(new.unit)
     group by c.id,c.due_month,c.created_at,l.id,l.quantity
    having l.quantity>coalesce(sum(r.quantity_reserved),0)
     order by c.due_month asc,c.created_at asc,l.id asc
  loop
    perform reserve_epr_inventory_for_job_line(
      'AUTORES-' || md5(line.job_card_line_id || clock_timestamp()::text || random()::text),
      line.job_card_id,line.job_card_line_id,'system:receipt','system');
  end loop;
  return new;
end;
$$;
