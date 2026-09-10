-- Fix production batch approval after the function gained an output column named
-- job_card_id. Unqualified references inside the function body can resolve
-- ambiguously against that output variable in PL/pgSQL.

create or replace function approve_vyndi_production_batch(
  p_job_card_id text,
  p_actor_user_id text,
  p_actor_role text
) returns table (
  job_card_id text,
  batch_code text,
  travellers_created integer,
  po_drafts_created integer,
  shortage_sku_count integer
)
language plpgsql
as $$
declare
  c record;
  r record;
  t record;
  v_batch text;
  v_existing integer:=0;
  v_target integer:=0;
  v_travellers integer:=0;
  v_po_drafts integer:=0;
  v_shortage_skus integer:=0;
  v_seq integer;
  v_traveller_id text;
  v_serial text;
  v_action_id text;
  v_po_id text;
  v_price numeric:=0;
  v_cost_authority text:='MISSING';
begin
  select jc.*,o.status as sales_status
    into c
    from epr_production_job_cards jc
    join vyndi_sales_orders o on o.id=jc.sales_order_id
   where jc.id=p_job_card_id
   for update of jc;
  if not found then raise exception 'Production job card not found.'; end if;
  if c.sales_status<>'confirmed' then raise exception 'Production release requires a confirmed Commercial order.'; end if;
  if c.status not in ('released','in_progress') then
    raise exception 'Production release requires a synchronized released job card; current status is %.',c.status;
  end if;
  if c.variant_id is null or trim(c.variant_id)='' then raise exception 'Job card has no exact VINDY variant.'; end if;
  if c.bom_revision is null or trim(c.bom_revision)='' then raise exception 'Job card has no released BOM revision.'; end if;
  if jsonb_array_length(coalesce(c.released_mapping_set,'[]'::jsonb))=0 then raise exception 'Job card has no released BOM mapping snapshot.'; end if;

  v_batch:=coalesce(c.batch_code,'BATCH-'||upper(substr(md5(c.id),1,12)));
  update epr_production_job_cards jc
     set batch_code=v_batch,
         approved_by=coalesce(jc.approved_by,p_actor_user_id),
         approved_at=coalesce(jc.approved_at,now()),
         updated_by=p_actor_user_id,
         updated_at=now()
   where jc.id=c.id;

  v_target:=ceil(c.units)::integer;
  select count(*)::integer into v_existing
    from epr_travellers tr where tr.job_card_id=c.id and tr.status<>'rejected';

  if v_existing<v_target then
    for v_seq in (v_existing+1)..v_target loop
      v_traveller_id:='TRV-'||gen_random_uuid()::text;
      v_serial:='VYNDI-'||upper(c.model_tier)||'-'||upper(substr(md5(c.id),1,10))||'-'||lpad(v_seq::text,3,'0');
      perform raise_epr_traveller_for_job_card(
        v_traveller_id,c.id,v_serial,c.bom_revision,'',p_actor_user_id,p_actor_role
      );
      v_travellers:=v_travellers+1;
    end loop;
  end if;

  for t in
    select tr.id,tr.venture,tr.status from epr_travellers tr
     where tr.job_card_id=c.id and tr.status='draft'
     order by tr.created_at,tr.id
  loop
    if not exists(select 1 from epr_evidence ev where ev.traveller_id=t.id and ev.gate_id='EPR-04' and ev.disposition='accepted') then
      insert into epr_evidence
        (id,traveller_id,gate_id,evidence_type,title,reference,disposition,notes,recorded_by)
      values
        ('EVD-'||gen_random_uuid()::text,t.id,'EPR-04','production_release','Single bike / batch production approval',
         v_batch,'accepted','Model, released BOM, job-card quantity and genealogy approved as one controlled build release.',p_actor_user_id);
    end if;
    if not exists(select 1 from epr_gate_events ge where ge.traveller_id=t.id and ge.gate_id='EPR-04' and ge.status='passed') then
      insert into epr_gate_events(id,traveller_id,gate_id,status,reason,actor)
      values('GATE-'||gen_random_uuid()::text,t.id,'EPR-04','passed','Approved production batch '||v_batch,p_actor_user_id);
    end if;
    update epr_travellers tr set status='released',updated_at=now() where tr.id=t.id;
    insert into epr_audit_events(id,venture,entity_type,entity_id,action,actor,payload_json)
    values('AUD-'||gen_random_uuid()::text,t.venture,'traveller',t.id,'auto_released_from_batch_approval',p_actor_user_id,
      json_build_object('jobCardId',c.id,'batchCode',v_batch,'bomRevision',c.bom_revision)::text);
  end loop;

  select count(*)::integer into v_shortage_skus
    from (
      select req.sku,vyndi_canonical_unit(req.unit)
        from vyndi_live_job_card_requirements req
       where req.job_card_id=c.id and req.sku is not null and req.shortage_quantity>0
       group by req.sku,vyndi_canonical_unit(req.unit)
    ) s;

  for r in
    select req.sku,vyndi_canonical_unit(req.unit) as unit,sum(req.shortage_quantity) as shortage_quantity,min(req.job_card_line_id) as source_line
      from vyndi_live_job_card_requirements req
     where req.job_card_id=c.id and req.sku is not null and req.shortage_quantity>0
     group by req.sku,vyndi_canonical_unit(req.unit)
     order by req.sku
  loop
    v_action_id:='JBREQ-'||upper(substr(md5(c.id||'|'||r.sku||'|'||r.unit),1,24));
    insert into epr_procurement_sku_actions
      (id,scenario,requirement_month,sku,unit,action_type,quantity,status,demand_basis,note,updated_by)
    values
      (v_action_id,'base',c.due_month,upper(r.sku),r.unit,'po',r.shortage_quantity,'planned','committed',
       'Auto-generated from approved Production job card '||c.id||' / batch '||v_batch,p_actor_user_id)
    on conflict (id) do update set
      quantity=excluded.quantity,
      status=case when epr_procurement_sku_actions.status in ('complete','cancelled') then epr_procurement_sku_actions.status else 'planned' end,
      note=excluded.note,updated_by=excluded.updated_by,updated_at=now();

    select coalesce(max(a.governed_cost_inr),0),
           coalesce(max(a.cost_authority) filter (where a.governed_cost_inr is not null),'MISSING')
      into v_price,v_cost_authority
      from vyndi_procurement_cost_authority a
     where upper(a.sku)=upper(r.sku);

    v_po_id:='AUTOPO-'||upper(substr(md5(c.id||'|'||r.sku||'|'||r.unit),1,20));
    if not exists(
      select 1 from vyndi_purchase_orders po
       where po.id=v_po_id and po.status<>'cancelled'
    ) then
      insert into vyndi_purchase_orders
        (id,supplier_id,source_action_id,job_card_id,auto_generated,requirement_month,sku,unit,quantity,
         unit_price_inr,order_date,expected_receipt_on,payment_terms_days,status,source_reference,notes,created_by,updated_by)
      values
        (v_po_id,null,v_action_id,c.id,true,c.due_month,upper(r.sku),r.unit,r.shortage_quantity,
         v_price,current_date,current_date,0,'draft','AUTO:'||c.id,
         case when v_price>0 then
           'Automatically generated from committed job-card shortage using governed cost authority '||v_cost_authority||'. Assign an approved supplier, confirm supplier price/lead time, then submit for independent approval.'
         else
           'Automatically generated from committed job-card shortage. Governed procurement cost is MISSING; unit price remains a zero-value draft placeholder only. Assign an approved supplier and positive controlled price before submission.'
         end,
         p_actor_user_id,p_actor_user_id);
      v_po_drafts:=v_po_drafts+1;
      insert into vyndi_audit_events
        (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
      values
        ('AUD-'||v_po_id,'purchase_order',v_po_id,c.sales_order_revision,'auto_draft_created_from_job_shortage',
         p_actor_user_id,p_actor_role,c.id,
         jsonb_build_object('jobCardId',c.id,'batchCode',v_batch,'sku',upper(r.sku),'quantity',r.shortage_quantity,
           'governedCostInr',v_price,'costAuthority',v_cost_authority,'supplierAssigned',false));
    end if;
  end loop;

  insert into vyndi_audit_events
    (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
  values
    ('AUD-'||c.id||'-APPROVE-'||substr(md5(clock_timestamp()::text),1,8),'production_job_card',c.id,c.sales_order_revision,
     'bike_batch_approved',p_actor_user_id,p_actor_role,c.sales_order_id,
     jsonb_build_object('batchCode',v_batch,'units',c.units,'variantId',c.variant_id,'bomRevision',c.bom_revision,
       'travellersCreated',v_travellers,'shortageSkus',v_shortage_skus,'poDraftsCreated',v_po_drafts));

  return query select c.id,v_batch,v_travellers,v_po_drafts,v_shortage_skus;
end;
$$;

comment on function approve_vyndi_production_batch(text,text,text) is
  'One governed bike/batch release. Auto draft POs use vyndi_procurement_cost_authority only; legacy/catalogue reference prices are never procurement cost. Qualifies job_card_id references to avoid PL/pgSQL output-column ambiguity.';
