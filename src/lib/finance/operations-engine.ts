import type { FinanceAssumptions, MonthRow, ProductLineId } from "@/lib/finance/model";
import { bomBreakdown, bomTotalInr, type BomTier } from "@/lib/finance/bom-engine";

export type OperationsMonth = {
  m: number;
  units: number;
  aluminiumUnits: number;
  carbonUnits: number;
  premiumCarbonUnits: number;
  revenue: number;
  cogs: number;
  inventoryBuy: number;
  bomRequirementInr: number;
};

export type ComponentRequirement = {
  item: string;
  quantity: number;
  estimatedCostInr: number;
};

const tierFor = (id: ProductLineId, finance: FinanceAssumptions): BomTier =>
  (finance.bomTierByProduct?.[id] ?? (id === "aluminium" ? "core" : id === "carbon" ? "pro" : "apex")) as BomTier;

export function buildOperationsMonths(rows: MonthRow[], finance: FinanceAssumptions): OperationsMonth[] {
  const overrides = finance.bomOverrides ?? {};
  return rows.map((r) => {
    const unitsByProduct: Array<[ProductLineId, number]> = [
      ["aluminium", r.aluminiumUnits],
      ["carbon", r.carbonUnits],
      ["premiumCarbon", r.premiumCarbonUnits],
    ];
    const bomRequirementInr = unitsByProduct.reduce((sum, [id, units]) => sum + units * bomTotalInr(tierFor(id, finance), overrides), 0);
    return { m: r.m, units: r.units, aluminiumUnits: r.aluminiumUnits, carbonUnits: r.carbonUnits, premiumCarbonUnits: r.premiumCarbonUnits, revenue: r.revenue, cogs: r.cogs, inventoryBuy: r.inventoryBuy, bomRequirementInr };
  });
}

export function buildComponentRequirements(rows: MonthRow[], finance: FinanceAssumptions): ComponentRequirement[] {
  const overrides = finance.bomOverrides ?? {};
  const totals = new Map<string, ComponentRequirement>();
  const productUnits: Array<[ProductLineId, number]> = [
    ["aluminium", rows.reduce((s, r) => s + r.aluminiumUnits, 0)],
    ["carbon", rows.reduce((s, r) => s + r.carbonUnits, 0)],
    ["premiumCarbon", rows.reduce((s, r) => s + r.premiumCarbonUnits, 0)],
  ];
  for (const [id, units] of productUnits) {
    const tier = tierFor(id, finance);
    for (const line of bomBreakdown(tier, overrides)) {
      const current = totals.get(line.item) ?? { item: line.item, quantity: 0, estimatedCostInr: 0 };
      current.quantity += units * line.quantity;
      current.estimatedCostInr += units * line.extendedCostInr;
      totals.set(line.item, current);
    }
  }
  return [...totals.values()].sort((a, b) => b.estimatedCostInr - a.estimatedCostInr);
}

export function totalBomRequirementInr(rows: MonthRow[], finance: FinanceAssumptions) {
  return buildComponentRequirements(rows, finance).reduce((sum, r) => sum + r.estimatedCostInr, 0);
}
