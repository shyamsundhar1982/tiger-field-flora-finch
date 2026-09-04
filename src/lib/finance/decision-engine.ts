import { buildAccountingModel, accountingTotals, type AccountingAssumptions } from "@/lib/finance/accounting";
import { buildModelWithInputs, type FinanceAssumptions, type ScenarioId } from "@/lib/finance/model";

export type DecisionScenarioId = "base" | "upside" | "downside" | "stress" | "custom";
export type DecisionOverrides = { aspPct: number; cogsPct: number; unitPct: number; launchShift: number; opexPct: number; collectionDaysDelta: number; supplierDaysDelta: number; aluminiumVolumePct: number };
export type DecisionScenario = { id: DecisionScenarioId; label: string; description: string; overrides: DecisionOverrides };
export type DecisionStatus = "proceed" | "watch" | "funding" | "stop";
export type DecisionRecord = { id: string; createdAt: string; scenarioId: DecisionScenarioId; scenarioLabel: string; overrides: DecisionOverrides; status: DecisionStatus; recommendation: string; cashTrough: number; cashTroughMonth: number; runway: number; fundingGap: number; breakEvenMonth: number | null; note: string };
export type DecisionResult = {
  scenario: DecisionScenario;
  rows: ReturnType<typeof buildModelWithInputs>;
  accounting: ReturnType<typeof buildAccountingModel>;
  revenue: number; units: number; grossProfit: number; ebitda: number; closingCash: number;
  cashTrough: number; cashTroughMonth: number; runway: number; funding: number; fundingGap: number; breakEvenMonth: number | null;
};

export const DEFAULT_DECISION_OVERRIDES: Record<Exclude<DecisionScenarioId, "custom">, DecisionOverrides> = {
  base: { aspPct: 0, cogsPct: 0, unitPct: 0, launchShift: 0, opexPct: 0, collectionDaysDelta: 0, supplierDaysDelta: 0, aluminiumVolumePct: 0 },
  upside: { aspPct: 8, cogsPct: -4, unitPct: 25, launchShift: -1, opexPct: 4, collectionDaysDelta: -10, supplierDaysDelta: 5, aluminiumVolumePct: 20 },
  downside: { aspPct: -7, cogsPct: 8, unitPct: -20, launchShift: 2, opexPct: 10, collectionDaysDelta: 15, supplierDaysDelta: -10, aluminiumVolumePct: -15 },
  stress: { aspPct: -12, cogsPct: 20, unitPct: -35, launchShift: 4, opexPct: 18, collectionDaysDelta: 30, supplierDaysDelta: -15, aluminiumVolumePct: -30 },
};
export const DECISION_SCENARIOS: DecisionScenario[] = [
  { id: "base", label: "Base", description: "Approved operating plan with no decision shock.", overrides: DEFAULT_DECISION_OVERRIDES.base },
  { id: "upside", label: "Upside", description: "Faster ramp, stronger ASP and modest cost improvement.", overrides: DEFAULT_DECISION_OVERRIDES.upside },
  { id: "downside", label: "Downside", description: "Slower demand, cost pressure and launch slippage.", overrides: DEFAULT_DECISION_OVERRIDES.downside },
  { id: "stress", label: "Stress", description: "Severe commercial, cost and working-capital pressure.", overrides: DEFAULT_DECISION_OVERRIDES.stress },
];

function clampPct(value: number) { return Math.max(-90, Math.min(200, value)); }
export function applyDecisionOverrides(finance: FinanceAssumptions, overrides: DecisionOverrides): FinanceAssumptions {
  const productLines = finance.productLines.map((line) => ({ ...line, aspLakh: Math.max(0, line.aspLakh * (1 + clampPct(overrides.aspPct) / 100)), cogsLakh: Math.max(0, line.cogsLakh * (1 + clampPct(overrides.cogsPct) / 100)), launchMonth: Math.max(1, Math.min(36, Math.round(line.launchMonth + overrides.launchShift))) }));
  return { ...finance, productLines, unitMultiplier: Math.max(0, finance.unitMultiplier * (1 + clampPct(overrides.unitPct) / 100)), opexMultiplier: Math.max(0, finance.opexMultiplier * (1 + clampPct(overrides.opexPct) / 100)), aluminiumVertical: { ...finance.aluminiumVertical, volumeMultiplier: Math.max(0, finance.aluminiumVertical.volumeMultiplier * (1 + clampPct(overrides.aluminiumVolumePct) / 100)) } };
}
export function applyAccountingOverrides(accounting: AccountingAssumptions, overrides: DecisionOverrides): AccountingAssumptions {
  return { ...accounting, collectionDays: Math.max(0, (accounting.collectionDays ?? accounting.collectionMonths * 30) + overrides.collectionDaysDelta), supplierPaymentDays: Math.max(0, (accounting.supplierPaymentDays ?? accounting.supplierCreditMonths * 30) + overrides.supplierDaysDelta) };
}
export function buildDecisionResult(scenario: DecisionScenario, finance: FinanceAssumptions, accounting: AccountingAssumptions, drawStandby: boolean): DecisionResult {
  const effectiveFinance = applyDecisionOverrides(finance, scenario.overrides);
  const effectiveAccounting = applyAccountingOverrides(accounting, scenario.overrides);
  const planningScenario: ScenarioId = scenario.id === "stress" ? "stress" : scenario.id === "downside" ? "delayed" : "base";
  const rows = buildModelWithInputs(planningScenario, drawStandby, effectiveFinance);
  const acc = buildAccountingModel(rows, effectiveAccounting);
  const t = accountingTotals(acc);
  const cashValues = acc.map((r) => r.closingCash);
  const troughCash = Math.min(...cashValues);
  const troughIndex = cashValues.indexOf(troughCash);
  const firstNegative = acc.findIndex((r) => r.closingCash < 0);
  const runway = firstNegative >= 0 ? firstNegative : 36;
  const breakEvenIndex = acc.findIndex((r) => r.ebitda > 0);
  const managementFloor = Math.max(0, finance.managementCashFloorLakh ?? 15);
  return {
    scenario, rows, accounting: acc, revenue: t.revenue, units: rows.reduce((s, r) => s + r.units, 0), grossProfit: t.grossProfit, ebitda: t.ebitda,
    closingCash: acc.at(-1)?.closingCash ?? 0, cashTrough: troughCash, cashTroughMonth: troughIndex + 1, runway, funding: t.funding,
    fundingGap: Math.max(0, managementFloor - troughCash), breakEvenMonth: breakEvenIndex >= 0 ? breakEvenIndex + 1 : null,
  };
}
export function decisionStatus(result: DecisionResult, base: DecisionResult): DecisionStatus {
  if (result.cashTrough < 0 || result.runway < 6) return "stop";
  if (result.fundingGap > 0 || result.cashTrough < base.cashTrough - 10) return "funding";
  if (result.cashTrough < base.cashTrough - 5 || result.runway < 12) return "watch";
  return "proceed";
}
export function decisionRecommendation(result: DecisionResult, base: DecisionResult): string {
  const status = decisionStatus(result, base);
  if (status === "stop") return "Stop or correct the operating plan before proceeding: cash falls below zero or runway is under six months.";
  if (status === "funding") return `Proceed only with a cash gate and funding plan. The modeled management-floor gap is ${result.fundingGap.toFixed(1)}L.`;
  if (status === "watch") return "Proceed with a management watch list and monthly variance review.";
  return "Proceed within the controlled plan; keep the assumptions under review.";
}
function sensitivityLabel(field: keyof DecisionOverrides, delta: number) {
  const sign = delta > 0 ? "+" : "";
  if (field === "launchShift") return `${sign}${delta} mo`;
  if (field === "collectionDaysDelta") return `${sign}${delta} days`;
  if (field === "supplierDaysDelta") return `${sign}${delta} days`;
  return `${sign}${delta}%`;
}
export function sensitivity(finance: FinanceAssumptions, accounting: AccountingAssumptions, drawStandby: boolean, field: keyof DecisionOverrides, deltas = [-10, -5, 5, 10]) {
  return deltas.map((delta) => buildDecisionResult({ id: "custom", label: sensitivityLabel(field, delta), description: `Sensitivity: ${String(field)}`, overrides: { ...DEFAULT_DECISION_OVERRIDES.base, [field]: delta } }, finance, accounting, drawStandby));
}
export function fullSensitivity(finance: FinanceAssumptions, accounting: AccountingAssumptions, drawStandby: boolean) {
  return (Object.keys(DEFAULT_DECISION_OVERRIDES.base) as (keyof DecisionOverrides)[]).map((field) => ({ field, results: sensitivity(finance, accounting, drawStandby, field) }));
}
