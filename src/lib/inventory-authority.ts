import { createServerFn } from "@tanstack/react-start";
import { getCommandRole } from "@/lib/command-access";
import { getSql } from "@/lib/db";
import { canPerform } from "@/lib/page-access";

async function requireInventoryView(){const role=await getCommandRole();if(!role||!canPerform(role,"view"))throw new Error("Inventory view permission denied.");}

/** Specialist read model over the same physical ledger used by Master Inventory and Production. */
export const getAuthoritativeInventory=createServerFn({method:"GET"}).handler(async()=>{await requireInventoryView();const sql=await getSql();return sql`
  select 'shared'::text as venture,sku,unit,quantity_balance,inventory_value_inr,weighted_average_cost_inr
    from vyndi_inventory_balance order by sku,unit
`;});

export const getAuthoritativeInventoryMovements=createServerFn({method:"GET"}).handler(async()=>{await requireInventoryView();const sql=await getSql();return sql`
  select m.id,m.venture,m.sku,m.movement_type,m.quantity,vyndi_canonical_unit(m.unit) as unit,m.reference,
         m.notes,m.recorded_by,m.created_at::text as created_at,l.quantity_delta,l.traveller_id,l.serial_number,l.unit_cost_inr,l.effective_on::text as effective_on
    from epr_inventory_movements m join epr_inventory_ledger l on l.movement_id=m.id
   order by coalesce(l.effective_on,l.created_at::date) desc,m.created_at desc limit 1000
`;});

export const getInventoryMslWarnings=createServerFn({method:"GET"}).handler(async()=>{await requireInventoryView();const sql=await getSql();return sql`
  select 'shared'::text as venture,i.sku,vyndi_canonical_unit(i.unit) as unit,i.minimum_stock_level,
         i.minimum_stock_level as reorder_quantity,0::int as lead_time_days,
         coalesce(a.physical_quantity,0) as quantity_balance,
         greatest(i.minimum_stock_level-coalesce(a.available_to_promise,0),0) as shortage_quantity,
         case when coalesce(a.available_to_promise,0)<=0 then 'critical'
              when coalesce(a.available_to_promise,0)<=i.minimum_stock_level then 'low' else 'ok' end as status
    from master_inventory_items i
    left join vyndi_inventory_available_to_promise a on a.sku=i.sku and a.unit=vyndi_canonical_unit(i.unit)
   where i.active=true and i.minimum_stock_level>0 and coalesce(a.available_to_promise,0)<=i.minimum_stock_level
   order by case when coalesce(a.available_to_promise,0)<=0 then 0 else 1 end,i.sku
`;});

export const getInventoryFifoTrace=createServerFn({method:"GET"}).handler(async()=>{await requireInventoryView();const sql=await getSql();return sql`
  select 'shared'::text as venture,l.sku,vyndi_canonical_unit(l.unit) as unit,l.id as layer_id,l.received_at::text as received_at,
         l.quantity_received,l.quantity_remaining,l.unit_cost_inr,coalesce(sum(a.quantity),0) as allocated_quantity,count(a.id)::int as allocation_count
    from epr_inventory_fifo_layers l left join epr_inventory_fifo_allocations a on a.layer_id=l.id
   where l.quantity_remaining>0
   group by l.id order by l.sku,vyndi_canonical_unit(l.unit),l.received_at,l.id limit 1000
`;});

export const getInventoryControlSummary=createServerFn({method:"GET"}).handler(async()=>{await requireInventoryView();const sql=await getSql();const [summary]=await sql`
  select count(*)::int as sku_count,coalesce(sum(quantity_balance),0) as total_units,coalesce(sum(inventory_value_inr),0) as inventory_value_inr,
         count(*) filter(where quantity_balance<0)::int as negative_balance_count from vyndi_inventory_balance
`;const [postedOpening]=await sql`select count(*)::int as posted_opening_balance_count from epr_inventory_opening_balances where status='posted'`;const [fifo]=await sql`select count(*)::int as fifo_layer_count,coalesce(sum(quantity_remaining),0) as fifo_units_remaining from epr_inventory_fifo_layers where quantity_remaining>0`;const [reservations]=await sql`select count(*)::int as active_reservation_count,coalesce(sum(quantity_reserved),0) as reserved_units from epr_inventory_reservations where status='active'`;return{skuCount:Number(summary?.sku_count??0),totalUnits:Number(summary?.total_units??0),inventoryValueInr:Number(summary?.inventory_value_inr??0),negativeBalanceCount:Number(summary?.negative_balance_count??0),postedOpeningBalanceCount:Number(postedOpening?.posted_opening_balance_count??0),fifoLayerCount:Number(fifo?.fifo_layer_count??0),fifoUnitsRemaining:Number(fifo?.fifo_units_remaining??0),activeReservationCount:Number(reservations?.active_reservation_count??0),reservedUnits:Number(reservations?.reserved_units??0)};});
