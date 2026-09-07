import { createServerFn } from "@tanstack/react-start";
import { getCommandRole } from "@/lib/command-access";
import { getSql } from "@/lib/db";
import { canPerform } from "@/lib/page-access";

export const getInventoryControlAudit=createServerFn({method:"GET"}).handler(async()=>{
  const role=await getCommandRole(); if(!role||!canPerform(role,"view")) throw new Error("Inventory audit permission denied.");
  const sql=await getSql();
  const [msl,fifo,alloc,reservations,cutover]=await Promise.all([
    sql`select count(*)::int as controls,count(*) filter(where minimum_stock_level>0)::int as active_msl,count(*) filter(where planned_monthly_use<=0)::int as missing_plan_use from master_inventory_items where active=true`,
    sql`with f as (select sku,vyndi_canonical_unit(unit) unit,sum(quantity_remaining) quantity_remaining from epr_inventory_fifo_layers group by sku,vyndi_canonical_unit(unit)), k as (select sku,unit from vyndi_inventory_balance union select sku,unit from f) select count(*)::int as mismatches,coalesce(sum(abs(coalesce(b.quantity_balance,0)-coalesce(f.quantity_remaining,0))),0) as mismatch_units from k left join vyndi_inventory_balance b on b.sku=k.sku and b.unit=k.unit left join f on f.sku=k.sku and f.unit=k.unit where abs(coalesce(b.quantity_balance,0)-coalesce(f.quantity_remaining,0))>0.0001`,
    sql`select count(*)::int as issue_count,count(*) filter(where abs(abs(l.quantity_delta)-coalesce(a.allocated,0))>0.0001)::int as allocation_mismatches from epr_inventory_ledger l left join (select issue_ledger_id,sum(quantity) allocated from epr_inventory_fifo_allocations group by issue_ledger_id) a on a.issue_ledger_id=l.id where l.quantity_delta<0`,
    sql`select count(*)::int as active_reservations,coalesce(sum(quantity_reserved),0) as reserved_units,count(*) filter(where quantity_reserved<=0)::int as invalid_reservations from epr_inventory_reservations where status='active'`,
    sql`select count(*)::int as outstanding_legacy_lots,count(*) filter(where reconciliation_class='CATALOGUE_SEED_REVIEW')::int as catalogue_seed_review,count(*) filter(where reconciliation_class='USER_RECEIPT_REVIEW')::int as user_receipt_review from vyndi_master_inventory_cutover_report`,
  ]);
  return {msl:msl[0]??{},fifo:fifo[0]??{},alloc:alloc[0]??{},reservations:reservations[0]??{},cutover:cutover[0]??{}};
});
