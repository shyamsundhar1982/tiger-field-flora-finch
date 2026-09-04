import type { MonthRow } from "@/lib/finance/model";

/** Accrual accounting layer over the founder planning model. Values are ₹ lakh. */
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
  gstSettlementMonths: number;
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
  gstSettlementMonths: 1,
};

export type AccountingRow = {
  m: number; revenue: number; cogs: number; grossProfit: number; opex: number;
  purchases: number; depreciation: number; ebitda: number; ebit: number; tax: number; netProfit: number;
  salesCollections: number; supplierPayments: number; operatingCashFlow: number;
  capex: number; investingCashFlow: number; funding: number; financingCashFlow: number;
  openingCash: number; closingCash: number; receivables: number; inventory: number;
  fixedAssetsNet: number; payables: number; debt: number; equity: number;
  retainedEarnings: number; gstOutput: number; gstInput: number; gstSettlement: number; gstNetPayable: number;
  totalAssets: number; totalLiabilitiesEquity: number; balanceCheck: number;
};

function purchasesFor(rows: MonthRow[], index: number) {
  const row = rows[index];
  const openingInventory = index === 0 ? 0 : rows[index - 1].inventory;
  return Math.max(0, row.cogs + row.inventory - openingInventory);
}

function lagged<T>(values: T[], index: number, months: number, fallback: T) {
  const source = index - Math.max(0, Math.floor(months));
  return source >= 0 ? values[source] : fallback;
}

export function buildAccountingModel(
  planningRows: MonthRow[],
  assumptions: AccountingAssumptions = DEFAULT_ACCOUNTING_ASSUMPTIONS,
): AccountingRow[] {
  const out: AccountingRow[] = [];
  if (!planningRows.length) return out;

  let cash = planningRows[0].opening;
  let receivables = assumptions.openingReceivablesLakh;
  let payables = assumptions.openingPayablesLakh;
  let fixedAssetsGross = assumptions.openingFixedAssetsLakh;
  let accumulatedDepreciation = 0;
  let debt = assumptions.openingDebtLakh;
  let equity = assumptions.openingEquityLakh;
  let retainedEarnings = assumptions.openingRetainedEarningsLakh;
  let gstNetPayable = 0;
  let cumulativeTaxableProfit = 0;
  let cumulativeTaxExpense = 0;

  const purchases = planningRows.map((_, index) => purchasesFor(planningRows, index));
  const depreciationRate = assumptions.depreciationMonths > 0 ? 1 / assumptions.depreciationMonths : 0;
  const gstRate = Math.max(0, assumptions.gstRatePct) / 100;
  const grossSalesValues = planningRows.map((r) => r.revenue * (1 + gstRate));
  const grossPurchaseValues = purchases.map((p) => p * (1 + gstRate));
  const gstNetMovements: number[] = [];

  for (let index = 0; index < planningRows.length; index++) {
    const row = planningRows[index];

    const grossSales = grossSalesValues[index];
    const collections = lagged(
      grossSalesValues,
      index,
      assumptions.collectionMonths,
      index === 0 ? assumptions.openingReceivablesLakh : 0,
    );
    receivables = Math.max(0, receivables + grossSales - collections);

    const grossPurchases = grossPurchaseValues[index];
    const supplierPayments = lagged(
      grossPurchaseValues,
      index,
      assumptions.supplierCreditMonths,
      index === 0 ? assumptions.openingPayablesLakh : 0,
    );
    payables = Math.max(0, payables + grossPurchases - supplierPayments);

    // Each capex month is a separate depreciation cohort; opening assets start depreciating in M1.
    fixedAssetsGross += row.capex;
    const openingAssetDep = assumptions.openingFixedAssetsLakh * depreciationRate;
    const currentCohortDep = planningRows.slice(0, index + 1).reduce((sum, r) => sum + r.capex * depreciationRate, 0);
    const depreciation = Math.max(0, openingAssetDep + currentCohortDep);
    accumulatedDepreciation += depreciation;
    const fixedAssetsNet = Math.max(0, fixedAssetsGross - accumulatedDepreciation);

    const ebitda = row.ebitda;
    const ebit = ebitda - depreciation;
    cumulativeTaxableProfit = Math.max(0, cumulativeTaxableProfit + ebit);
    const cumulativeTaxLiability = cumulativeTaxableProfit * Math.max(0, assumptions.taxRatePct) / 100;
    const tax = Math.max(0, cumulativeTaxLiability - cumulativeTaxExpense);
    cumulativeTaxExpense += tax;
    const netProfit = ebit - tax;

    // GST is a balance-sheet tax flow, not P&L revenue/expense. This management layer
    // models output tax on sales and eligible input tax on inventory purchases + capex.
    const gstOutput = row.revenue * gstRate;
    const gstInput = (purchases[index] + row.capex) * gstRate;
    const gstMovement = gstOutput - gstInput;
    gstNetMovements.push(gstMovement);
    const gstSettlement = Math.max(0, lagged(gstNetMovements, index, assumptions.gstSettlementMonths, 0));
    gstNetPayable = gstNetPayable + gstMovement - gstSettlement;

    const openingCash = cash;
    const operatingCashFlow = collections - supplierPayments - row.opex - tax - gstSettlement;
    const investingCashFlow = -row.capex;
    const financingCashFlow = row.funding;
    cash = openingCash + operatingCashFlow + investingCashFlow + financingCashFlow;

    // Default management treatment: funding is equity until source documents say otherwise.
    equity += row.funding;
    retainedEarnings += netProfit;

    const gstAsset = Math.max(0, -gstNetPayable);
    const gstLiability = Math.max(0, gstNetPayable);
    const totalAssets = cash + receivables + row.inventory + fixedAssetsNet + gstAsset;
    const totalLiabilitiesEquity = payables + debt + gstLiability + equity + retainedEarnings;

    out.push({
      m: row.m, revenue: row.revenue, cogs: row.cogs, grossProfit: row.gp, opex: row.opex,
      purchases: purchases[index], depreciation, ebitda, ebit, tax, netProfit,
      salesCollections: collections, supplierPayments, operatingCashFlow,
      capex: row.capex, investingCashFlow, funding: row.funding, financingCashFlow,
      openingCash, closingCash: cash, receivables, inventory: row.inventory,
      fixedAssetsNet, payables, debt, equity, retainedEarnings,
      gstOutput, gstInput, gstSettlement, gstNetPayable,
      totalAssets, totalLiabilitiesEquity, balanceCheck: totalAssets - totalLiabilitiesEquity,
    });
  }
  return out;
}

export function accountingTotals(rows: AccountingRow[]) {
  return rows.reduce((a, r) => ({
    revenue: a.revenue + r.revenue,
    cogs: a.cogs + r.cogs,
    grossProfit: a.grossProfit + r.grossProfit,
    opex: a.opex + r.opex,
    purchases: a.purchases + r.purchases,
    depreciation: a.depreciation + r.depreciation,
    ebitda: a.ebitda + r.ebitda,
    netProfit: a.netProfit + r.netProfit,
    operatingCashFlow: a.operatingCashFlow + r.operatingCashFlow,
    investingCashFlow: a.investingCashFlow + r.investingCashFlow,
    financingCashFlow: a.financingCashFlow + r.financingCashFlow,
    gstOutput: a.gstOutput + r.gstOutput,
    gstInput: a.gstInput + r.gstInput,
    gstSettlement: a.gstSettlement + r.gstSettlement,
  }), { revenue:0, cogs:0, grossProfit:0, opex:0, purchases:0, depreciation:0, ebitda:0, netProfit:0, operatingCashFlow:0, investingCashFlow:0, financingCashFlow:0, gstOutput:0, gstInput:0, gstSettlement:0 });
}

export function maxBalanceSheetError(rows: AccountingRow[]) {
  return rows.reduce((max, row) => Math.max(max, Math.abs(row.balanceCheck)), 0);
}
