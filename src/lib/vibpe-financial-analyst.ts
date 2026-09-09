export type MoneyLakh = number;

export type GovernedTaxRule = {
  id: string;
  jurisdiction: "IN";
  taxType: "GST" | "CUSTOMS" | "CESS" | "TDS" | "OTHER";
  code: string;
  ratePercent: number;
  effectiveFrom: string;
  effectiveTo?: string;
  sourceAuthority: string;
  sourceReference: string;
  approved: boolean;
};

export type ImportCostInput = {
  assessableValueLakh: MoneyLakh;
  basicCustomsDutyPercent: number;
  socialWelfareSurchargePercent?: number;
  igstPercent: number;
  otherDutyPercent?: number;
  freightLakh?: MoneyLakh;
  insuranceLakh?: MoneyLakh;
  portAndClearingLakh?: MoneyLakh;
  fxBufferLakh?: MoneyLakh;
};

export type ImportCostResult = {
  basicCustomsDutyLakh: MoneyLakh;
  socialWelfareSurchargeLakh: MoneyLakh;
  otherDutyLakh: MoneyLakh;
  igstLakh: MoneyLakh;
  landedCashOutflowLakh: MoneyLakh;
  potentiallyRecoverableInputTaxLakh: MoneyLakh;
  landedEconomicCostBeforeItcLakh: MoneyLakh;
  landedEconomicCostAfterEligibleItcLakh: MoneyLakh;
};

export function calculateImportLandedCost(input: ImportCostInput): ImportCostResult {
  const customsBase = input.assessableValueLakh;
  const bcd = customsBase * (input.basicCustomsDutyPercent / 100);
  const sws = bcd * ((input.socialWelfareSurchargePercent ?? 0) / 100);
  const other = customsBase * ((input.otherDutyPercent ?? 0) / 100);
  const igstBase = customsBase + bcd + sws + other;
  const igst = igstBase * (input.igstPercent / 100);
  const ancillary = (input.freightLakh ?? 0) + (input.insuranceLakh ?? 0) + (input.portAndClearingLakh ?? 0) + (input.fxBufferLakh ?? 0);
  const cash = customsBase + bcd + sws + other + igst + ancillary;
  const economicBeforeItc = cash;
  const economicAfterItc = cash - igst;
  return {
    basicCustomsDutyLakh: bcd,
    socialWelfareSurchargeLakh: sws,
    otherDutyLakh: other,
    igstLakh: igst,
    landedCashOutflowLakh: cash,
    potentiallyRecoverableInputTaxLakh: igst,
    landedEconomicCostBeforeItcLakh: economicBeforeItc,
    landedEconomicCostAfterEligibleItcLakh: economicAfterItc,
  };
}

export type WorkingCapitalInput = {
  monthlyRevenueLakh: number[];
  monthlyCogsLakh: number[];
  debtorDays: number;
  inventoryDays: number;
  creditorDays: number;
};

export function estimateWorkingCapital(input: WorkingCapitalInput) {
  const avgRevenue = input.monthlyRevenueLakh.reduce((a, b) => a + b, 0) / Math.max(input.monthlyRevenueLakh.length, 1);
  const avgCogs = input.monthlyCogsLakh.reduce((a, b) => a + b, 0) / Math.max(input.monthlyCogsLakh.length, 1);
  const receivables = (avgRevenue * 12 / 365) * input.debtorDays;
  const inventory = (avgCogs * 12 / 365) * input.inventoryDays;
  const payables = (avgCogs * 12 / 365) * input.creditorDays;
  return {
    receivablesLakh: receivables,
    inventoryLakh: inventory,
    payablesLakh: payables,
    netWorkingCapitalLakh: receivables + inventory - payables,
  };
}

export type ProcurementForecastRow = {
  period: number;
  demandUnits: number;
  requiredMaterialCostLakh: MoneyLakh;
  openPoReceiptsLakh: MoneyLakh;
  openingInventoryValueLakh: MoneyLakh;
  safetyStockValueLakh: MoneyLakh;
};

export function procurementCashForecast(rows: ProcurementForecastRow[]) {
  return rows.map((row) => {
    const grossNeed = row.requiredMaterialCostLakh + row.safetyStockValueLakh;
    const coverage = row.openingInventoryValueLakh + row.openPoReceiptsLakh;
    return {
      ...row,
      recommendedProcurementValueLakh: Math.max(0, grossNeed - coverage),
    };
  });
}

export const FINANCIAL_ANALYST_GOVERNANCE = [
  "Never hard-code a tax/duty rate as current law unless it comes from a versioned governed tax rule.",
  "GST input tax credit is a recoverability classification, not automatic cash availability; eligibility and documentation must be verified.",
  "Customs duty depends on tariff classification, origin, notifications, valuation and other applicable measures; unresolved classification is a decision blocker.",
  "A scenario calculation never posts an accounting entry, files a return, creates a PO or changes an approved plan.",
  "Separate cash outflow from economic cost after eligible input tax credit.",
  "Present P&L, cash flow, balance-sheet and working-capital effects separately when material.",
] as const;
