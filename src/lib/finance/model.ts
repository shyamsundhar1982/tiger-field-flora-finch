import {
  bomTotalLakh,
  type BomCostSource,
  type BomOverrides,
  type BomTier,
} from "@/lib/finance/bom-engine";
import {
  DEFAULT_EQUIPMENT_LEDGER,
  DEFAULT_EQUIPMENT_LEDGER_CATEGORIES,
  equipmentCapexForMonth,
  equipmentConsumablesForMonth,
  equipmentDirectManufacturingDepreciationForMonth,
  equipmentManufacturingSupportDepreciationForMonth,
  equipmentOfficeConsumablesForMonth,
  equipmentOfficeDepreciationForMonth,
  type EquipmentLedgerCategory,
  type EquipmentLedgerItem,
} from "@/lib/finance/equipment-ledger";
import { TIERS, TRANCHES } from "@/lib/data/company";
import {
  DEFAULT_APPROVED_OPERATING_PLAN,
  effectiveMilestoneMonth,
  effectiveProductLaunchMonth,
  fundingGateMonth,
  normalizeOperatingPlan,
  unitsForPlanMonth,
  type OperatingPlan,
  type OperatingPlanProductId,
} from "@/lib/planning/operating-plan";

export type ScenarioId = "base" | "delayed" | "stress";

export const SCENARIOS: Record<
  ScenarioId,
  { label: string; probability: string; extra: number; note: string }
> = {
  base: {
    label: "Base",
    probability: "70%",
    extra: 0,
    note: "Uses the currently approved rolling operating plan and its published launch timing.",
  },
  delayed: {
    label: "Delayed",
    probability: "20%",
    extra: 35,
    note: "Applies a three-month execution delay and an 80% demand factor to the approved plan.",
  },
  stress: {
    label: "Stress",
    probability: "10%",
    extra: 90,
    note: "Applies a six-month delay, a 45% demand factor and higher OEM cost pressure.",
  },
};

/**
 * ProductLineId values are retained for persisted-state compatibility.
 * Commercial truth is VINDY Longitude / Latitude / Altitude through the mapping below.
 */
export type ProductLineId = "aluminium" | "carbon" | "premiumCarbon";
export type ProductLineAssumption = {
  id: ProductLineId;
  label: string;
  priceBand: string;
  aspLakh: number;
  cogsLakh: number;
  mixPct: number;
  /** @deprecated Launch timing is controlled by OperatingPlan.productLaunchMonths. */
  launchMonth: number;
};

export const PLAN_PRODUCT_BY_FINANCE_ID: Record<ProductLineId, OperatingPlanProductId> = {
  aluminium: "longitude",
  carbon: "latitude",
  premiumCarbon: "altitude",
};

const longitude = TIERS.find((tier) => tier.id === "core")!;
const latitude = TIERS.find((tier) => tier.id === "pro")!;
const altitude = TIERS.find((tier) => tier.id === "apex")!;

export const DEFAULT_PRODUCT_LINES: ProductLineAssumption[] = [
  {
    id: "aluminium",
    label: longitude.name,
    priceBand: `₹${(longitude.asp / 100000).toFixed(2)}L ASP`,
    aspLakh: longitude.asp / 100000,
    cogsLakh: longitude.cogs / 100000,
    mixPct: 20,
    launchMonth: DEFAULT_APPROVED_OPERATING_PLAN.productLaunchMonths.longitude,
  },
  {
    id: "carbon",
    label: latitude.name,
    priceBand: `₹${(latitude.asp / 100000).toFixed(2)}L ASP`,
    aspLakh: latitude.asp / 100000,
    cogsLakh: latitude.cogs / 100000,
    mixPct: 60,
    launchMonth: DEFAULT_APPROVED_OPERATING_PLAN.productLaunchMonths.latitude,
  },
  {
    id: "premiumCarbon",
    label: altitude.name,
    priceBand: `₹${(altitude.asp / 100000).toFixed(2)}L ASP`,
    aspLakh: altitude.asp / 100000,
    cogsLakh: altitude.cogs / 100000,
    mixPct: 20,
    launchMonth: DEFAULT_APPROVED_OPERATING_PLAN.productLaunchMonths.altitude,
  },
];

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
  /** @deprecated Approved demand scale is owned by operatingPlan.demandScale. */
  unitMultiplier: number;
  opexMultiplier: number;
  capexMultiplier: number;
  inventoryMultiplier: number;
  fundingMultiplier: number;
  openingCashLakh: number;
  operatingPlan?: OperatingPlan;
  /** Legacy compatibility only; no default separate aluminium investment case is funded. */
  aluminiumVertical: AluminiumVerticalAssumption;
  bomOverrides?: BomOverrides;
  bomCostSource?: Partial<Record<ProductLineId, BomCostSource>>;
  bomTierByProduct?: Partial<Record<ProductLineId, BomTier>>;
  equipmentLedger?: EquipmentLedgerItem[];
  equipmentLedgerCategories?: EquipmentLedgerCategory[];
};

export const DEFAULT_FINANCE_ASSUMPTIONS: FinanceAssumptions = {
  productLines: DEFAULT_PRODUCT_LINES,
  unitMultiplier: 1,
  opexMultiplier: 1,
  capexMultiplier: 1,
  inventoryMultiplier: 1,
  fundingMultiplier: 1,
  openingCashLakh: 1,
  operatingPlan: DEFAULT_APPROVED_OPERATING_PLAN,
  aluminiumVertical: {
    volumeMultiplier: 1,
    opexLakh: 0,
    capexLakh: 0,
    inventoryCover: 1.15,
    openingCashLakh: 0,
    fundingLakh: 0,
    progressPct: 0,
  },
  bomOverrides: {},
  bomCostSource: { aluminium: "manual", carbon: "manual", premiumCarbon: "manual" },
  bomTierByProduct: { aluminium: "core", carbon: "pro", premiumCarbon: "apex" },
  equipmentLedger: DEFAULT_EQUIPMENT_LEDGER,
  equipmentLedgerCategories: DEFAULT_EQUIPMENT_LEDGER_CATEGORIES,
};

function allocateUnits(
  total: number,
  lines: ProductLineAssumption[],
  month: number,
  plan: OperatingPlan,
  scenario: ScenarioId,
) {
  const active = lines.filter(
    (line) =>
      month >= effectiveProductLaunchMonth(plan, PLAN_PRODUCT_BY_FINANCE_ID[line.id], scenario) &&
      line.mixPct > 0,
  );
  const result: Record<ProductLineId, number> = { aluminium: 0, carbon: 0, premiumCarbon: 0 };
  if (total <= 0 || !active.length) return result;
  const mix = active.reduce((sum, line) => sum + line.mixPct, 0);
  const raw = active.map((line) => ({ line, exact: (total * line.mixPct) / mix }));
  let assigned = 0;
  raw.forEach(({ line, exact }) => {
    const units = Math.floor(exact);
    result[line.id] = units;
    assigned += units;
  });
  raw
    .sort(
      (left, right) =>
        right.exact - Math.floor(right.exact) - (left.exact - Math.floor(left.exact)),
    )
    .slice(0, total - assigned)
    .forEach(({ line }) => result[line.id]++);
  return result;
}

function opexFor(month: number, scenario: ScenarioId, plan: OperatingPlan) {
  const launch = effectiveMilestoneMonth(plan, "commercialLaunch", scenario);
  const relative = month - launch;
  let base = 9.2;
  if (relative <= -11) base = 2.8;
  else if (relative <= -6) base = 4.2;
  else if (relative <= -3) base = 6;
  else if (relative <= 0) base = 7.8;
  return scenario === "stress" && month < launch ? base * 0.85 : base;
}

function fundingFor(
  month: number,
  scenario: ScenarioId,
  drawStandby: boolean,
  plan: OperatingPlan,
) {
  return TRANCHES.filter((tranche) => tranche.id !== "STBY" || drawStandby)
    .filter((tranche) => fundingGateMonth(plan, tranche.id, scenario) === month)
    .reduce((sum, tranche) => sum + tranche.amount, 0);
}

function capexFor(month: number, scenario: ScenarioId, plan: OperatingPlan) {
  const launch = effectiveMilestoneMonth(plan, "commercialLaunch", scenario);
  const shift = launch - 14;
  const events = [
    { month: 3, amount: 4 },
    { month: 5, amount: 8 },
    { month: 6, amount: 6 },
    { month: 7, amount: 5.5 },
    { month: 8, amount: 10 },
    { month: 10, amount: 28 },
  ];
  const scenarioFactor = scenario === "stress" ? 1.2 : 1;
  return (
    events
      .filter((event) => event.month + shift === month)
      .reduce((sum, event) => sum + event.amount, 0) * scenarioFactor
  );
}

function inventoryBuy(
  month: number,
  scenario: ScenarioId,
  units: number,
  cogs: number,
  plan: OperatingPlan,
) {
  const launch = effectiveMilestoneMonth(plan, "commercialLaunch", scenario);
  const launchStock = new Map<number, number>([
    [launch - 6, 2],
    [launch - 4, 8],
    [launch - 3, 10],
    [launch - 2, 12],
  ]);
  const scenarioFactor = scenario === "stress" ? 0.65 : scenario === "delayed" ? 0.9 : 1;
  const planned = (launchStock.get(month) ?? 0) * scenarioFactor;
  if (planned > 0) return planned;
  if (units > 0) return Math.max(0, units * cogs * 1.15 - units * cogs);
  return 0;
}

export type MonthRow = {
  m: number;
  units: number;
  aluminiumUnits: number;
  carbonUnits: number;
  premiumCarbonUnits: number;
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
  equipmentCapex: number;
  equipmentManufacturingDepreciation: number;
  equipmentSupportDepreciation: number;
  equipmentOfficeDepreciation: number;
  productCostPerUnit: number;
};

function effectiveCogs(line: ProductLineAssumption, assumptions: FinanceAssumptions) {
  const source = assumptions.bomCostSource?.[line.id] ?? "manual";
  if (source !== "bom") return line.cogsLakh;
  const tier = assumptions.bomTierByProduct?.[line.id];
  return tier ? bomTotalLakh(tier, assumptions.bomOverrides) : line.cogsLakh;
}

export function buildModelWithInputs(
  scenario: ScenarioId,
  drawStandby: boolean,
  assumptions: FinanceAssumptions = DEFAULT_FINANCE_ASSUMPTIONS,
): MonthRow[] {
  const plan = normalizeOperatingPlan(
    assumptions.operatingPlan ?? DEFAULT_APPROVED_OPERATING_PLAN,
  );
  const lines = assumptions.productLines;
  const rows: MonthRow[] = [];
  const equipment = assumptions.equipmentLedger ?? DEFAULT_EQUIPMENT_LEDGER;
  let cash = assumptions.openingCashLakh + assumptions.aluminiumVertical.openingCashLakh;
  let inventory = 0;
  let iaud = 0;
  let tooling = 0;

  for (let month = 1; month <= 36; month++) {
    const baseUnits = unitsForPlanMonth(plan, month, scenario);
    const allocationLines =
      scenario === "stress" ? lines.filter((line) => line.id === "carbon") : lines;
    const allocated = allocateUnits(baseUnits, allocationLines, month, plan, scenario);
    allocated.aluminium = Math.max(
      0,
      Math.round(allocated.aluminium * assumptions.aluminiumVertical.volumeMultiplier),
    );
    const units = allocated.aluminium + allocated.carbon + allocated.premiumCarbon;
    const stressFactor = scenario === "stress" ? 1.2 : 1;
    const cogsById = Object.fromEntries(
      lines.map((line) => [line.id, effectiveCogs(line, assumptions)]),
    ) as Record<ProductLineId, number>;
    const revenue = lines.reduce(
      (sum, line) => sum + allocated[line.id] * line.aspLakh,
      0,
    );
    const baseCogs = lines.reduce(
      (sum, line) => sum + allocated[line.id] * cogsById[line.id] * stressFactor,
      0,
    );
    const nonLongitudeUnits = allocated.carbon + allocated.premiumCarbon;
    const nonLongitudeCogsPerUnit =
      nonLongitudeUnits > 0
        ? ((allocated.carbon * cogsById.carbon +
            allocated.premiumCarbon * cogsById.premiumCarbon) /
            nonLongitudeUnits) *
          stressFactor
        : 0;
    const baseInventory =
      inventoryBuy(month, scenario, nonLongitudeUnits, nonLongitudeCogsPerUnit, plan) *
      assumptions.inventoryMultiplier;
    const longitudeLaunch = effectiveProductLaunchMonth(plan, "longitude", scenario);
    const longitudeInventory =
      month >= longitudeLaunch && allocated.aluminium > 0
        ? allocated.aluminium *
          cogsById.aluminium *
          Math.max(0, assumptions.aluminiumVertical.inventoryCover - 1) *
          assumptions.inventoryMultiplier
        : 0;
    const inventoryPurchase = baseInventory + longitudeInventory;
    const baseOpex = opexFor(month, scenario, plan) * assumptions.opexMultiplier;
    const longitudeOpex =
      assumptions.aluminiumVertical.opexLakh > 0
        ? month >= longitudeLaunch
          ? assumptions.aluminiumVertical.opexLakh
          : assumptions.aluminiumVertical.opexLakh * 0.35
        : 0;
    const manufacturingConsumables =
      equipmentConsumablesForMonth(equipment, month, "consumables") *
      assumptions.inventoryMultiplier;
    const officeConsumables =
      equipmentOfficeConsumablesForMonth(equipment, month) * assumptions.opexMultiplier;
    const equipmentCapex = equipmentCapexForMonth(equipment, month) * assumptions.capexMultiplier;
    const equipmentManufacturingDepreciation =
      equipmentDirectManufacturingDepreciationForMonth(equipment, month);
    const equipmentSupportDepreciation =
      equipmentManufacturingSupportDepreciationForMonth(equipment, month);
    const equipmentOfficeDepreciation = equipmentOfficeDepreciationForMonth(equipment, month);
    const baseCapex = capexFor(month, scenario, plan) * assumptions.capexMultiplier;
    const longitudeLaunchMonth = month === longitudeLaunch;
    const capex =
      baseCapex +
      equipmentCapex +
      (longitudeLaunchMonth ? assumptions.aluminiumVertical.capexLakh : 0);
    const baseFunding =
      fundingFor(month, scenario, drawStandby, plan) * assumptions.fundingMultiplier;
    const funding =
      baseFunding + (longitudeLaunchMonth ? assumptions.aluminiumVertical.fundingLakh : 0);
    const cogs = baseCogs + manufacturingConsumables;
    const opex = baseOpex + longitudeOpex + officeConsumables;
    const grossProfit = revenue - cogs;
    const ebitda = grossProfit - opex;
    const opening = cash;
    cash =
      opening + funding + revenue - opex - capex - inventoryPurchase - manufacturingConsumables;
    inventory = Math.max(0, inventory + inventoryPurchase - baseCogs);
    if (
      plan.milestoneMonths.prototypeValidation > 0 &&
      month <= Math.max(8, plan.milestoneMonths.prototypeValidation)
    ) {
      iaud += capex * 0.7;
    }
    if (
      capex >= 20 ||
      (plan.milestoneMonths.toolingPilot > 0 && month >= plan.milestoneMonths.toolingPilot)
    ) {
      tooling += capex;
    }
    const productCostPerUnit =
      units > 0
        ? (cogs + equipmentManufacturingDepreciation + equipmentSupportDepreciation) / units
        : 0;

    rows.push({
      m: month,
      units,
      aluminiumUnits: allocated.aluminium,
      carbonUnits: allocated.carbon,
      premiumCarbonUnits: allocated.premiumCarbon,
      revenue,
      cogs,
      gp: grossProfit,
      opex,
      ebitda,
      capex,
      inventoryBuy: inventoryPurchase,
      funding,
      opening,
      closing: cash,
      inventory,
      iaud,
      tooling,
      equipmentCapex,
      equipmentManufacturingDepreciation,
      equipmentSupportDepreciation,
      equipmentOfficeDepreciation,
      productCostPerUnit,
    });
  }

  return rows;
}

export function buildModel(scenario: ScenarioId, drawStandby: boolean) {
  return buildModelWithInputs(scenario, drawStandby, DEFAULT_FINANCE_ASSUMPTIONS);
}

export function runwayMonths(rows: MonthRow[], from: number) {
  const start = rows[from - 1];
  if (!start) return 0;
  let cash = start.closing;
  let months = 0;
  for (let index = from; index < rows.length; index++) {
    const burn =
      rows[index].opex + rows[index].capex + rows[index].inventoryBuy - rows[index].revenue;
    if (burn <= 0) {
      months++;
      cash = rows[index].closing;
      continue;
    }
    if (cash <= 0) break;
    const partial = cash / burn;
    if (partial < 1) {
      months += partial;
      break;
    }
    months++;
    cash = rows[index].closing;
  }
  return months;
}

export function minCash(rows: MonthRow[]) {
  return rows.reduce(
    (minimum, row) =>
      row.closing < minimum.cash ? { m: row.m, cash: row.closing } : minimum,
    { m: 1, cash: rows[0]?.closing ?? 0 },
  );
}

export function totals(rows: MonthRow[]) {
  return {
    revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    units: rows.reduce((sum, row) => sum + row.units, 0),
    funding: rows.reduce((sum, row) => sum + row.funding, 0),
    opex: rows.reduce((sum, row) => sum + row.opex, 0),
    ebitda: rows.reduce((sum, row) => sum + row.ebitda, 0),
    equipmentCapex: rows.reduce((sum, row) => sum + row.equipmentCapex, 0),
    equipmentManufacturingDepreciation: rows.reduce(
      (sum, row) => sum + row.equipmentManufacturingDepreciation,
      0,
    ),
    equipmentSupportDepreciation: rows.reduce(
      (sum, row) => sum + row.equipmentSupportDepreciation,
      0,
    ),
  };
}

const ASP =
  DEFAULT_PRODUCT_LINES.reduce((sum, line) => sum + line.aspLakh * line.mixPct, 0) / 100;
const COGS =
  DEFAULT_PRODUCT_LINES.reduce((sum, line) => sum + line.cogsLakh * line.mixPct, 0) / 100;

export const BREAKEVEN_EARLY = 19;
export const BREAKEVEN_SCALE = 29;
export const ASP_L = ASP;
export const COGS_L = COGS;
export const GM = ((ASP - COGS) / ASP) * 100;
