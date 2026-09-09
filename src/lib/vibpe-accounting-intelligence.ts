export type AccountingTruthClass = "plan" | "forecast" | "commitment" | "actual";

export type AccountingEntryPreview = {
  event: string;
  truthClass: AccountingTruthClass;
  debitAccount: string;
  creditAccount: string;
  amountLakh: number;
  gstInputLakh?: number;
  gstOutputLakh?: number;
  advisoryOnly: true;
};

export function previewPurchaseAccounting(args: {
  inventoryOrExpenseAccount: string;
  supplierPayableAccount: string;
  taxableValueLakh: number;
  eligibleInputTaxLakh: number;
  truthClass: AccountingTruthClass;
}): AccountingEntryPreview[] {
  const rows: AccountingEntryPreview[] = [
    {
      event: "purchase-recognition-preview",
      truthClass: args.truthClass,
      debitAccount: args.inventoryOrExpenseAccount,
      creditAccount: args.supplierPayableAccount,
      amountLakh: args.taxableValueLakh,
      advisoryOnly: true,
    },
  ];
  if (args.eligibleInputTaxLakh > 0) {
    rows.push({
      event: "input-tax-preview",
      truthClass: args.truthClass,
      debitAccount: "GST Input Tax Credit - provisional",
      creditAccount: args.supplierPayableAccount,
      amountLakh: args.eligibleInputTaxLakh,
      gstInputLakh: args.eligibleInputTaxLakh,
      advisoryOnly: true,
    });
  }
  return rows;
}

export type ManagementAccounts = {
  revenueLakh: number;
  cogsLakh: number;
  operatingExpenseLakh: number;
  depreciationLakh: number;
  financeCostLakh: number;
  taxExpenseLakh: number;
};

export function managementPnl(input: ManagementAccounts) {
  const grossProfitLakh = input.revenueLakh - input.cogsLakh;
  const ebitdaLakh = grossProfitLakh - input.operatingExpenseLakh;
  const ebitLakh = ebitdaLakh - input.depreciationLakh;
  const profitBeforeTaxLakh = ebitLakh - input.financeCostLakh;
  const profitAfterTaxLakh = profitBeforeTaxLakh - input.taxExpenseLakh;
  return { grossProfitLakh, ebitdaLakh, ebitLakh, profitBeforeTaxLakh, profitAfterTaxLakh };
}

export const ACCOUNTING_GOVERNANCE = [
  "Accounting previews are advisory and never post ledgers automatically.",
  "Recognise the difference between purchase order, goods receipt, supplier invoice, payment and input-tax-credit eligibility.",
  "Do not recognise forecast or scenario values as actual ledger entries.",
  "Reconcile management P&L, cash flow and balance-sheet movement; profit is not cash.",
  "Tax return filing, statutory classification and final journal approval remain controlled finance/CA responsibilities.",
] as const;
