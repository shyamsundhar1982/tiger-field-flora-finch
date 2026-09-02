import {
  ASP_L,
  BREAKEVEN_EARLY,
  BREAKEVEN_SCALE,
  COGS_L,
  GM,
  buildModel,
  minCash,
  totals,
  type ScenarioId,
} from "@/lib/finance/model";

export const FINANCE_CONTROL = {
  planningAspLakh: ASP_L,
  planningCogsLakh: COGS_L,
  planningGrossMarginPct: GM,
  earlyBreakevenMonth: BREAKEVEN_EARLY,
  scaleBreakevenMonth: BREAKEVEN_SCALE,
  horizonMonths: 24,
  openingCashLakh: 1,
  fundingLadderLakh: [15, 50, 85, 135, 200],
  fundingStrategy: "Grants first; equity last; staged capital against evidence.",
} as const;

export const FINANCE_GATES = [
  { id: "F1", title: "Incorporation + banking", month: "M1", evidence: "Bank account and accounting controls" },
  { id: "F2", title: "Grant/application readiness", month: "M1–M3", evidence: "Eligible application pack + status register" },
  { id: "F3", title: "CAD / FEA capitalisation trigger", month: "M3–M4", evidence: "Controlled development record and board/management approval" },
  { id: "F4", title: "Prototype / validation funding", month: "M5–M9", evidence: "Prototype, lab and testing commitments" },
  { id: "F5", title: "Tooling + pilot funding", month: "M10–M12", evidence: "Frozen design + tooling/OEM commitments" },
  { id: "F6", title: "Launch working capital", month: "M12–M18", evidence: "Inventory, receivables and production plan" },
] as const;

export type ScenarioSnapshot = {
  id: ScenarioId;
  label: string;
  probability: string;
  revenueLakh: number;
  units: number;
  fundingLakh: number;
  opexLakh: number;
  ebitdaLakh: number;
  minimumCashLakh: number;
  minimumCashMonth: number;
};

export const SCENARIO_SNAPSHOTS: ScenarioSnapshot[] = (["base", "delayed", "stress"] as ScenarioId[]).map((id) => {
  const rows = buildModel(id, id !== "base");
  const t = totals(rows);
  const low = minCash(rows);
  const labels = { base: ["Base", "70%"], delayed: ["Delayed", "20%"], stress: ["Stress", "10%"] } as const;
  return {
    id,
    label: labels[id][0],
    probability: labels[id][1],
    revenueLakh: t.revenue,
    units: t.units,
    fundingLakh: t.funding,
    opexLakh: t.opex,
    ebitdaLakh: t.ebitda,
    minimumCashLakh: low.cash,
    minimumCashMonth: low.m,
  };
});

export const MONTHLY_CASH_PLAN = (["base", "delayed", "stress"] as ScenarioId[]).flatMap((scenario) =>
  buildModel(scenario, scenario !== "base").map((row) => ({
    scenario,
    month: row.m,
    units: row.units,
    revenueLakh: row.revenue,
    cogsLakh: row.cogs,
    opexLakh: row.opex,
    capexLakh: row.capex,
    inventoryBuyLakh: row.inventoryBuy,
    fundingLakh: row.funding,
    closingCashLakh: row.closing,
    inventoryLakh: row.inventory,
    developmentIaudLakh: row.iaud,
    toolingLakh: row.tooling,
  })),
);
