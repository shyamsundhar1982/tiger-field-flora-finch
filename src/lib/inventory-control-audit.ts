import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";

export const getInventoryControlAudit=createServerFn({method:"GET"}).handler(async()=>{
 const role=await getCommandRole();if(!role||!canPerform(role,"view"))throw new Error("Inventory audit permission denied.");const sql=await getSql();
 const [msl,fifo,alloc]=await Promise.all([
  sql`select count(*)::int as controls, count(*) filter(where lead_time_days=0)::int as missing_lead_time, count(*) filter(where minimum_stock_level>0)::int as active_msl from epr_inventory_controls where active=true`,
  sql`select count(*)::int as mismatches, coalesce(sum(abs(coalesce(b.quantity_balance,0)-coalesce(f.quantity_remaining,0))),0) as mismatch_units from (select venture,sku,unit from epr_authoritative_inventory_balance union select venture,sku,unit from epr_inventory_fifo_layers) k left join epr_authoritative_inventory_balance b on b.venture=k.venture and b.sku=k.sku and b.unit=k.unit left join (select venture,sku,unit,sum(quantity_remaining) quantity_remaining from epr_inventory_fifo_layers group by venture,sku,unit) f on f.venture=k.venture and f.sku=k.sku and f.unit=k.unit where abs(coalesce(b.quantity_balance,0)-coalesce(f.quantity_remaining,0))>0.0001`,
  sql`select count(*)::int as issue_count, count(*) filter(where abs(abs(l.quantity_delta)-coalesce(a.allocated,0))>0.0001)::int as allocation_mismatches from epr_inventory_ledger l left join (select issue_ledger_id,sum(quantity) allocated from epr_inventory_fifo_allocations group by issue_ledger_id) a on a.issue_ledger_id=l.id where l.quantity_delta<0`,
 ]);return {msl:msl[0]??{},fifo:fifo[0]??{},alloc:alloc[0]??{}};
});
