import type { AccountingRow } from "@/lib/finance/accounting";
import type { PeopleOpexMonth } from "@/lib/finance/people-opex-engine";

export type BoardStatus = "ahead" | "on-track" | "watch" | "critical";

export type BoardKpi = {
  label: string;
  value: number;
  plan: number;
  variancePct: number;
  status: BoardStatus;
};

export type BoardRisk = {
  id: string;
  title: string;
  impact: string;
  owner: string;
  status: "open" | "mitigating" | "closed";
};

export const DEFAULT_BOARD_RISKS: BoardRisk[] = [
  { id: "R1", title: "Cash runway / funding timing", impact: "Liquidity", owner: "Founder", status: "mitigating" },
  { id: "R2", title: "Production ramp vs demand", impact: "Revenue / inventory", owner: "Operations", status: "open" },
  { id: "R3", title: "Engineering revision cost drift", impact: "COGS / margin", owner: "Engineering", status: "open" },
  { id: "R4", title: "Compliance evidence readiness", impact: "Tax / governance", owner: "Finance", status: "mitigating" },
];

const pct = (value: number, plan: number) => plan === 0 ? 0 : ((value - plan) / Math.abs(plan)) * 100;
const status = (variancePct: number, favorable: "higher" | "lower" = "higher"): BoardStatus => {
  const v = favorable === "higher" ? variancePct : -variancePct;
  if (v >= 10) return "ahead";
  if (v >= -5) return "on-track";
  if (v >= -15) return "watch";
  return "critical";
};

export function buildBoardKpis(accounting: AccountingRow[], planAccounting: AccountingRow[], people: PeopleOpexMonth[]): BoardKpi[] {
  const current = accounting.at(-1)!;
  const plan = planAccounting.at(-1)!;
  const revenueVariance = pct(current.revenue, plan.revenue);
  const grossMargin = current.revenue ? (current.grossProfit / current.revenue) * 100 : 0;
  const planGrossMargin = plan.revenue ? (plan.grossProfit / plan.revenue) * 100 : 0;
  const cashVariance = pct(current.closingCash, plan.closingCash);
  const burn = Math.max(0, current.opex - current.grossProfit);
  const planBurn = Math.max(0, plan.opex - plan.grossProfit);
  const headcount = people.at(-1)?.headcount ?? 0;
  const planHeadcount = people.at(-1)?.headcount ?? 0;
  return [
    { label: "M36 revenue", value: current.revenue, plan: plan.revenue, variancePct: revenueVariance, status: status(revenueVariance) },
    { label: "Gross margin %", value: grossMargin, plan: planGrossMargin, variancePct: grossMargin - planGrossMargin, status: status(grossMargin - planGrossMargin) },
    { label: "Closing cash", value: current.closingCash, plan: plan.closingCash, variancePct: cashVariance, status: status(cashVariance) },
    { label: "Net operating burn", value: burn, plan: planBurn, variancePct: pct(burn, planBurn), status: status(pct(burn, planBurn), "lower") },
    { label: "Headcount", value: headcount, plan: planHeadcount, variancePct: pct(headcount, planHeadcount), status: status(pct(headcount, planHeadcount), "lower") },
  ];
}

export function boardSummary(accounting: AccountingRow[], planAccounting: AccountingRow[]) {
  const trough = accounting.reduce((min, row) => row.closingCash < min.closingCash ? row : min, accounting[0]);
  const planTrough = planAccounting.reduce((min, row) => row.closingCash < min.closingCash ? row : min, planAccounting[0]);
  const breakEven = accounting.find((row) => row.ebitda >= 0)?.m ?? null;
  const runway = accounting.findIndex((row) => row.closingCash < 0);
  return {
    cashTrough: trough.closingCash,
    cashTroughMonth: trough.m,
    planCashTrough: planTrough.closingCash,
    breakEven,
    runway: runway < 0 ? accounting.length : runway,
    funding: accounting.reduce((sum, row) => sum + row.equityFunding + row.debtDraw + row.grantFunding, 0),
  };
}
