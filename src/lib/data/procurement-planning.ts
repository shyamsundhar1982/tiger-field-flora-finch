import {
  buildModelWithInputs,
  DEFAULT_FINANCE_ASSUMPTIONS,
  type ScenarioId,
} from "@/lib/finance/model";
import { TRANCHES } from "@/lib/data/company";
import {
  DEFAULT_APPROVED_OPERATING_PLAN,
  fundingGateMonth,
  type OperatingPlan,
} from "@/lib/planning/operating-plan";

export const PROCUREMENT_PLANNING_HORIZON = 36;
export const MSL_PLANNING_LEAD_MONTHS = 2;

export type ProcurementForecastRow = {
  month: number;
  requirementMonth: number;
  planningMonth: number;
  tranche: string;
  trancheName: string;
  units: number;
  coreUnits: number;
  proUnits: number;
  apexUnits: number;
  procurementLakh: number;
  financialImpactMonth: number;
  trigger: "MSL-2M" | "scheduled" | "none";
  status: "planned" | "watch" | "no-buy";
};

export function trancheForMonth(
  month: number,
  plan: OperatingPlan = DEFAULT_APPROVED_OPERATING_PLAN,
  scenario: ScenarioId = "base",
) {
  const scheduled = TRANCHES.map((tranche) => ({
    ...tranche,
    effectiveMonth: fundingGateMonth(plan, tranche.id, scenario),
  })).filter((tranche) => tranche.effectiveMonth > 0);

  const direct = scheduled.find((tranche) => tranche.effectiveMonth === month);
  if (direct) return direct;

  const previous = scheduled
    .filter((tranche) => tranche.effectiveMonth <= month)
    .sort((left, right) => right.effectiveMonth - left.effectiveMonth)[0];
  if (previous) return previous;

  const upcoming = scheduled
    .filter((tranche) => tranche.effectiveMonth > month)
    .sort((left, right) => left.effectiveMonth - right.effectiveMonth)[0];
  if (upcoming) return upcoming;

  return {
    id: "OPER",
    name: "Operating cash",
    amount: 0,
    month,
    deliverable: "Post-funding-ladder operating procurement",
    effectiveMonth: month,
  };
}

export function buildProcurementForecast(
  scenario: ScenarioId = "base",
  plan: OperatingPlan = DEFAULT_APPROVED_OPERATING_PLAN,
): ProcurementForecastRow[] {
  const rows = buildModelWithInputs(scenario, false, {
    ...DEFAULT_FINANCE_ASSUMPTIONS,
    operatingPlan: plan,
  });

  return rows.map((row) => {
    const procurement = Number(row.inventoryBuy.toFixed(2));
    const active = row.units > 0 || procurement > 0;
    const planningMonth = Math.max(1, row.m - MSL_PLANNING_LEAD_MONTHS);
    const tranche = trancheForMonth(row.m, plan, scenario);
    const trigger = procurement > 0 ? "MSL-2M" : active ? "scheduled" : "none";
    return {
      month: row.m,
      requirementMonth: row.m,
      planningMonth,
      tranche: tranche.id,
      trancheName: tranche.name,
      units: row.units,
      // Keep field names for route compatibility; values are canonical VINDY model allocations.
      coreUnits: row.aluminiumUnits,
      proUnits: row.carbonUnits,
      apexUnits: row.premiumCarbonUnits,
      procurementLakh: procurement,
      financialImpactMonth: row.m,
      trigger,
      status: procurement > 0 ? "planned" : active ? "watch" : "no-buy",
    };
  });
}

export function procurementSummary(
  scenario: ScenarioId = "base",
  plan: OperatingPlan = DEFAULT_APPROVED_OPERATING_PLAN,
) {
  const rows = buildProcurementForecast(scenario, plan);
  return {
    scenario,
    horizonMonths: PROCUREMENT_PLANNING_HORIZON,
    planningLeadMonths: MSL_PLANNING_LEAD_MONTHS,
    totalProcurementLakh: rows.reduce((sum, row) => sum + row.procurementLakh, 0),
    procurementMonths: rows.filter((row) => row.procurementLakh > 0).length,
    firstPlanningMonth: rows.find((row) => row.procurementLakh > 0)?.planningMonth ?? null,
    rows,
  };
}
