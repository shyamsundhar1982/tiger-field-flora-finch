import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";

async function requireInventoryView() {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Inventory view permission denied.");
}

/**
 * Canonical inventory read model. Master Inventory owns SKU, lots, quantity,
 * MSL and FIFO. Production job-card demand is treated as a reservation against
 * free stock; the historical EPR stock ledger is no longer a competing balance.
 */
export const getAuthoritativeInventory = createServerFn({ method: "GET" }).handler(async () => {
  await requireInventoryView();
  const sql = await getSql();
  return sql`
    with balances as (
      select i.id, i.ledger_id, i.sku, i.unit,
        coalesce(sum(l.quantity_remaining), 0) as quantity_balance,
        coalesce(sum(l.quantity_remaining * l.unit_cost_inr), 0) as inventory_value_inr
      from master_inventory_items i
      left join master_inventory_lots l on l.item_id = i.id
      where i.active = true
      group by i.id
    )
    select ledger_id as venture, sku, unit, quantity_balance, inventory_value_inr,
      case when quantity_balance > 0 then inventory_value_inr / quantity_balance else 0 end as weighted_average_cost_inr
    from balances
    order by ledger_id, sku, unit
  `;
});

export const getAuthoritativeInventoryMovements = createServerFn({ method: "GET" }).handler(async () => {
  await requireInventoryView();
  const sql = await getSql();
  return sql`
    select * from (
      select l.id, i.ledger_id as venture, i.sku, 'receipt'::text as movement_type,
        l.quantity_received as quantity, i.unit, l.reference, l.notes,
        l.created_by as recorded_by, l.created_at::text as created_at,
        l.quantity_received as quantity_delta, null::text as traveller_id,
        null::text as serial_number, l.unit_cost_inr
      from master_inventory_lots l
      join master_inventory_items i on i.id = l.item_id
      where i.active = true

      union all

      select issue.id, i.ledger_id as venture, i.sku, 'issue'::text as movement_type,
        issue.quantity, i.unit, issue.reference, issue.notes,
        issue.created_by as recorded_by, issue.created_at::text as created_at,
        -issue.quantity as quantity_delta, null::text as traveller_id,
        null::text as serial_number,
        coalesce(sum(a.quantity * a.unit_cost_inr) / nullif(issue.quantity, 0), 0) as unit_cost_inr
      from master_inventory_issues issue
      join master_inventory_items i on i.id = issue.item_id
      left join master_inventory_fifo_allocations a on a.issue_id = issue.id
      where i.active = true
      group by issue.id, i.id
    ) movements
    order by created_at desc
    limit 1000
  `;
});

export const getInventoryMslWarnings = createServerFn({ method: "GET" }).handler(async () => {
  await requireInventoryView();
  const sql = await getSql();
  return sql`
    with physical as (
      select i.id, i.ledger_id, i.sku, i.unit, i.minimum_stock_level, i.planned_monthly_use,
        coalesce(sum(l.quantity_remaining), 0) as physical_quantity
      from master_inventory_items i
      left join master_inventory_lots l on l.item_id = i.id
      where i.active = true
      group by i.id
    ), committed as (
      select upper(line.sku) as sku, coalesce(sum(line.quantity), 0) as committed_quantity
      from epr_production_job_card_lines line
      join epr_production_job_cards card on card.id = line.job_card_id
      where line.sku is not null
        and card.status in ('released', 'in_progress')
        and line.issue_status in ('reserved', 'short')
      group by upper(line.sku)
    ), availability as (
      select p.*,
        coalesce(c.committed_quantity, 0) as committed_quantity,
        greatest(p.physical_quantity - coalesce(c.committed_quantity, 0), 0) as free_quantity
      from physical p
      left join committed c on c.sku = upper(p.sku)
    )
    select ledger_id as venture, sku, unit, minimum_stock_level,
      greatest(minimum_stock_level + planned_monthly_use - free_quantity, 0) as reorder_quantity,
      0::int as lead_time_days,
      free_quantity as quantity_balance,
      physical_quantity,
      committed_quantity,
      greatest(minimum_stock_level - free_quantity, 0) as shortage_quantity,
      case
        when free_quantity <= 0 then 'critical'
        when free_quantity <= minimum_stock_level then 'low'
        else 'ok'
      end as status
    from availability
    where minimum_stock_level > 0 and free_quantity <= minimum_stock_level
    order by case when free_quantity <= 0 then 0 else 1 end, ledger_id, sku, unit
  `;
});

export const getInventoryFifoTrace = createServerFn({ method: "GET" }).handler(async () => {
  await requireInventoryView();
  const sql = await getSql();
  return sql`
    select i.ledger_id as venture, i.sku, i.unit, l.id as layer_id,
      l.received_on::text as received_at, l.quantity_received, l.quantity_remaining,
      l.unit_cost_inr, coalesce(sum(a.quantity), 0) as allocated_quantity,
      count(a.id)::int as allocation_count
    from master_inventory_lots l
    join master_inventory_items i on i.id = l.item_id
    left join master_inventory_fifo_allocations a on a.lot_id = l.id
    where i.active = true and l.quantity_remaining > 0
    group by l.id, i.id
    order by i.ledger_id, i.sku, i.unit, l.received_on asc, l.created_at asc, l.id asc
    limit 500
  `;
});

export const getInventoryControlSummary = createServerFn({ method: "GET" }).handler(async () => {
  await requireInventoryView();
  const sql = await getSql();
  const [summary] = await sql`
    with balances as (
      select i.id,
        coalesce(sum(l.quantity_remaining), 0) as quantity_balance,
        coalesce(sum(l.quantity_remaining * l.unit_cost_inr), 0) as inventory_value_inr
      from master_inventory_items i
      left join master_inventory_lots l on l.item_id = i.id
      where i.active = true
      group by i.id
    )
    select count(*)::int as sku_count,
      coalesce(sum(quantity_balance), 0) as total_units,
      coalesce(sum(inventory_value_inr), 0) as inventory_value_inr,
      count(*) filter (where quantity_balance < 0)::int as negative_balance_count
    from balances
  `;
  const [lots] = await sql`
    select count(*)::int as posted_opening_balance_count
    from master_inventory_lots
  `;
  const [fifo] = await sql`
    select count(*)::int as fifo_layer_count,
      coalesce(sum(quantity_remaining), 0) as fifo_units_remaining
    from master_inventory_lots
    where quantity_remaining > 0
  `;
  return {
    skuCount: Number(summary?.sku_count ?? 0),
    totalUnits: Number(summary?.total_units ?? 0),
    inventoryValueInr: Number(summary?.inventory_value_inr ?? 0),
    negativeBalanceCount: Number(summary?.negative_balance_count ?? 0),
    postedOpeningBalanceCount: Number(lots?.posted_opening_balance_count ?? 0),
    fifoLayerCount: Number(fifo?.fifo_layer_count ?? 0),
    fifoUnitsRemaining: Number(fifo?.fifo_units_remaining ?? 0),
  };
});
