import type { ModelRow } from "@/lib/finance/model";

/**
 * Accounting layer over the founder planning model.
 * Values are ₹ lakh. This deliberately does not alter the planning engine.
 * Defaults are management assumptions and must be replaced/reconciled by the CA.
 */
export type AccountingAssumptions = {
  collectionMonths: number;
  supplierCreditMonths: number;
  depreciationMonths: number;
  openingReceivablesLakh: number;
  openingPayablesLakh: number;
  openingFixedAssetsLakh: number;
  openingEquityLakh: number;
  openingDebtLakh: number;
  openingRetainedEarningsLakh: number;
  taxRatePct: number;
  gstRatePct: number;
};

export const DEFAULT_ACCOUNTING_ASSUMPTIONS: AccountingAssumptions = {
  collectionMonths: 1,
  supplierCreditMonths: 1,
  depreciationMonths: 60,
  openingReceivablesLakh: 0,
  openingPayablesLakh: 0,
  openingFixedAssetsLakh: 0,
  openingEquityLakh: 3,
  openingDebtLakh: 0,
  openingRetainedEarningsLakh: 0,
  taxRatePct: 0,
  gstRatePct: 0,
};

export type AccountingRow = {
  m: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  depreciation: number;
  ebitda: number;
  ebit: number;
  tax: number;
  netProfit: number;
  salesCollections: number;
  supplierPayments: number;
  operatingCashFlow: number;
  capex: number;
  investingCashFlow: number;
  funding: number;
  financingCashFlow: number;
  openingCash: number;
  closingCash: number;
  receivables: number;
  inventory: number;
  fixedAssetsNet: number;
  payables: number;
  debt: number;
  equity: number;
  retainedEarnings: number;
  totalAssets: number;
  totalLiabilitiesEquity: number;
  balanceCheck: number;
};

const lagged = (rows: ModelRow[], month: number, lag: number, key: keyof ModelRow) => {
  if (lag <= 0) return Number(rows[month - 1]?.[key] ?? 0);
  return Number(rows[month - lag - 1]?.[key] ?? 0);
};

export function buildAccountingModel(
  planningRows: ModelRow[],
  assumptions: AccountingAssumptions = DEFAULT_ACCOUNTING_ASSUMPTIONS,
): AccountingRow[] {
  const out: AccountingRow[] = [];
  let cash = planningRows[0]?.opening ?? 0;
  let receivables = assumptions.openingReceivablesLakh;
  let payables = assumptions.openingPayablesLakh;
  let fixedAssetsGross = assumptions.openingFixedAssetsLakh;
  let accumulatedDepreciation = 0;
  let debt = assumptions.openingDebtLakh;
  let equity = assumptions.openingEquityLakh;
  let retainedEarnings = assumptions.openingRetainedEarningsLakh;
  const depreciationRate = assumptions.depreciationMonths > 0 ? 1 / assumptions.depreciationMonths : 0;

  for (const row of planningRows) {
    // Accrual revenue: cash collection is deliberately separated from sales.
    const priorRevenue = lagged(planningRows, row.m, assumptions.collectionMonths, "revenue");
    const collections = row.m <= assumptions.collectionMonths ? 0 : priorRevenue;
    receivables = Math.max(0, receivables + row.revenue - collections);

    // Purchases = COGS + closing inventory - opening inventory.
    const openingInventory = row.m === 1 ? 0 : Number(planningRows[row.m - 2]?.inventory ?? 0);
    const purchases = Math.max(0, row.cogs + row.inventory - openingInventory);
    const priorPurchases = lagged(planningRows, row.m, assumptions.supplierCreditMonths, "inventoryBuy");
    const supplierPayments = row.m <= assumptions.supplierCreditMonths ? 0 : Math.max(0, priorPurchases);
    payables = Math.max(0, payables + purchases - supplierPayments);

    fixedAssetsGross += row.capex;
    const depreciation = Math.max(0, fixedAssetsGross * depreciationRate);
    accumulatedDepreciation += depreciation;
    const fixedAssetsNet = Math.max(0, fixedAssetsGross - accumulatedDepreciation);

    const ebitda = row.ebitda;
    const ebit = ebitda - depreciation;
    const tax = Math.max(0, ebit) * Math.max(0, assumptions.taxRatePct) / 100;
    const netProfit = ebit - tax;

    const operatingCashFlow = collections - supplierPayments - row.opex - tax;
    const investingCashFlow = -row.capex;
    const financingCashFlow = row.funding;
    const openingCash = cash;
    cash = openingCash + operatingCashFlow + investingCashFlow + financingCashFlow;
    retainedEarnings += netProfit;
    equity += row.m === 1 ? 0 : 0;

    const totalAssets = cash + receivables + row.inventory + fixedAssetsNet;
    const totalLiabilitiesEquity = payables + debt + equity + retainedEarnings;

    out.push({
      m: row.m,
      revenue: row.revenue,
      cogs: row.cogs,
      grossProfit: row.gp,
      opex: row.opex,
      depreciation,
      ebitda,
      ebit,
      tax,
      netProfit,
      salesCollections: collections,
      supplierPayments,
      operatingCashFlow,
      capex: row.capex,
      investingCashFlow,
      funding: row.funding,
      financingCashFlow,
      openingCash,
      closingCash: cash,
      receivables,
      inventory: row.inventory,
      fixedAssetsNet,
      payables,
      debt,
      equity,
      retainedEarnings,
      totalAssets,
      totalLiabilitiesEquity,
      balanceCheck: totalAssets - totalLiabilitiesEquity,
    });
  }
  return out;
}

export function accountingTotals(rows: AccountingRow[]) {
  return rows.reduce(
    (a, r) => ({
      revenue: a.revenue + r.revenue,
      cogs: a.cogs + r.cogs,
      grossProfit: a.grossProfit + r.grossProfit,
      opex: a.opex + r.opex,
      depreciation: a.depreciation + r.depreciation,
      ebitda: a.ebitda + r.ebitda,
      netProfit: a.netProfit + r.netProfit,
      operatingCashFlow: a.operatingCashFlow + r.operatingCashFlow,
      investingCashFlow: a.investingCashFlow + r.investingCashFlow,
      financingCashFlow: a.financingCashFlow + r.financingCashFlow,
    }),
    { revenue: 0, cogs: 0, grossProfit: 0, opex: 0, depreciation: 0, ebitda: 0, netProfit: 0, operatingCashFlow: 0, investingCashFlow: 0, financingCashFlow: 0 },
  );
}

export function maxBalanceSheetError(rows: AccountingRow[]) {
  return rows.reduce((max, row) => Math.max(max, Math.abs(row.balanceCheck)), 0);
}
