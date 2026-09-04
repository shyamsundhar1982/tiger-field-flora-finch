import { buildModelWithInputs, type FinanceAssumptions, type MonthRow, type ScenarioId } from "@/lib/finance/model";
import { buildVentureFinancialModel } from "@/lib/finance/venture-finance";

export type VentureScope = "consolidated" | "carbon" | "aluminium";
export const VENTURE_SCOPES: VentureScope[] = ["consolidated", "carbon", "aluminium"];
export const VENTURE_LABELS: Record<VentureScope, string> = { consolidated: "Consolidated", carbon: "Vyndi · Carbon", aluminium: "Aluminium Venture" };
export const VENTURE_OWNERS: Record<VentureScope, string> = { consolidated: "Vayu Shastr", carbon: "Vyndi", aluminium: "Aluminium Venture" };

export function buildScopedRows(scope: VentureScope, scenario: ScenarioId, drawStandby: boolean, finance: FinanceAssumptions): MonthRow[] {
  if (scope === "consolidated") return buildModelWithInputs(scenario, drawStandby, finance);
  return buildVentureFinancialModel(scenario, drawStandby, finance)[scope];
}

export function scopedProductLines(finance: FinanceAssumptions, scope: VentureScope): FinanceAssumptions {
  if (scope === "consolidated") return finance;
  const productLines = finance.productLines.filter((line) => scope === "aluminium" ? line.venture === "aluminium" : line.venture === "carbon");
  return { ...finance, productLines };
}
