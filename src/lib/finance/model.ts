export type ScenarioId = "base" | "delayed" | "stress";

export const SCENARIOS: Record<ScenarioId, { label: string; probability: string; extra: number; note: string }> = {
  base: { label: "Base", probability: "70%", extra: 0, note: "Grants on time. Prototype succeeds first pass. Launch M12." },
  delayed: { label: "Delayed", probability: "20%", extra: 35, note: "Grants slip 4–6 months. One prototype iteration. Standby CN drawn." },
  stress: { label: "Stress", probability: "10%", extra: 90, note: "No grants. OEM +20%. Launch M18, Core-only. Bridge capital required." },
};

export type ProductLineId = "aluminium" | "carbon" | "premiumCarbon";
export type ProductLineAssumption = { id: ProductLineId; label: string; priceBand: string; aspLakh: number; cogsLakh: number; mixPct: number; launchMonth: number };

export const DEFAULT_PRODUCT_LINES: ProductLineAssumption[] = [
  { id: "aluminium", label: "VéLOXIS Aluminium", priceBand: "₹30k–₹50k", aspLakh: 0.4, cogsLakh: 0.25, mixPct: 10, launchMonth: 6 },
  { id: "carbon", label: "VéLOXIS Carbon", priceBand: "₹1L–₹1.5L", aspLakh: 1.55, cogsLakh: 1.13, mixPct: 70, launchMonth: 9 },
  { id: "premiumCarbon", label: "VéLOXIS Premium Carbon", priceBand: "₹2.5L+", aspLakh: 3.25, cogsLakh: 1.85, mixPct: 20, launchMonth: 15 },
];

const ASP = 1.775;
const COGS = 1.184;

function unitsFor(m: number, s: ScenarioId): number {
  if (s === "base") return [0,0,0,0,0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,8,8,10,10,12,12,14,14,16,16,18,18,20,20,22,22][m - 1] ?? 0;
  if (s === "delayed") return [0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,8,8,10,10,12,12,14,14,16,16,18,18][m - 1] ?? 0;
  return [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9][m - 1] ?? 0;
}

function opexFor(m: number, s: ScenarioId): number {
  if (s === "stress" && m < 18) { if (m <= 3) return 2.4; if (m <= 8) return 3.2; return 3.8; }
  if (m <= 3) return 2.8; if (m <= 8) return 4.2; if (m <= 11) return 6.0; if (m <= 14) return 7.8; return 9.2;
}
function fundingFor(m: number, s: ScenarioId, drawStandby: boolean): number {
  if (s === "base") { if (m === 1) return 15; if (m === 3) return 35; if (m === 6) return 35; if (m === 9 && drawStandby) return 25; if (m === 10) return 50; if (m === 14) return 65; return 0; }
  if (s === "delayed") { if (m === 1) return 15; if (m === 6) return 25; if (m === 7) return 35; if (m === 10) return 35; if (m === 12) return 50; if (m === 17) return 65; return 0; }
  if (m === 1) return 15; if (m === 3) return 20; if (m === 6) return 40; if (m === 10) return 50; if (m === 18) return 65; return 0;
}
function capexFor(m: number, s: ScenarioId): number {
  const delay = s === "delayed" ? 2 : s === "stress" ? 6 : 0; const t = m - delay;
  if (m === 3) return 4; if (t === 5) return 5; if (t === 6) return 6; if (t === 7) return 5.5; if (t === 8) return 4;
  if (m === 8 && s === "base") return 6;
  if ((s === "base" && m === 10) || (s === "delayed" && m === 12) || (s === "stress" && m === 16)) return 28;
  if (m === 5 && s === "base") return 3; return 0;
}
function inventoryBuy(m: number, s: ScenarioId, units: number, cogs: number): number {
  if (s === "base") { if (m === 8) return 2; if (m === 10) return 8; if (m === 11) return 10; if (m === 12) return 12; }
  if (s === "delayed") { if (m === 10) return 2; if (m === 12) return 8; if (m === 13) return 10; }
  if (s === "stress") { if (m === 16) return 2; if (m === 17) return 6; if (m === 18) return 8; }
  if (units > 0) return Math.max(0, units * cogs * 1.15 - units * cogs); return 0;
}

export type AluminiumVerticalAssumption = {
  volumeMultiplier: number;
  opexLakh: number;
  capexLakh: number;
  inventoryCover: number;
  openingCashLakh: number;
  fundingLakh: number;
  progressPct: number;
};

export type FinanceAssumptions = {
  productLines: ProductLineAssumption[];
  unitMultiplier: number;
  opexMultiplier: number;
  capexMultiplier: number;
  inventoryMultiplier: number;
  fundingMultiplier: number;
  openingCashLakh: number;
  aluminiumVertical: AluminiumVerticalAssumption;
};

export const DEFAULT_FINANCE_ASSUMPTIONS: FinanceAssumptions = {
  productLines: DEFAULT_PRODUCT_LINES,
  unitMultiplier: 1,
  opexMultiplier: 1,
  capexMultiplier: 1,
  inventoryMultiplier: 1,
  fundingMultiplier: 1,
  openingCashLakh: 1,
  aluminiumVertical: { volumeMultiplier: 1, opexLakh: 1.8, capexLakh: 24, inventoryCover: 1.15, openingCashLakh: 2, fundingLakh: 60, progressPct: 0 },
};

function allocateUnits(total: number, lines: ProductLineAssumption[], month: number): Record<ProductLineId, number> {
  const active = lines.filter((line) => month >= line.launchMonth && line.mixPct > 0);
  const result: Record<ProductLineId, number> = { aluminium: 0, carbon: 0, premiumCarbon: 0 };
  if (total <= 0 || active.length === 0) return result;
  const mixTotal = active.reduce((sum, line) => sum + line.mixPct, 0);
  const raw = active.map((line) => ({ line, exact: total * line.mixPct / mixTotal }));
  let assigned = 0;
  raw.forEach(({ line, exact }) => { const units = Math.floor(exact); result[line.id] = units; assigned += units; });
  raw.sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact))).slice(0, total - assigned).forEach(({ line }) => { result[line.id] += 1; });
  return result;
}

export type MonthRow = { m:number; units:number; aluminiumUnits:number; carbonUnits:number; premiumCarbonUnits:number; revenue:number; cogs:number; gp:number; opex:number; ebitda:number; capex:number; inventoryBuy:number; funding:number; opening:number; closing:number; inventory:number; iaud:number; tooling:number };

export function buildModelWithInputs(scenario: ScenarioId, drawStandby: boolean, assumptions: FinanceAssumptions = DEFAULT_FINANCE_ASSUMPTIONS): MonthRow[] {
  const lines = assumptions.productLines; const rows: MonthRow[] = [];
  let cash = assumptions.openingCashLakh + assumptions.aluminiumVertical.openingCashLakh;
  let inventory = 0; let iaud = 0; let tooling = 0;
  for (let m = 1; m <= 36; m++) {
    const baseUnits = Math.max(0, Math.round(unitsFor(m, scenario) * assumptions.unitMultiplier));
    const allocated = allocateUnits(baseUnits, lines, m);
    allocated.aluminium = Math.max(0, Math.round(allocated.aluminium * assumptions.aluminiumVertical.volumeMultiplier));
    const units = allocated.aluminium + allocated.carbon + allocated.premiumCarbon;
    const stressFactor = scenario === "stress" ? 1.2 : 1;
    const revenue = lines.reduce((sum, line) => sum + allocated[line.id] * line.aspLakh, 0);
    const cogs = lines.reduce((sum, line) => sum + allocated[line.id] * line.cogsLakh * stressFactor, 0);
    const nonAlUnits = allocated.carbon + allocated.premiumCarbon;
    const nonAlCogsPerUnit = nonAlUnits > 0 ? (allocated.carbon * (lines.find(x=>x.id === "carbon")?.cogsLakh ?? 0) + allocated.premiumCarbon * (lines.find(x=>x.id === "premiumCarbon")?.cogsLakh ?? 0)) / nonAlUnits * stressFactor : 0;
    const baseInv = inventoryBuy(m, scenario, nonAlUnits, nonAlCogsPerUnit) * assumptions.inventoryMultiplier;
    const alInv = m >= (lines.find(x=>x.id === "aluminium")?.launchMonth ?? 999) && allocated.aluminium > 0 ? allocated.aluminium * (lines.find(x=>x.id === "aluminium")?.cogsLakh ?? 0) * Math.max(0, assumptions.aluminiumVertical.inventoryCover - 1) * assumptions.inventoryMultiplier : 0;
    const invBuy = baseInv + alInv;
    const baseOpex = opexFor(m, scenario) * assumptions.opexMultiplier;
    const alOpex = m >= (lines.find(x=>x.id === "aluminium")?.launchMonth ?? 999) ? assumptions.aluminiumVertical.opexLakh : assumptions.aluminiumVertical.opexLakh * 0.35;
    const opex = baseOpex + alOpex;
    const grossProfit = revenue - cogs; const ebitda = grossProfit - opex;
    const baseCapex = capexFor(m, scenario) * assumptions.capexMultiplier;
    const alLaunch = m === (lines.find(x=>x.id === "aluminium")?.launchMonth ?? -1);
    const capex = baseCapex + (alLaunch ? assumptions.aluminiumVertical.capexLakh : 0);
    const baseFunding = fundingFor(m, scenario, drawStandby) * assumptions.fundingMultiplier;
    const funding = baseFunding + (alLaunch ? assumptions.aluminiumVertical.fundingLakh : 0);
    const opening = cash; cash = opening + funding + revenue - opex - capex - invBuy; inventory = Math.max(0, inventory + invBuy - cogs);
    if (m <= 8) iaud += capex * 0.7; if (capex >= 20) tooling += capex; else if (m >= 10) tooling += capex * 0.3;
    rows.push({ m, units, aluminiumUnits: allocated.aluminium, carbonUnits: allocated.carbon, premiumCarbonUnits: allocated.premiumCarbon, revenue, cogs, gp:grossProfit, opex, ebitda, capex, inventoryBuy:invBuy, funding, opening, closing:cash, inventory, iaud, tooling });
  }
  return rows;
}
export function buildModel(scenario: ScenarioId, drawStandby: boolean): MonthRow[] { return buildModelWithInputs(scenario, drawStandby, DEFAULT_FINANCE_ASSUMPTIONS); }
export function runwayMonths(rows: MonthRow[], from: number): number { const start=rows[from-1]; if(!start)return 0; let cash=start.closing,n=0; for(let i=from;i<rows.length;i++){const burn=rows[i].opex+rows[i].capex+rows[i].inventoryBuy-rows[i].revenue;if(burn<=0){n++;cash=rows[i].closing;continue;}if(cash<=0)break;const add=cash/burn;if(add<1){n+=add;break;}n++;cash=rows[i].closing;}return n; }
export function minCash(rows: MonthRow[]): {m:number;cash:number} { return rows.reduce((a,r)=>(r.closing<a.cash?{m:r.m,cash:r.closing}:a),{m:1,cash:rows[0]?.closing??0}); }
export function totals(rows: MonthRow[]) { return { revenue:rows.reduce((s,r)=>s+r.revenue,0), units:rows.reduce((s,r)=>s+r.units,0), funding:rows.reduce((s,r)=>s+r.funding,0), opex:rows.reduce((s,r)=>s+r.opex,0), ebitda:rows.reduce((s,r)=>s+r.ebitda,0) }; }
export const BREAKEVEN_EARLY=19; export const BREAKEVEN_SCALE=29; export const ASP_L=ASP; export const COGS_L=COGS; export const GM=((ASP-COGS)/ASP)*100;
