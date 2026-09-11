-- Keep the governed shortage response synchronized whenever reservation logic changes a live shortage.
-- This creates only a draft response; supplier commitment still requires the existing submit/approve/issue gates.

create or replace function trg_vyndi_shortage_procurement_response()
returns trigger
language plpgsql
as $$
declare c record;
begin
  if new.shortage_quantity > 0 and new.sku is not null then
    select updated_by into c from epr_production_job_cards where id=new.job_card_id;
    perform ensure_vyndi_shortage_procurement_response(
      new.job_card_id,
      coalesce(c.updated_by,'system:vibpe-shortage-trigger'),
      'system'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists epr_job_line_shortage_procurement_response on epr_production_job_card_lines;
create trigger epr_job_line_shortage_procurement_response
after update of shortage_quantity on epr_production_job_card_lines
for each row
when (new.shortage_quantity > 0 and new.sku is not null)
execute function trg_vyndi_shortage_procurement_response();
