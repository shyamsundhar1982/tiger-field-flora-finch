import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";
import { buildProcurementForecast, procurementSummary, type ProcurementForecastRow } from "@/lib/data/procurement-planning";
import type { ScenarioId } from "@/lib/finance/model";

async function requireProcurementView() {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Procurement view permission denied.");
}

export const getProcurementPlanningReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireProcurementView();
  const sql = await getSql();
  const summary = procurementSummary("base");
  const actions = await sql`
    select id, scenario, plan_month, requirement_month, tranche_id, action_type, status, note, updated_at::text as updated_at
    from epr_procurement_plan_actions
    where scenario = 'base'
    order by requirement_month, plan_month, action_type
  `;
  const stock = await sql`
    select c.venture, c.sku, c.unit, c.minimum_stock_level, c.reorder_quantity, c.lead_time_days,
      coalesce(b.quantity_balance, 0) as quantity_balance,
      greatest(c.minimum_stock_level - coalesce(b.quantity_balance, 0), 0) as shortage_quantity,
      case when coalesce(b.quantity_balance, 0) <= 0 then 'critical'
           when coalesce(b.quantity_balance, 0) <= c.minimum_stock_level then 'low'
           else 'ok' end as status
    from epr_inventory_controls c
    left join epr_authoritative_inventory_balance b
      on b.venture=c.venture and b.sku=c.sku and b.unit=c.unit
    where c.active=true
    order by case when coalesce(b.quantity_balance,0)<=0 then 0 when coalesce(b.quantity_balance,0)<=c.minimum_stock_level then 1 else 2 end,
      c.venture, c.sku
  `;
  return { summary, forecast: summary.rows as ProcurementForecastRow[], actions, stock };
});

export const setProcurementPlanningAction = createServerFn({ method: "POST" })
  .validator((input: { planMonth: number; requirementMonth: number; trancheId?: string | null; actionType: "plan" | "rfq" | "approval" | "po" | "receipt" | "hold"; status: "planned" | "in_progress" | "complete" | "on_hold" | "cancelled"; note?: string }) => input)
  .handler(async ({ data }) => {
    const role = await getCommandRole();
    if (!role || !canPerform(role, "edit")) throw new Error("Procurement planning edit permission denied.");
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
      "Time-phased material requirements are pegged to the 36-month production plan.",
      "MSL planning signals activate two months before the requirement month.",
      "Planning early does not pull cash forward: financial impact remains on the planned purchase/receipt month.",
      "Action status is separately recorded so management can distinguish a forecast signal from an executed procurement action.",
    ],
  };
});

void buildProcurementForecast;
