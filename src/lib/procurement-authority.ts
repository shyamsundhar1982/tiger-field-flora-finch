import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";
import {
  buildProcurementForecast,
  procurementSummary,
  type ProcurementForecastRow,
} from "@/lib/data/procurement-planning";
import {
  DEFAULT_APPROVED_OPERATING_PLAN,
  normalizeOperatingPlan,
  type OperatingPlan,
} from "@/lib/planning/operating-plan";

async function requireProcurementView() {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Procurement view permission denied.");
}

async function publishedOperatingPlan(sql: Awaited<ReturnType<typeof getSql>>): Promise<OperatingPlan> {
  try {
    const rows = await sql<{ plan: OperatingPlan }>`
      select plan
      from operating_plan_versions
      where status = 'published'
      order by published_at desc nulls last, created_at desc
      limit 1
    `;
    return rows[0]?.plan
      ? normalizeOperatingPlan(rows[0].plan)
      : DEFAULT_APPROVED_OPERATING_PLAN;
  } catch {
    // Migration 0023 may not yet exist in a fresh environment. Keep the repository baseline readable.
    return DEFAULT_APPROVED_OPERATING_PLAN;
  }
}

export const getProcurementPlanningReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireProcurementView();
  const sql = await getSql();
  const plan = await publishedOperatingPlan(sql);
  const summary = procurementSummary("base", plan);
  const actions = await sql`
    select id, scenario, plan_month, requirement_month, tranche_id, action_type, status, note, updated_at::text as updated_at
    from epr_procurement_plan_actions
    where scenario = 'base'
    order by requirement_month, plan_month, action_type
  `;
  const stock = await sql`
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
      case when free_quantity <= 0 then 'critical'
           when free_quantity <= minimum_stock_level then 'low'
           else 'ok' end as status
    from availability
    order by case when free_quantity <= 0 then 0 when free_quantity <= minimum_stock_level then 1 else 2 end,
      ledger_id, sku
  `;
  return { summary, forecast: summary.rows as ProcurementForecastRow[], actions, stock, plan };
});

export const setProcurementPlanningAction = createServerFn({ method: "POST" })
  .validator(
    (input: {
      planMonth: number;
      requirementMonth: number;
      trancheId?: string | null;
      actionType: "plan" | "rfq" | "approval" | "po" | "receipt" | "hold";
      status: "planned" | "in_progress" | "complete" | "on_hold" | "cancelled";
      note?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const role = await getCommandRole();
    if (!role || !canPerform(role, "edit"))
      throw new Error("Procurement planning edit permission denied.");
    const sql = await getSql();
    const id = `PPA-base-${data.planMonth}-${data.requirementMonth}-${data.actionType}`;
    await sql`
      insert into epr_procurement_plan_actions
        (id, scenario, plan_month, requirement_month, tranche_id, action_type, status, note, updated_at)
      values
        (${id}, 'base', ${data.planMonth}, ${data.requirementMonth}, ${data.trancheId ?? null}, ${data.actionType}, ${data.status}, ${data.note ?? ''}, now())
      on conflict (id) do update set
        status=excluded.status,
        note=excluded.note,
        tranche_id=excluded.tranche_id,
        updated_at=now()
    `;
    return { ok: true, id };
  });

export const getProcurementPlanningMethod = createServerFn({ method: "GET" }).handler(async () => {
  await requireProcurementView();
  return {
    planningLeadMonths: 2,
    horizonMonths: 36,
    principles: [
      "Time-phased material requirements are pegged to the Admin-published rolling 36-month operating plan.",
      "Confirmed configured orders consume free Master Inventory capacity before procurement shortages are calculated.",
      "MSL planning signals activate two months before the requirement month.",
      "Planning early does not pull cash forward: financial impact remains on the planned purchase/receipt month.",
      "Action status is separately recorded so management can distinguish a forecast signal from an executed procurement action.",
    ],
  };
});

void buildProcurementForecast;
