import { buildModel, type ScenarioId } from "@/lib/finance/model";
import { MIX } from "@/lib/data/bom";
import { TRANCHES } from "@/lib/data/company";

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

export function trancheForMonth(month: number) {
  const direct = TRANCHES.find((x) => x.month === month);
  if (direct) return direct;
  const previous = [...TRANCHES].filter((x) => x.month <= month).sort((a, b) => b.month - a.month)[0];
  return previous ?? TRANCHES[0];
}

export function buildProcurementForecast(scenario: ScenarioId = "base"): ProcurementForecastRow[] {
  const rows = buildModel(scenario, false);
  return rows.map((row) => {
    const procurement = Number(row.inventoryBuy.toFixed(2));
    const active = row.units > 0 || procurement > 0;
    const planningMonth = Math.max(1, row.m - MSL_PLANNING_LEAD_MONTHS);
    const tranche = trancheForMonth(row.m);
    const trigger = procurement > 0 ? "MSL-2M" : active ? "scheduled" : "none";
    return {
      month: row.m,
      requirementMonth: row.m,
      planningMonth,
      tranche: tranche.id,
      trancheName: tranche.name,
      units: row.units,
      coreUnits: Math.round(row.units * MIX.core),
      proUnits: Math.round(row.units * MIX.pro),
      apexUnits: Math.max(0, row.units - Math.round(row.units * MIX.core) - Math.round(row.units * MIX.pro)),
      procurementLakh: procurement,
      financialImpactMonth: row.m,
      trigger,
      status: procurement > 0 ? "planned" : active ? "watch" : "no-buy",
    };
  });
}

export function procurementSummary(scenario: ScenarioId = "base") {
  const rows = buildProcurementForecast(scenario);
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
