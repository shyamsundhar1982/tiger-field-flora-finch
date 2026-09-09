export type AccountingRegime = "AS" | "IND_AS";

export type CaKnowledgeContext = {
  regime: AccountingRegime;
  entityType: "private_limited" | "llp" | "partnership" | "proprietorship";
  gstRegistered: boolean;
  importExportEnabled: boolean;
};

export type FinancialPlanningInput = {
  revenueLakh: number;
  cogsLakh: number;
  opexLakh: number;
  interestLakh?: number;
  depreciationLakh?: number;
  taxLakh?: number;
  capexLakh?: number;
  debtServiceLakh?: number;
  workingCapitalChangeLakh?: number;
};

export function analyseFinancialPlan(input: FinancialPlanningInput) {
  const grossProfitLakh = input.revenueLakh - input.cogsLakh;
  const ebitdaLakh = grossProfitLakh - input.opexLakh;
  const ebitLakh = ebitdaLakh - (input.depreciationLakh ?? 0);
  const pbtLakh = ebitLakh - (input.interestLakh ?? 0);
  const patLakh = pbtLakh - (input.taxLakh ?? 0);
  const freeCashFlowLakh =
    patLakh +
    (input.depreciationLakh ?? 0) -
    (input.capexLakh ?? 0) -
    (input.workingCapitalChangeLakh ?? 0) -
    (input.debtServiceLakh ?? 0);
  return { grossProfitLakh, ebitdaLakh, ebitLakh, pbtLakh, patLakh, freeCashFlowLakh };
}

export const CA_GOVERNANCE_RULES = [
  "Apply the entity's governed accounting regime; do not silently mix AS and Ind AS treatments.",
  "Separate accounting recognition, tax treatment and cash timing.",
  "Inventory valuation, foreign exchange, PPE, employee benefits, leases, borrowing costs, provisions and tax accounting must cite the applicable governed standard before a journal is recommended.",
  "GST, customs, TDS/TCS, income-tax and Companies Act compliance are advisory until validated against current official rules and the entity's actual facts.",
  "Never post a journal, tax return, challan, invoice, credit note or statutory filing automatically.",
  "Produce audit-ready reasoning: source, effective date, assumption, calculation, accounting impact, tax impact, cash impact and approval owner.",
] as const;
