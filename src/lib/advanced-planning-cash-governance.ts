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

export const ADVANCED_CASH_GOVERNANCE_VERSION = "VYNDI-ADVANCED-CASH-GOVERNANCE-0.1" as const;

export type CashGovernedAdvancedOptimizationRun = GovernedAdvancedOptimizationRun & {
  cashGovernance: {
    version: typeof ADVANCED_CASH_GOVERNANCE_VERSION;
    status: ProcurementCashGuardrailResult["status"] | "not-evaluated";
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
  if (result.status === "infeasible") {
    issues.push(cashIssue(
      "error",
      "CASH_GOVERNANCE_INFEASIBLE",
      `The mathematical solution breaches governed reserve-preserving liquidity${result.firstProposedBreachPeriod ? ` from period ${result.firstProposedBreachPeriod}` : ""}. Solver status is preserved, but the proposal is not governance-acceptable.`,
    ));
  } else if (result.status === "indeterminate") {
    issues.push(cashIssue(
      "error",
      "CASH_GOVERNANCE_INDETERMINATE",
      "The mathematical solution cannot be accepted because governed cash evidence is incomplete or invalid.",
    ));
  }

  return {
    ...run,
    accepted: run.accepted && result.status === "feasible" && !issues.some((row) => row.severity === "error"),
    issues,
    cashGovernance: {
      version: ADVANCED_CASH_GOVERNANCE_VERSION,
      status: result.status,
      result,
      requiredForAcceptance: true,
    },
  };
}
