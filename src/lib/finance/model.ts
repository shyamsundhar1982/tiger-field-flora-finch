export type ScenarioId = "base" | "delayed" | "stress";

export const SCENARIOS: Record<
  ScenarioId,
  { label: string; probability: string; extra: number; note: string }
> = {
  base: {
    label: "Base",
    probability: "70%",
    extra: 0,
    note: "Grants on time. Prototype succeeds first pass. Launch M12.",
  },
  delayed: {
    label: "Delayed",
    probability: "20%",
    extra: 35,
    note: "Grants slip 4–6 months. One prototype iteration. Standby CN drawn.",
  },
  stress: {
    label: "Stress",
    probability: "10%",
    extra: 90,
    note: "No grants. OEM +20%. Launch M18, Core-only. Bridge capital required.",
  },
};

// Practical blended planning economics. All figures are ₹ lakh per bike.
// Planning mix remains 25% Core, 60% Pro, 15% Apex. These are management assumptions, not sales history.
const ASP = 1.775;
const COGS = 1.184;
const PLAN_COGS = 1.184;

// Conservative early-stage production ramp: 282 bikes over 36 months rather than assuming
// immediate high-volume scale. Change through the Finance Control assumption panel when evidence improves.
function unitsFor(m: number, s: ScenarioId): number {
  if (s === "base") {
    const ramp = [
      0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
      6, 6, 8, 8, 10, 10, 12, 12, 14, 14, 16, 16, 18, 18, 20, 20, 22, 22,
    ];
    return ramp[m - 1] ?? 0;
  }
  if (s === "delayed") {
    const ramp = [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3,
      4, 4, 5, 5, 6, 6, 8, 8, 10, 10, 12, 12, 14, 14, 16, 16, 18, 18,
    ];
    return ramp[m - 1] ?? 0;
  }
  const ramp = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9,
  ];
  return ramp[m - 1] ?? 0;
}

function opexFor(m: number, s: ScenarioId): number {
  if (s === "stress" && m < 18) {
    if (m <= 3) return 2.4;
    if (m <= 8) return 3.2;
    return 3.8;
  }
  if (m <= 3) return 2.8;
  if (m <= 8) return 4.2;
  if (m <= 11) return 6.0;
  if (m <= 14) return 7.8;
  return 9.2;
}

function fundingFor(m: number, s: ScenarioId, drawStandby: boolean): number {
  if (s === "base") {
    if (m === 1) return 15;
    if (m === 3) return 35;
    if (m === 6) return 35;
    if (m === 9 && drawStandby) return 25;
    if (m === 10) return 50;
    if (m === 14) return 65;
    return 0;
  }
  if (s === "delayed") {
    if (m === 1) return 15;
    if (m === 6) return 25;
    if (m === 7) return 35;
    if (m === 10) return 35;
    if (m === 12) return 50;
    if (m === 17) return 65;
    return 0;
  }
  if (m === 1) return 15;
  if (m === 3) return 20;
  if (m === 6) return 40;
  if (m === 10) return 50;
  if (m === 18) return 65;
  return 0;
}

function capexFor(m: number, s: ScenarioId): number {
  const delay = s === "delayed" ? 2 : s === "stress" ? 6 : 0;
  const t = m - delay;
  if (m === 3) return 4;
  if (t === 5) return 5;
  if (t === 6) return 6;
  if (t === 7) return 5.5;
  if (t === 8) return 4;
  if (m === 8 && s === "base") return 6;
  if ((s === "base" && m === 10) || (s === "delayed" && m === 12) || (s === "stress" && m === 16))
    return 28;
  if (m === 5 && s === "base") return 3;
  return 0;
}

function inventoryBuy(m: number, s: ScenarioId, units: number, cogs: number): number {
  if (s === "base") {
    if (m === 8) return 2;
    if (m === 10) return 8;
    if (m === 11) return 10;
    if (m === 12) return 12;
  }
  if (s === "delayed") {
    if (m === 10) return 2;
    if (m === 12) return 8;
    if (m === 13) return 10;
  }
  if (s === "stress") {
    if (m === 16) return 2;
    if (m === 17) return 6;
    if (m === 18) return 8;
  }
  if (units > 0) return Math.max(0, units * cogs * 1.15 - units * cogs);
  return 0;
}

export type FinanceAssumptions = {
  aspLakh: number;
  cogsLakh: number;
  unitMultiplier: number;
  opexMultiplier: number;
  capexMultiplier: number;
  inventoryMultiplier: number;
  fundingMultiplier: number;
  openingCashLakh: number;
};

export const DEFAULT_FINANCE_ASSUMPTIONS: FinanceAssumptions = {
  aspLakh: ASP,
  cogsLakh: COGS,
  unitMultiplier: 1,
  opexMultiplier: 1,
  capexMultiplier: 1,
  inventoryMultiplier: 1,
  fundingMultiplier: 1,
  openingCashLakh: 1,
};

export type MonthRow = {
  m: number;
  units: number;
  revenue: number;
  cogs: number;
  gp: number;
  opex: number;
  ebitda: number;
  capex: number;
  inventoryBuy: number;
  funding: number;
  opening: number;
  closing: number;
  inventory: number;
  iaud: number;
  tooling: number;
};

export function buildModelWithInputs(
  scenario: ScenarioId,
  drawStandby: boolean,
  assumptions: FinanceAssumptions = DEFAULT_FINANCE_ASSUMPTIONS,
): MonthRow[] {
  const cogsU = scenario === "stress" ? assumptions.cogsLakh * 1.2 : assumptions.cogsLakh;
  const rows: MonthRow[] = [];
  let cash = assumptions.openingCashLakh;
  let inventory = 0;
  let iaud = 0;
  let tooling = 0;

  for (let m = 1; m <= 36; m++) {
    const units = Math.max(0, Math.round(unitsFor(m, scenario) * assumptions.unitMultiplier));
    const revenue = units * assumptions.aspLakh;
    const cogs = units * cogsU;
    const gp = revenue - cogs;
    const opex = opexFor(m, scenario) * assumptions.opexMultiplier;
    const ebitda = gp - opex;
    const capex = capexFor(m, scenario) * assumptions.capexMultiplier;
    const invBuy = inventoryBuy(m, scenario, units, cogsU) * assumptions.inventoryMultiplier;
    const funding = fundingFor(m, scenario, drawStandby) * assumptions.fundingMultiplier;
    const opening = cash;
    cash = opening + funding + revenue - opex - capex - invBuy;
    inventory = Math.max(0, inventory + invBuy - cogs);
    if (m <= 8) iaud += capex * 0.7;
    if (capex >= 20) tooling += capex;
    else if (m >= 10) tooling += capex * 0.3;
    rows.push({
      m,
      units,
      revenue,
      cogs,
      gp,
      opex,
      ebitda,
      capex,
      inventoryBuy: invBuy,
      funding,
      opening,
      closing: cash,
      inventory,
      iaud,
      tooling,
    });
  }
  return rows;
}

export function buildModel(scenario: ScenarioId, drawStandby: boolean): MonthRow[] {
  return buildModelWithInputs(scenario, drawStandby, DEFAULT_FINANCE_ASSUMPTIONS);
}

export function runwayMonths(rows: MonthRow[], from: number): number {
  const start = rows[from - 1];
  if (!start) return 0;
  let cash = start.closing;
  let n = 0;
  for (let i = from; i < rows.length; i++) {
    const burn = rows[i].opex + rows[i].capex + rows[i].inventoryBuy - rows[i].revenue;
    if (burn <= 0) {
      n += 1;
      cash = rows[i].closing;
      continue;
    }
    if (cash <= 0) break;
    const add = cash / burn;
    if (add < 1) {
      n += add;
      break;
    }
    n += 1;
    cash = rows[i].closing;
  }
  return n;
}

export function minCash(rows: MonthRow[]): { m: number; cash: number } {
  return rows.reduce((a, r) => (r.closing < a.cash ? { m: r.m, cash: r.closing } : a), {
    m: 1,
    cash: rows[0]?.closing ?? 0,
  });
}

export function totals(rows: MonthRow[]) {
  return {
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
    units: rows.reduce((s, r) => s + r.units, 0),
    funding: rows.reduce((s, r) => s + r.funding, 0),
    opex: rows.reduce((s, r) => s + r.opex, 0),
    ebitda: rows.reduce((s, r) => s + r.ebitda, 0),
  };
}

export const BREAKEVEN_EARLY = 19;
export const BREAKEVEN_SCALE = 29;
export const ASP_L = ASP;
export const COGS_L = COGS;
export const GM = ((ASP - COGS) / ASP) * 100;
