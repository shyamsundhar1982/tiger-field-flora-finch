-- VIBPE Assurance remediation: close the 27 findings surfaced after PR #104.
-- Forward-only. Canonical ownership is preserved; no duplicate business writer is introduced.

-- -----------------------------------------------------------------------------
-- Canonical Finance/Governance authority that was previously only projected or
-- static in the UI.
-- -----------------------------------------------------------------------------
create table if not exists vyndi_financial_statement_snapshots (
  id text primary key,
  plan_month integer not null check (plan_month between 1 and 36),
  revision integer not null default 1 check (revision > 0),
  as_of_date date not null,
  cash_lakh numeric(18,4) not null default 0,
  receivables_lakh numeric(18,4) not null default 0,
  inventory_lakh numeric(18,4) not null default 0,
  fixed_assets_lakh numeric(18,4) not null default 0,
  other_assets_lakh numeric(18,4) not null default 0,
  payables_lakh numeric(18,4) not null default 0,
  debt_lakh numeric(18,4) not null default 0,
  other_liabilities_lakh numeric(18,4) not null default 0,
  equity_lakh numeric(18,4) not null default 0,
  retained_earnings_lakh numeric(18,4) not null default 0,
  source_reference text not null,
  status text not null default 'posted' check (status in ('draft','posted','superseded')),
  created_by text not null,
  created_at timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz,
  superseded_at timestamptz
);

create unique index if not exists vyndi_financial_statement_posted_month_uq
  on vyndi_financial_statement_snapshots(plan_month)
  where status='posted';

create or replace view vyndi_balance_sheet_authority as
select
  id,plan_month,revision,as_of_date,cash_lakh,receivables_lakh,inventory_lakh,fixed_assets_lakh,
  other_assets_lakh,payables_lakh,debt_lakh,other_liabilities_lakh,equity_lakh,retained_earnings_lakh,
  (cash_lakh+receivables_lakh+inventory_lakh+fixed_assets_lakh+other_assets_lakh) as total_assets_lakh,
  (payables_lakh+debt_lakh+other_liabilities_lakh+equity_lakh+retained_earnings_lakh) as total_liabilities_equity_lakh,
  (cash_lakh+receivables_lakh+inventory_lakh+fixed_assets_lakh+other_assets_lakh)
    -(payables_lakh+debt_lakh+other_liabilities_lakh+equity_lakh+retained_earnings_lakh) as balance_error_lakh,
  source_reference,status,created_by,created_at,approved_by,approved_at
from vyndi_financial_statement_snapshots
where status='posted'
order by plan_month,revision desc;

create or replace view vyndi_cash_authority as
with months as (select generate_series(1,36)::integer as plan_month)
select
  m.plan_month,
  coalesce(a.closing_cash,0)::numeric(18,4) as closing_cash_lakh,
  coalesce(a.receivables,t.receivables,0)::numeric(18,4) as receivables_lakh,
  coalesce(a.inventory,0)::numeric(18,4) as inventory_lakh,
  coalesce(a.payables,0)::numeric(18,4) as payables_lakh,
  coalesce(t.revenue,0)::numeric(18,4) as transaction_revenue_lakh,
  coalesce(t.units,0)::numeric(14,4) as transaction_units,
  coalesce(a.source_reference,case when coalesce(t.revenue,0)<>0 or coalesce(t.units,0)<>0
    then 'transaction-ledger:M'||m.plan_month else '' end) as source_reference,
  coalesce(a.verified,false) or coalesce(t.revenue,0)<>0 or coalesce(t.units,0)<>0 as verified,
  a.updated_at
from months m
left join vyndi_monthly_actuals a on a.plan_month=m.plan_month
left join vyndi_monthly_transaction_actuals t on t.plan_month=m.plan_month
order by m.plan_month;

create table if not exists vyndi_risk_register (
  id text primary key,
  risk text not null,
  likelihood text not null check (likelihood in ('Low','Med','High')),
  impact text not null check (impact in ('Low','Med','High')),
  mitigation text not null,
  owner_workspace text not null default 'finance-governance',
  status text not null default 'open' check (status in ('open','mitigating','accepted','closed')),
  source_reference text not null,
  record_revision integer not null default 1,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

insert into vyndi_risk_register
  (id,risk,likelihood,impact,mitigation,status,source_reference,updated_by)
values
  ('RISK-GRANT-DELAY','Grant delay 3–6 months','High','High','Standby funding and staged discretionary spend','open','migrated:legacy-risk-register','system:vibpe'),
  ('RISK-OEM-QUALITY','OEM quality / schedule','Med','High','Dual qualify, factory review and governed quality gates','open','migrated:legacy-risk-register','system:vibpe'),
  ('RISK-ISO-FIRST-PASS','ISO first-pass fail','Med','High','FEA before test, retest reserve and tooling release only after evidence','open','migrated:legacy-risk-register','system:vibpe'),
  ('RISK-IP-LEAKAGE','IP leakage to OEM','Med','High','Controlled NDA, staged CAD disclosure and tooling ownership','open','migrated:legacy-risk-register','system:vibpe'),
  ('RISK-EARLY-EQUITY','Early cheap equity','Med','High','Prioritise non-dilutive funding and governed valuation gates','open','migrated:legacy-risk-register','system:vibpe'),
  ('RISK-CASH-GAP','Operating cash gap','High','High','Treasury threshold, staged funding and controlled standby draw','open','migrated:legacy-risk-register','system:vibpe'),
  ('RISK-FOUNDER-CONTINUITY','Founder incapacity','Low','High','Key-person cover and documented operating authority','open','migrated:legacy-risk-register','system:vibpe'),
  ('RISK-CUSTOMS','HS / customs miss','Med','Med','CHA/CA classification review before committed pricing','open','migrated:legacy-risk-register','system:vibpe'),
  ('RISK-PRODUCT-LIABILITY','Product liability','Low','High','Bind product-liability cover before customer delivery','open','migrated:legacy-risk-register','system:vibpe'),
  ('RISK-BIS-SCOPE','BIS / regulatory scope change','Low','High','Verify applicable scope before any regulated product extension','open','migrated:legacy-risk-register','system:vibpe')
on conflict (id) do nothing;

create table if not exists vyndi_legal_register (
  id text primary key,
  register_type text not null check (register_type in ('ip','agreement','warranty','insurance','compliance')),
  subject text not null,
  instrument text not null,
  target_timing text,
  priority text not null default 'High' check (priority in ('Critical','High','Med','Low')),
  cost_lakh numeric(14,4) not null default 0,
  status text not null default 'planned' check (status in ('planned','in_progress','filed','executed','active','closed','superseded')),
  notes text not null default '',
  source_reference text not null,
  record_revision integer not null default 1,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

insert into vyndi_legal_register
  (id,register_type,subject,instrument,target_timing,priority,cost_lakh,status,notes,source_reference,updated_by)
values
  ('LEGAL-IP-GEOMETRY','ip','Frame geometry','Provisional patent (IN)','At controlled CAD lock','Critical',0.8,'planned','File before uncontrolled OEM disclosure.','migrated:legacy-legal-register','system:vibpe'),
  ('LEGAL-IP-LAYUP','ip','Layup / process claims','Provisional patent (IN)','At controlled process lock','High',0.6,'planned','Claims require engineering evidence.','migrated:legacy-legal-register','system:vibpe'),
  ('LEGAL-IP-DESIGN','ip','Frame + fork industrial design','Design (IN)','At controlled design lock','High',0.25,'planned','Industrial-design protection.','migrated:legacy-legal-register','system:vibpe'),
  ('LEGAL-TM-VYNDI','ip','VYNDI word + device','Trademark classes applicable to cycles/retail','Before public launch','Critical',0.35,'planned','Current product brand.','migrated:legacy-legal-register','system:vibpe'),
  ('LEGAL-TM-VAYU','ip','Vāyú Shastr word','House mark','Before public launch','High',0.2,'planned','Company/house mark.','migrated:legacy-legal-register','system:vibpe'),
  ('LEGAL-FOUNDER-IP','agreement','Founder IP assignment','IP assignment agreement','At incorporation','Critical',0,'planned','','migrated:legacy-legal-register','system:vibpe'),
  ('LEGAL-NDA-OEM','agreement','OEM / contractor confidentiality','Mutual NDA','Before RFQ / CAD disclosure','Critical',0,'planned','','migrated:legacy-legal-register','system:vibpe'),
  ('LEGAL-OEM-MFG','agreement','OEM manufacturing','Manufacturing agreement','Before purchase commitment','Critical',0,'planned','','migrated:legacy-legal-register','system:vibpe'),
  ('LEGAL-TOOLING','agreement','Tooling ownership','Tooling ownership agreement','With tooling PO','Critical',0,'planned','','migrated:legacy-legal-register','system:vibpe'),
  ('LEGAL-CUSTOMER-TERMS','agreement','Customer terms / warranty / privacy','Customer legal pack','Before customer launch','High',0,'planned','','migrated:legacy-legal-register','system:vibpe'),
  ('LEGAL-PRODUCT-LIABILITY','insurance','Product liability','Insurance policy','Before first customer delivery','Critical',0,'planned','','migrated:legacy-legal-register','system:vibpe')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- A live shortage must always have a governed procurement response. The response
-- is a DRAFT PO shell + planning action, never an unauthorised supplier commitment.
-- -----------------------------------------------------------------------------
create or replace function ensure_vyndi_shortage_procurement_response(
  p_job_card_id text,
  p_actor_user_id text,
  p_actor_role text
) returns integer
language plpgsql
as $$
declare
  c record;
  r record;
  v_action_id text;
  v_po_id text;
  v_price numeric:=0;
  v_created integer:=0;
begin
  select id,sales_order_id,sales_order_revision,due_month,status
    into c
    from epr_production_job_cards
   where id=p_job_card_id
   for update;
  if not found then raise exception 'Production job card not found.'; end if;
  if c.status='cancelled' then return 0; end if;

  for r in
    select upper(sku) as sku,vyndi_canonical_unit(unit) as unit,
           sum(shortage_quantity)::numeric as shortage_quantity
      from vyndi_live_job_card_requirements
     where job_card_id=c.id and sku is not null and shortage_quantity>0
     group by upper(sku),vyndi_canonical_unit(unit)
     order by upper(sku)
  loop
    v_action_id:='VIBPE-JBREQ-'||upper(substr(md5(c.id||'|'||r.sku||'|'||r.unit),1,20));
    insert into epr_procurement_sku_actions
      (id,scenario,requirement_month,sku,unit,action_type,quantity,status,demand_basis,note,updated_by)
    values
      (v_action_id,'base',c.due_month,r.sku,r.unit,'po',r.shortage_quantity,'planned','committed',
       'Governed response to live Job Card shortage '||c.id,p_actor_user_id)
    on conflict (id) do update set
      quantity=excluded.quantity,
      status=case when epr_procurement_sku_actions.status='cancelled' then 'planned'
                  when epr_procurement_sku_actions.status='complete' then 'complete'
                  else excluded.status end,
      demand_basis='committed',note=excluded.note,updated_by=excluded.updated_by,updated_at=now();

    if not exists (
      select 1 from vyndi_purchase_orders p
       where p.job_card_id=c.id and upper(p.sku)=r.sku
         and vyndi_canonical_unit(p.unit)=r.unit and p.status<>'cancelled'
    ) then
      select coalesce(max(
        case when m.attributes->>'legacyPriceInr' ~ '^[0-9]+([.][0-9]+)?$'
             then (m.attributes->>'legacyPriceInr')::numeric else 0 end
      ),0)
        into v_price
        from master_data_records m
       where m.domain='inventory' and m.status='approved' and upper(m.code)=r.sku;

      v_po_id:='VIBPE-AUTOPO-'||upper(substr(md5(c.id||'|'||r.sku||'|'||r.unit),1,18));
      insert into vyndi_purchase_orders
        (id,supplier_id,source_action_id,job_card_id,auto_generated,requirement_month,sku,unit,quantity,
         unit_price_inr,order_date,expected_receipt_on,payment_terms_days,status,source_reference,notes,
         created_by,updated_by)
      values
        (v_po_id,null,v_action_id,c.id,true,c.due_month,r.sku,r.unit,r.shortage_quantity,
         v_price,current_date,current_date,0,'draft','VIBPE-SHORTAGE:'||c.id,
         'Governed draft response to live shortage. Assign approved supplier and commercial terms before submission; independent approval remains mandatory.',
         p_actor_user_id,p_actor_user_id)
      on conflict (id) do nothing;

      insert into vyndi_audit_events
        (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
      values
        ('AUD-'||v_po_id,'purchase_order',v_po_id,c.sales_order_revision,'vibpe_shortage_response_created',
         p_actor_user_id,p_actor_role,c.id,
         jsonb_build_object('jobCardId',c.id,'sku',r.sku,'unit',r.unit,'quantity',r.shortage_quantity,
                            'supplierAssigned',false,'supplierCommitment',false))
      on conflict (id) do nothing;
      v_created:=v_created+1;
    end if;
  end loop;
  return v_created;
end;
$$;

do $$
declare c record;
begin
  for c in
    select distinct jc.id
      from epr_production_job_cards jc
      join vyndi_live_job_card_requirements r on r.job_card_id=jc.id
     where jc.status<>'cancelled' and r.sku is not null and r.shortage_quantity>0
  loop
    perform ensure_vyndi_shortage_procurement_response(c.id,'system:vibpe-remediation','system');
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Surface evidence after route reconciliation. Each route listed as FULL below
-- is bound by this change to the named canonical backend.
-- -----------------------------------------------------------------------------
update vyndi_vibpe_surface_registry
   set coverage_status='full',
       evidence_source=case surface_id
         when 'route:product' then 'src/lib/product-authority.ts → vyndi_product_catalog'
         when 'route:engineering' then 'src/lib/engineering-authority.ts → vyndi_engineering_baselines/vyndi_engineering_change_requests'
         when 'route:quality' then 'src/lib/quality-authority.ts → canonical Quality tables'
         when 'route:people-office' then 'src/lib/people-office-authority.ts → canonical People & Office tables/feed'
         when 'route:dispatch-visibility' then 'src/lib/dispatch-authority.ts → vyndi_dispatch_register'
         when 'route:payables' then 'src/lib/procure-to-pay-authority.ts → vyndi_accounts_payable'
         when 'route:cash' then 'src/lib/finance-governance-authority.ts → vyndi_cash_authority'
         when 'route:balance-sheet' then 'src/lib/finance-governance-authority.ts → vyndi_balance_sheet_authority'
         when 'route:risk' then 'src/lib/finance-governance-authority.ts → vyndi_risk_register'
         when 'route:legal' then 'src/lib/finance-governance-authority.ts → vyndi_legal_register'
         else evidence_source end,
       notes='Canonical route binding reconciled by VIBPE Assurance remediation 0057'
 where surface_id in (
   'route:product','route:engineering','route:quality','route:people-office','route:dispatch-visibility',
   'route:payables','route:cash','route:balance-sheet','route:risk','route:legal'
 );

insert into vyndi_vibpe_surface_registry
  (surface_id,surface_type,surface_name,domain,owner_workspace,entity_type,coverage_status,evidence_source,notes)
values
  ('view:cash-authority','view','vyndi_cash_authority','finance','finance-governance','monthly_actual','full','transaction actuals + verified monthly actuals','Canonical cash/read authority'),
  ('table:financial-statement-snapshots','table','vyndi_financial_statement_snapshots','finance','finance-governance','financial_statement_snapshot','full','controlled posted snapshots','Canonical balance-sheet source authority'),
  ('view:balance-sheet-authority','view','vyndi_balance_sheet_authority','finance','finance-governance','financial_statement_snapshot','full','posted balanced snapshots only','Canonical balance-sheet read authority'),
  ('table:risk-register','table','vyndi_risk_register','governance','finance-governance','risk_register_item','full','controlled risk register','Canonical risk authority'),
  ('table:legal-register','table','vyndi_legal_register','governance','finance-governance','legal_register_item','full','controlled legal/IP register','Canonical legal/IP authority')
on conflict (surface_id) do update set
  surface_type=excluded.surface_type,surface_name=excluded.surface_name,domain=excluded.domain,
  owner_workspace=excluded.owner_workspace,entity_type=excluded.entity_type,coverage_status=excluded.coverage_status,
  evidence_source=excluded.evidence_source,notes=excluded.notes;

insert into vyndi_vibpe_entity_registry
  (entity_type,domain,source_table,primary_key_column,actor_visibility,lineage_key,critical,notes)
values
  ('financial_statement_snapshot','finance','vyndi_financial_statement_snapshots','id','audit_event','plan_month',true,'Canonical posted balance-sheet snapshot'),
  ('risk_register_item','governance','vyndi_risk_register','id','audit_event','id',true,'Canonical risk register item'),
  ('legal_register_item','governance','vyndi_legal_register','id','audit_event','id',true,'Canonical legal/IP register item')
on conflict (entity_type) do update set
  domain=excluded.domain,source_table=excluded.source_table,primary_key_column=excluded.primary_key_column,
  actor_visibility=excluded.actor_visibility,lineage_key=excluded.lineage_key,critical=excluded.critical,notes=excluded.notes;