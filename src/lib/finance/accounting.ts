import type { ModelRow } from "@/lib/finance/model";

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
  m: number; revenue: number; cogs: number; grossProfit: number; opex: number;
  depreciation: number; ebitda: number; ebit: number; tax: number; netProfit: number;
  salesCollections: number; supplierPayments: number; operatingCashFlow: number;
  capex: number; investingCashFlow: number; funding: number; financingCashFlow: number;
  openingCash: number; closingCash: number; receivables: number; inventory: number;
  fixedAssetsNet: number; payables: number; debt: number; equity: number;
  retainedEarnings: number; totalAssets: number; totalLiabilitiesEquity: number;
  balanceCheck: number;
};

function purchasesFor(rows: ModelRow[], index: number) {
  const row = rows[index];
  const openingInventory = index === 0 ? 0 : rows[index - 1].inventory;
  return Math.max(0, row.cogs + row.inventory - openingInventory);
}

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

  for (let index = 0; index < planningRows.length; index++) {
    const row = planningRows[index];
    const collectionIndex = index - assumptions.collectionMonths;
    const collections = collectionIndex >= 0 ? planningRows[collectionIndex].revenue : 0;
    receivables = Math.max(0, receivables + row.revenue - collections);

    const purchases = purchasesFor(planningRows, index);
    const paymentIndex = index - assumptions.supplierCreditMonths;
    const supplierPayments = paymentIndex >= 0 ? purchasesFor(planningRows, paymentIndex) : 0;
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

    // Default management treatment: funding is equity until source documents say otherwise.
    equity += row.funding;
    retainedEarnings += netProfit;

    const totalAssets = cash + receivables + row.inventory + fixedAssetsNet;
    const totalLiabilitiesEquity = payables + debt + equity + retainedEarnings;

    out.push({
      m: row.m, revenue: row.revenue, cogs: row.cogs, grossProfit: row.gp, opex: row.opex,
      depreciation, ebitda, ebit, tax, netProfit, salesCollections: collections,
      supplierPayments, operatingCashFlow, capex: row.capex, investingCashFlow,
      funding: row.funding, financingCashFlow, openingCash, closingCash: cash,
      receivables, inventory: row.inventory, fixedAssetsNet, payables, debt, equity,
      retainedEarnings, totalAssets, totalLiabilitiesEquity,
      balanceCheck: totalAssets - totalLiabilitiesEquity,
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
    depreciation: a.depreciation + r.depreciation,
    ebitda: a.ebitda + r.ebitda,
    netProfit: a.netProfit + r.netProfit,
    operatingCashFlow: a.operatingCashFlow + r.operatingCashFlow,
    investingCashFlow: a.investingCashFlow + r.investingCashFlow,
    financingCashFlow: a.financingCashFlow + r.financingCashFlow,
  }), { revenue:0, cogs:0, grossProfit:0, opex:0, depreciation:0, ebitda:0, netProfit:0, operatingCashFlow:0, investingCashFlow:0, financingCashFlow:0 });
}

export function maxBalanceSheetError(rows: AccountingRow[]) {
  return rows.reduce((max, row) => Math.max(max, Math.abs(row.balanceCheck)), 0);
}
