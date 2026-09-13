import type { AdvancedPlanningConstraintModel } from "./advanced-planning-constraints.ts";
import type {
  AdvancedOptimizationValidationIssue,
  GovernedAdvancedOptimizationRun,
} from "./advanced-planning-optimizer.ts";
import {
  evaluateProcurementCashGuardrails,
  type AdvancedCashGuardrail,
  type ProcurementCashGuardrailResult,
} from "./advanced-planning-cash-guardrails.ts";

export const ADVANCED_CASH_GOVERNANCE_VERSION = "VYNDI-ADVANCED-CASH-GOVERNANCE-0.4" as const;

export type CashPlanningDisposition =
  | "execution-ready"
  | "funding-required"
  | "cash-evidence-incomplete"
  | "not-evaluated";

export type FundingEvidenceBasis = "commercially-governed" | "provisional-test-or-benchmark";

export type CashFundingRequirement = {
  firstFundingNeedLakh: number;
  firstFundingNeedPeriod: number;
  peakAdditionalFundingLakh: number;
  peakFundingPeriod: number;
  baselineReserveFundingNeedLakh: number;
  evidenceBasis: FundingEvidenceBasis;
  authoritativeForFundingDecision: boolean;
  reason: "reserve-preserving-liquidity-gap";
  executionBlockedUntilFundingEvidenced: true;
  planningScenarioConditionallyFeasible: true;
};

export type CashGovernedAdvancedOptimizationRun = GovernedAdvancedOptimizationRun & {
  cashGovernance: {
    version: typeof ADVANCED_CASH_GOVERNANCE_VERSION;
    status: ProcurementCashGuardrailResult["status"] | "not-evaluated";
    planningDisposition: CashPlanningDisposition;
    fundingRequirement?: CashFundingRequirement;
    result?: ProcurementCashGuardrailResult;
    requiredForAcceptance: true;
  };
};

function cashIssue(
  severity: AdvancedOptimizationValidationIssue["severity"],
  code: string,
  message: string,
): AdvancedOptimizationValidationIssue {
  return { severity, code, path: "cashGovernance", message };
}

function round(value: number) {
  return Number(value.toFixed(6));
}

function fundingEvidenceBasis(model: AdvancedPlanningConstraintModel): FundingEvidenceBasis {
  const provisional = model.supplierLanes
    .filter((lane) => lane.approved)
    .some((lane) => /TEST|BENCHMARK|ASSUMPTION/i.test([lane.id, lane.supplierId, lane.sourceRef ?? ""].join(" ")));
  return provisional ? "provisional-test-or-benchmark" : "commercially-governed";
}

function deriveFundingRequirement(
  result: ProcurementCashGuardrailResult,
  model: AdvancedPlanningConstraintModel,
): CashFundingRequirement | undefined {
  const deficitPeriods = result.periods
    .filter((period) => period.headroomAfterProposedProcurementLakh < -1e-9)
    .sort((left, right) => left.period - right.period);
  if (!deficitPeriods.length) return undefined;

  const firstDeficit = deficitPeriods[0];
  const peakDeficit = deficitPeriods.reduce((peak, period) => {
    const peakNeed = Math.abs(peak.headroomAfterProposedProcurementLakh);
    const periodNeed = Math.abs(period.headroomAfterProposedProcurementLakh);
    if (periodNeed > peakNeed + 1e-9) return period;
    if (Math.abs(periodNeed - peakNeed) <= 1e-9 && period.period < peak.period) return period;
    return peak;
  });
  const baselineReserveFundingNeedLakh = round(Math.max(
    0,
    ...result.periods.map((period) => Math.max(0, -period.cumulativeHeadroomLakh)),
  ));
  const evidenceBasis = fundingEvidenceBasis(model);

  return {
    firstFundingNeedLakh: round(Math.abs(firstDeficit.headroomAfterProposedProcurementLakh)),
    firstFundingNeedPeriod: firstDeficit.period,
    peakAdditionalFundingLakh: round(Math.abs(peakDeficit.headroomAfterProposedProcurementLakh)),
    peakFundingPeriod: peakDeficit.period,
    baselineReserveFundingNeedLakh,
    evidenceBasis,
    authoritativeForFundingDecision: evidenceBasis === "commercially-governed",
    reason: "reserve-preserving-liquidity-gap",
    executionBlockedUntilFundingEvidenced: true,
    planningScenarioConditionallyFeasible: true,
  };
}

export function applyCashGovernanceToOptimizationRun(
  run: GovernedAdvancedOptimizationRun,
  model: AdvancedPlanningConstraintModel,
  guardrails: AdvancedCashGuardrail[],
): CashGovernedAdvancedOptimizationRun {
  const issues = [...run.issues];
  const procurement = run.result?.solution?.procurement;

  if (!run.result || (run.result.status !== "optimal" && run.result.status !== "feasible")) {
    return {
      ...run,
      accepted: false,
      issues,
      cashGovernance: {
        version: ADVANCED_CASH_GOVERNANCE_VERSION,
        status: "not-evaluated",
        planningDisposition: "not-evaluated",
        requiredForAcceptance: true,
      },
    };
  }

  if (!run.accepted) {
    return {
      ...run,
      accepted: false,
      issues,
      cashGovernance: {
        version: ADVANCED_CASH_GOVERNANCE_VERSION,
        status: "not-evaluated",
        planningDisposition: "not-evaluated",
        requiredForAcceptance: true,
      },
    };
  }

  if (!procurement) {
    issues.push(cashIssue(
      "error",
      "CASH_GOVERNANCE_SOLUTION_MISSING",
      "Cash governance requires an explicit procurement solution for a mathematically feasible optimization run.",
    ));
    return {
      ...run,
      accepted: false,
      issues,
      cashGovernance: {
        version: ADVANCED_CASH_GOVERNANCE_VERSION,
        status: "indeterminate",
        planningDisposition: "cash-evidence-incomplete",
        requiredForAcceptance: true,
      },
    };
  }

  if (guardrails.length !== model.horizonPeriods) {
    issues.push(cashIssue(
      "error",
      "CASH_GOVERNANCE_INCOMPLETE_HORIZON",
      `Cash governance requires ${model.horizonPeriods} governed periods; received ${guardrails.length}.`,
    ));
    return {
      ...run,
      accepted: false,
      issues,
      cashGovernance: {
        version: ADVANCED_CASH_GOVERNANCE_VERSION,
        status: "indeterminate",
        planningDisposition: "cash-evidence-incomplete",
        requiredForAcceptance: true,
      },
    };
  }

  const result = evaluateProcurementCashGuardrails(procurement, model.supplierLanes, guardrails);
  const fundingRequirement = result.status === "infeasible"
    ? deriveFundingRequirement(result, model)
    : undefined;

  if (result.status === "infeasible") {
    issues.push(cashIssue(
      "error",
      "CASH_GOVERNANCE_INFEASIBLE",
      `Current evidenced liquidity cannot preserve the governed reserve${result.firstProposedBreachPeriod ? ` from period ${result.firstProposedBreachPeriod}` : result.firstBaselineBreachPeriod ? ` from period ${result.firstBaselineBreachPeriod}` : ""}. The mathematical solution is preserved, but execution remains blocked until sufficient funding or another governed cash action is evidenced.`,
    ));
    if (fundingRequirement) {
      if (!fundingRequirement.authoritativeForFundingDecision) {
        issues.push(cashIssue(
          "warning",
          "PROVISIONAL_FUNDING_EVIDENCE",
          `Supplier economics include test, benchmark, or assumption evidence. The modeled first cash gap of ₹${fundingRequirement.firstFundingNeedLakh}L and peak scenario exposure of ₹${fundingRequirement.peakAdditionalFundingLakh}L are not authoritative fundraising requirements.`,
        ));
      }
      issues.push(cashIssue(
        "warning",
        "CAPITAL_DEPENDENT_PLAN",
        fundingRequirement.authoritativeForFundingDecision
          ? `The mathematically feasible plan is funding-dependent: the first reserve-preserving funding need is ₹${fundingRequirement.firstFundingNeedLakh}L by period ${fundingRequirement.firstFundingNeedPeriod}, while the peak additional funding requirement is ₹${fundingRequirement.peakAdditionalFundingLakh}L by period ${fundingRequirement.peakFundingPeriod}. This is a conditional planning result, not authority to raise, spend or commit funds.`
          : `The mathematically feasible plan has provisional scenario cash exposure: the first modeled gap is ₹${fundingRequirement.firstFundingNeedLakh}L by period ${fundingRequirement.firstFundingNeedPeriod}, while peak modeled exposure is ₹${fundingRequirement.peakAdditionalFundingLakh}L by period ${fundingRequirement.peakFundingPeriod}. These values are not an authoritative fundraising requirement.`,
      ));
    }
  } else if (result.status === "indeterminate") {
    issues.push(cashIssue(
      "error",
      "CASH_GOVERNANCE_INDETERMINATE",
      "The mathematical solution cannot be accepted because governed cash evidence is incomplete or invalid.",
    ));
  }

  const planningDisposition: CashPlanningDisposition = result.status === "feasible"
    ? "execution-ready"
    : result.status === "infeasible"
      ? "funding-required"
      : "cash-evidence-incomplete";

  return {
    ...run,
    accepted: run.accepted && result.status === "feasible" && !issues.some((row) => row.severity === "error"),
    issues,
    cashGovernance: {
      version: ADVANCED_CASH_GOVERNANCE_VERSION,
      status: result.status,
      planningDisposition,
      ...(fundingRequirement ? { fundingRequirement } : {}),
      result,
      requiredForAcceptance: true,
    },
  };
}
