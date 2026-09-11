-- G5: Dispatch ownership is Operations / Fulfilment.
-- Finance remains downstream owner of invoice and collection only.

alter table vyndi_shipments
  add column if not exists job_card_id text references epr_production_job_cards(id) on delete restrict;
alter table vyndi_shipments
  add column if not exists owner_workspace text not null default 'operations';

alter table vyndi_shipments drop constraint if exists vyndi_shipments_owner_workspace_check;
alter table vyndi_shipments add constraint vyndi_shipments_owner_workspace_check
  check (owner_workspace='operations');

comment on table vyndi_shipments is
  'Canonical Operations/Fulfilment dispatch authority. Finance consumes posted shipment evidence but does not own shipment execution.';
comment on column vyndi_shipments.job_card_id is
  'Production Job Card used to authorize this dispatch. Nullable only for legacy shipments posted before canonical dispatch cutover.';

-- Replace the posting function without changing its public signature so current callers remain compatible.
create or replace function post_vyndi_shipment(
  p_id text,p_sales_order_id text,p_plan_month integer,p_units numeric,p_source_reference text,
  p_actor_user_id text,p_actor_role text
) returns text
language plpgsql
as $$
declare
  v_order_status text;
  v_order_units numeric;
  v_order_revision integer;
  v_job_card_id text;
  v_job_status text;
  v_shipped numeric;
  v_quality_released numeric;
  v_snapshot jsonb;
begin
  if trim(coalesce(p_source_reference,''))='' then raise exception 'Shipment source reference is required.'; end if;
  perform pg_advisory_xact_lock(hashtext('shipment|' || p_id)::bigint);
  if exists(select 1 from vyndi_shipments where id=p_id) then
    if exists(select 1 from vyndi_shipments where id=p_id and sales_order_id=p_sales_order_id and plan_month=p_plan_month and units=p_units and status='posted') then return p_id; end if;
    raise exception 'Shipment id already exists with different state.';
  end if;

  select o.status,o.units,o.revision
    into v_order_status,v_order_units,v_order_revision
    from vyndi_sales_orders o
   where o.id=p_sales_order_id;
  if not found then raise exception 'Sales order not found.'; end if;
  if v_order_status not in ('confirmed','delivered') then raise exception 'Shipment requires a confirmed sales order.'; end if;

  select c.id,c.status
    into v_job_card_id,v_job_status
    from epr_production_job_cards c
   where c.sales_order_id=p_sales_order_id
     and c.sales_order_revision=v_order_revision
     and c.status<>'cancelled'
   order by c.created_at desc,c.id desc
   limit 1;
  if not found or v_job_status is distinct from 'complete' then
    raise exception 'Shipment requires the current-revision Production Job Card to be complete.';
  end if;

  select count(*)::numeric
    into v_quality_released
    from vyndi_quality_releases q
   where q.job_card_id=v_job_card_id
     and q.decision='released'
     and q.superseded_at is null;

  select coalesce(sum(units),0)
    into v_shipped
    from vyndi_shipments
   where sales_order_id=p_sales_order_id and status='posted';

  if p_units<=0 or v_shipped+p_units>v_order_units then
    raise exception 'Shipment quantity exceeds remaining confirmed order quantity.';
  end if;
  if v_shipped+p_units>v_quality_released then
    raise exception 'Dispatch is blocked: only % serialized unit(s) have current Quality release evidence for Job Card %.',v_quality_released,v_job_card_id;
  end if;

  insert into vyndi_shipments(id,sales_order_id,job_card_id,plan_month,units,source_reference,posted_by,owner_workspace)
  values(p_id,p_sales_order_id,v_job_card_id,p_plan_month,p_units,p_source_reference,p_actor_user_id,'operations');

  v_snapshot:=jsonb_build_object(
    'shipmentId',p_id,'salesOrderId',p_sales_order_id,'salesOrderRevision',v_order_revision,
    'jobCardId',v_job_card_id,'planMonth',p_plan_month,'units',p_units,
    'qualityReleasedUnits',v_quality_released,'ownerWorkspace','operations','sourceReference',p_source_reference
  );
  insert into vyndi_audit_events(
    id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json,
    correlation_id,gate_id,gate_result,previous_state,new_state,reason
  ) values(
    'AUD-SHIP-'||p_id||'-R1','shipment',p_id,1,'posted',p_actor_user_id,p_actor_role,p_source_reference,v_snapshot,
    'ORDER|'||p_sales_order_id||'|R'||v_order_revision,'G12-DISPATCH','pass',null,'posted','Operations dispatch posted after Production completion and Quality release.'
  );
  return p_id;
end;
$$;

create or replace view vyndi_dispatch_register as
select
  s.id as shipment_id,
  s.sales_order_id,
  o.revision as sales_order_revision,
  s.job_card_id,
  s.plan_month,
  s.units,
  s.status,
  s.owner_workspace,
  s.source_reference,
  s.posted_by,
  s.posted_at,
  count(q.id) filter (where q.decision='released' and q.superseded_at is null)::int as current_quality_release_count,
  i.id as invoice_id,
  i.status as invoice_status,
  i.amount_lakh as invoice_amount_lakh
from vyndi_shipments s
join vyndi_sales_orders o on o.id=s.sales_order_id
left join vyndi_quality_releases q on q.job_card_id=s.job_card_id
left join vyndi_invoices i on i.shipment_id=s.id
group by s.id,s.sales_order_id,o.revision,s.job_card_id,s.plan_month,s.units,s.status,s.owner_workspace,
         s.source_reference,s.posted_by,s.posted_at,i.id,i.status,i.amount_lakh;

comment on view vyndi_dispatch_register is
  'Operations dispatch register with downstream Finance invoice visibility. Shipment remains Operations-owned; invoice remains Finance-owned.';
