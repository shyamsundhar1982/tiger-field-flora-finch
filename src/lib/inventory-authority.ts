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
      l.quantity_delta, l.traveller_id, l.serial_number
    from epr_inventory_movements m
    join epr_inventory_ledger l on l.movement_id = m.id
    order by m.created_at desc
    limit 1000
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
  return {
    skuCount: Number(summary?.sku_count ?? 0),
    totalUnits: Number(summary?.total_units ?? 0),
    inventoryValueInr: Number(summary?.inventory_value_inr ?? 0),
    negativeBalanceCount: Number(summary?.negative_balance_count ?? 0),
    postedOpeningBalanceCount: Number(postedOpening?.posted_opening_balance_count ?? 0),
  };
});
