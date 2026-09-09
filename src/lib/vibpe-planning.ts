import type { IntegratedPlanningResult } from "@/lib/integrated-business-planning-engine";

export type VibpeHorizonSummary = {
  horizonMonths: number;
  expectedUnits: number;
  recommendedProcurementLakh: number;
  minimumFreeLiquidityLakh: number;
  fundingNeedLakh: number;
  capacityShortfallMonths: number;
  shortageSkuMonths: number;
  firstLiquidityBreachPeriod?: number;
};

export function summarizeVibpeHorizon(result: IntegratedPlanningResult, requestedMonths: number): VibpeHorizonSummary {
  const horizonMonths = Math.max(1, Math.min(36, Math.trunc(requestedMonths || 6)));
  const demand = result.demand.filter((row) => row.period <= horizonMonths);
  const supply = result.supply.filter((row) => row.period <= horizonMonths);
  const capacity = result.capacity.filter((row) => row.period <= horizonMonths);
  const cash = result.cash.filter((row) => row.period <= horizonMonths);
  const minimumCash = [...cash].sort((a, b) => a.freeLiquidityAfterRecommendationsLakh - b.freeLiquidityAfterRecommendationsLakh)[0];
  const fundingNeedLakh = Math.max(0, -(minimumCash?.freeLiquidityAfterRecommendationsLakh ?? 0));
  const firstLiquidityBreachPeriod = cash.find((row) => row.freeLiquidityAfterRecommendationsLakh < 0)?.period;

  return {
    horizonMonths,
    expectedUnits: demand.reduce((sum, row) => sum + Number(row.expectedTotalQty || 0), 0),
    recommendedProcurementLakh: supply.reduce((sum, row) => sum + Number(row.purchaseCostLakh || 0), 0),
    minimumFreeLiquidityLakh: minimumCash?.freeLiquidityAfterRecommendationsLakh ?? 0,
    fundingNeedLakh,
    capacityShortfallMonths: capacity.filter((row) => row.shortfallUnits > 0).length,
    shortageSkuMonths: supply.filter((row) => row.committedFulfillmentShortageQty > 0).length,
    firstLiquidityBreachPeriod,
  };
}

export function explainVibpeHorizon(result: IntegratedPlanningResult, requestedMonths: number) {
  const summary = summarizeVibpeHorizon(result, requestedMonths);
  return [
    `Next ${summary.horizonMonths} months: ${summary.expectedUnits.toFixed(0)} expected units.`,
    `Recommended procurement: ₹${summary.recommendedProcurementLakh.toFixed(1)}L; shortage SKU-months: ${summary.shortageSkuMonths}.`,
    `Minimum free liquidity: ₹${summary.minimumFreeLiquidityLakh.toFixed(1)}L; horizon funding need: ₹${summary.fundingNeedLakh.toFixed(1)}L${summary.firstLiquidityBreachPeriod ? `; first breach M${summary.firstLiquidityBreachPeriod}` : ""}.`,
    `Capacity shortfall months: ${summary.capacityShortfallMonths}.`,
    "Controlled next action: review month-wise demand, material releases, supplier timing, capacity and cash gates before any transaction is approved.",
  ].join(" ");
}
