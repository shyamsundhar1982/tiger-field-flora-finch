import type { AccountingRow } from "@/lib/finance/accounting";

export type FinanceIntegrity = {
  balanced: boolean;
  cashReconciled: boolean;
  statementsPresent: boolean;
  finite: boolean;
  maxBalanceError: number;
  maxCashError: number;
};

export function checkFinanceIntegrity(rows: AccountingRow[], tolerance = 0.01): FinanceIntegrity {
  if (!rows.length) return { balanced: false, cashReconciled: false, statementsPresent: false, finite: false, maxBalanceError: Infinity, maxCashError: Infinity };
  let maxBalanceError = 0;
  let maxCashError = 0;
  let finite = true;
  for (const row of rows) {
    const expectedCash = row.openingCash + row.operatingCashFlow + row.investingCashFlow + row.financingCashFlow;
    maxBalanceError = Math.max(maxBalanceError, Math.abs(row.balanceCheck));
    maxCashError = Math.max(maxCashError, Math.abs(row.closingCash - expectedCash));
    finite = finite && Object.values(row).every((value) => typeof value !== "number" || Number.isFinite(value));
  }
  return {
    balanced: maxBalanceError <= tolerance,
    cashReconciled: maxCashError <= tolerance,
    statementsPresent: rows.every((row) => [row.revenue, row.netProfit, row.closingCash, row.totalAssets, row.totalLiabilitiesEquity].every(Number.isFinite)),
    finite,
    maxBalanceError,
    maxCashError,
  };
}
