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

export const ADVANCED_CASH_GOVERNANCE_VERSION = "VYNDI-ADVANCED-CASH-GOVERNANCE-0.2" as const;

export type CashPlanningDisposition =
  | "execution-ready"
  | "funding-required"
  | "cash-evidence-incomplete"
  | "not-evaluated";

export type CashFundingRequirement = {
  minimumAdditionalFundingLakh: number;
  requiredByPeriod: number;
  baselineReserveFundingNeedLakh: number;
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

function deriveFundingRequirement(
  result: ProcurementCashGuardrailResult,
): CashFundingRequirement | undefined {
  const deficitPeriods = result.periods.filter(
    (period) => period.headroomAfterProposedProcurementLakh < -1e-9,
  );
  if (!deficitPeriods.length) return undefined;

  const minimumAdditionalFundingLakh = round(Math.max(
    ...deficitPeriods.map((period) => Math.abs(period.headroomAfterProposedProcurementLakh)),
  ));
  const requiredByPeriod = Math.min(...deficitPeriods.map((period) => period.period));
  const baselineReserveFundingNeedLakh = round(Math.max(
    0,
    ...result.periods.map((period) => Math.max(0, -period.cumulativeHeadroomLakh)),
  ));

  return {
    minimumAdditionalFundingLakh,
    requiredByPeriod,
    baselineReserveFundingNeedLakh,
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
  }

  const result = evaluateProcurementCashGuardrails(procurement, model.supplierLanes, guardrails);
  const fundingRequirement = result.status === "infeasible"
    ? deriveFundingRequirement(result)
    : undefined;

  if (result.status === "infeasible") {
    issues.push(cashIssue(
      "error",
      "CASH_GOVERNANCE_INFEASIBLE",
      `Current evidenced liquidity cannot preserve the governed reserve${result.firstProposedBreachPeriod ? ` from period ${result.firstProposedBreachPeriod}` : result.firstBaselineBreachPeriod ? ` from period ${result.firstBaselineBreachPeriod}` : ""}. The mathematical solution is preserved, but execution remains blocked until sufficient funding or another governed cash action is evidenced.`,
    ));
    if (fundingRequirement) {
      issues.push(cashIssue(
        "warning",
        "CAPITAL_DEPENDENT_PLAN",
        `The mathematically feasible plan is funding-dependent: at least ₹${fundingRequirement.minimumAdditionalFundingLakh}L additional funding is required by period ${fundingRequirement.requiredByPeriod} to restore reserve-preserving liquidity. This is a conditional planning result, not authority to raise, spend or commit funds.`,
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
