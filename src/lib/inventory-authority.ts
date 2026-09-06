import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";

async function requireInventoryView() {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Inventory view permission denied.");
}

/** Authoritative inventory read model. Never reads SEED_INVENTORY/localStorage. */
export const getAuthoritativeInventory = createServerFn({ method: "GET" }).handler(async () => {
  await requireInventoryView();
  const sql = await getSql();
  return sql`
    select venture, sku, unit, quantity_balance, inventory_value_inr, weighted_average_cost_inr
    from epr_authoritative_inventory_balance
    order by venture, sku, unit
  `;
});

export const getAuthoritativeInventoryMovements = createServerFn({ method: "GET" }).handler(async () => {
  await requireInventoryView();
  const sql = await getSql();
  return sql`
    select m.id, m.venture, m.sku, m.movement_type, m.quantity, m.unit, m.reference,
      m.notes, m.recorded_by, m.created_at::text as created_at,
      l.quantity_delta, l.traveller_id, l.serial_number, l.unit_cost_inr
    from epr_inventory_movements m
    join epr_inventory_ledger l on l.movement_id = m.id
    order by m.created_at desc
    limit 1000
  `;
});

export const getInventoryMslWarnings = createServerFn({ method: "GET" }).handler(async () => {
  await requireInventoryView();
  const sql = await getSql();
  return sql`
    select
      c.venture,
      c.sku,
      c.unit,
      c.minimum_stock_level,
      c.reorder_quantity,
      c.lead_time_days,
      coalesce(b.quantity_balance, 0) as quantity_balance,
      greatest(c.minimum_stock_level - coalesce(b.quantity_balance, 0), 0) as shortage_quantity,
      case
        when coalesce(b.quantity_balance, 0) <= 0 then 'critical'
        when coalesce(b.quantity_balance, 0) <= c.minimum_stock_level then 'low'
        else 'ok'
      end as status
    from epr_inventory_controls c
    left join epr_authoritative_inventory_balance b
      on b.venture = c.venture and b.sku = c.sku and b.unit = c.unit
    where c.active = true
      and c.minimum_stock_level > 0
      and coalesce(b.quantity_balance, 0) <= c.minimum_stock_level
    order by
      case when coalesce(b.quantity_balance, 0) <= 0 then 0 else 1 end,
      c.venture, c.sku, c.unit
  `;
});

export const getInventoryFifoTrace = createServerFn({ method: "GET" }).handler(async () => {
  await requireInventoryView();
  const sql = await getSql();
  return sql`
    select
      l.venture,
      l.sku,
      l.unit,
      l.id as layer_id,
      l.received_at::text as received_at,
      l.quantity_received,
      l.quantity_remaining,
      l.unit_cost_inr,
      coalesce(sum(a.quantity), 0) as allocated_quantity,
      count(a.id)::int as allocation_count
    from epr_inventory_fifo_layers l
    left join epr_inventory_fifo_allocations a on a.layer_id = l.id
    where l.quantity_remaining > 0
    group by l.id
    order by l.venture, l.sku, l.unit, l.received_at asc, l.id asc
    limit 500
  `;
});

export const getInventoryControlSummary = createServerFn({ method: "GET" }).handler(async () => {
  await requireInventoryView();
  const sql = await getSql();
  const [summary] = await sql`
    select count(*)::int as sku_count,
      coalesce(sum(quantity_balance),0) as total_units,
      coalesce(sum(inventory_value_inr),0) as inventory_value_inr,
      count(*) filter (where quantity_balance < 0)::int as negative_balance_count
    from epr_authoritative_inventory_balance
  `;
  const [postedOpening] = await sql`
    select count(*)::int as posted_opening_balance_count
    from epr_inventory_opening_balances where status='posted'
  `;
  const [fifo] = await sql`
    select count(*)::int as fifo_layer_count,
      coalesce(sum(quantity_remaining),0) as fifo_units_remaining
    from epr_inventory_fifo_layers
    where quantity_remaining > 0
  `;
  return {
    skuCount: Number(summary?.sku_count ?? 0),
    totalUnits: Number(summary?.total_units ?? 0),
    inventoryValueInr: Number(summary?.inventory_value_inr ?? 0),
    negativeBalanceCount: Number(summary?.negative_balance_count ?? 0),
    postedOpeningBalanceCount: Number(postedOpening?.posted_opening_balance_count ?? 0),
    fifoLayerCount: Number(fifo?.fifo_layer_count ?? 0),
    fifoUnitsRemaining: Number(fifo?.fifo_units_remaining ?? 0),
  };
});
