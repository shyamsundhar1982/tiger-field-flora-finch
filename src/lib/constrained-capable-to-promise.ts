import type { AdvancedPlanningConstraintModel } from "./advanced-planning-constraints.ts";
import {
  evaluateDeterministicFeasibility,
  type DeterministicFeasibilityResult,
  type FeasibilityStatus,
} from "./deterministic-feasibility.ts";

export type CapableToPromiseRequest = {
  requestId: string;
  productId: string;
  quantity: number;
  requestedPeriod: number;
  priority?: number;
  sourceRef?: string;
};

export type CapableToPromiseCandidate = {
  period: number;
  committedStatus: FeasibilityStatus;
  totalStatus: FeasibilityStatus;
  bindingConstraintCodes: string[];
  indeterminateCodes: string[];
};

export type CapableToPromiseStatus =
  | "promise_available"
  | "not_available"
  | "baseline_infeasible"
  | "indeterminate"
  | "invalid_request";

export type ConstrainedCapableToPromiseResult = {
  status: CapableToPromiseStatus;
  requestedPeriod: number;
  promisedPeriod?: number;
  promiseMeetsRequestedPeriod: boolean;
  forecastReplanRequired: boolean;
  baselineCommittedStatus: FeasibilityStatus;
  baselineTotalStatus: FeasibilityStatus;
  candidates: CapableToPromiseCandidate[];
  blockingConstraints: DeterministicFeasibilityResult["bindingConstraints"];
  indeterminate: DeterministicFeasibilityResult["indeterminate"];
  supplierRemediation: DeterministicFeasibilityResult["supplierRemediation"];
  explanation: string[];
};

function cloneModel(model: AdvancedPlanningConstraintModel): AdvancedPlanningConstraintModel {
  return structuredClone(model);
}

function candidateSummary(period: number, result: DeterministicFeasibilityResult): CapableToPromiseCandidate {
  return {
    period,
    committedStatus: result.committedStatus,
    totalStatus: result.totalStatus,
    bindingConstraintCodes: [...new Set(result.bindingConstraints.map((row) => row.code))].sort(),
    indeterminateCodes: [...new Set(result.indeterminate.map((row) => row.code))].sort(),
  };
}

export function evaluateConstrainedCapableToPromise(
  model: AdvancedPlanningConstraintModel,
  request: CapableToPromiseRequest,
): ConstrainedCapableToPromiseResult {
  const baseline = evaluateDeterministicFeasibility(model);
  const base = {
    requestedPeriod: request.requestedPeriod,
    promiseMeetsRequestedPeriod: false,
    forecastReplanRequired: false,
    baselineCommittedStatus: baseline.committedStatus,
    baselineTotalStatus: baseline.totalStatus,
    candidates: [] as CapableToPromiseCandidate[],
    blockingConstraints: baseline.bindingConstraints,
    indeterminate: baseline.indeterminate,
    supplierRemediation: baseline.supplierRemediation,
    explanation: [] as string[],
  };

  if (
    !request.requestId.trim() ||
    !request.productId.trim() ||
    !Number.isFinite(request.quantity) ||
    request.quantity <= 0 ||
    !Number.isInteger(request.requestedPeriod) ||
    request.requestedPeriod < 1 ||
    request.requestedPeriod > model.horizonPeriods
  ) {
    return {
      ...base,
      status: "invalid_request",
      explanation: [
        "The promise request is invalid. Request ID and product ID are required; quantity must be positive; requested period must be inside the planning horizon.",
      ],
    };
  }

  if (baseline.committedStatus === "infeasible") {
    return {
      ...base,
      status: "baseline_infeasible",
      explanation: [
        "Current committed demand is already infeasible under governed material/resource constraints. A new firm promise must not be issued until the existing commitment gap is resolved or explicitly re-governed.",
      ],
    };
  }

  if (baseline.committedStatus === "indeterminate") {
    return {
      ...base,
      status: "indeterminate",
      explanation: [
        "Current committed feasibility is indeterminate. VYNDI will not issue a firm promise while governed planning truth or deterministic resource assignment is incomplete.",
      ],
    };
  }

  const priority = request.priority ?? 1;
  const candidates: CapableToPromiseCandidate[] = [];
  let firstIndeterminate: DeterministicFeasibilityResult | undefined;
  let lastInfeasible: DeterministicFeasibilityResult | undefined;

  for (let period = request.requestedPeriod; period <= model.horizonPeriods; period += 1) {
    const candidateModel = cloneModel(model);
    candidateModel.demands.push({
      id: `CTP:${request.requestId}:P${period}`,
      productId: request.productId,
      period,
      quantity: request.quantity,
      priority,
      truth: "committed",
      sourceRef: request.sourceRef,
    });

    const feasibility = evaluateDeterministicFeasibility(candidateModel);
    candidates.push(candidateSummary(period, feasibility));

    if (feasibility.committedStatus === "feasible") {
      return {
        ...base,
        status: "promise_available",
        promisedPeriod: period,
        promiseMeetsRequestedPeriod: period === request.requestedPeriod,
        forecastReplanRequired: feasibility.totalStatus !== "feasible",
        candidates,
        blockingConstraints: feasibility.bindingConstraints,
        indeterminate: feasibility.indeterminate,
        supplierRemediation: feasibility.supplierRemediation,
        explanation: [
          period === request.requestedPeriod
            ? `Committed material and finite resource constraints support the requested promise period P${period}.`
            : `The requested period P${request.requestedPeriod} is not feasible, but committed constraints support the earliest firm promise in P${period}.`,
          feasibility.totalStatus === "feasible"
            ? "The promise also preserves feasibility of the current forecast load."
            : "Committed demand remains feasible, but total forecast feasibility is not preserved; the forecast/replenishment/schedule plan requires review before management accepts the broader plan.",
          "No unapproved purchase, supplier assumption or heuristic alternate-resource assignment was used to create this promise.",
        ],
      };
    }

    if (feasibility.committedStatus === "indeterminate" && !firstIndeterminate) {
      firstIndeterminate = feasibility;
    }
    if (feasibility.committedStatus === "infeasible") {
      lastInfeasible = feasibility;
    }
  }

  if (firstIndeterminate) {
    return {
      ...base,
      status: "indeterminate",
      candidates,
      blockingConstraints: firstIndeterminate.bindingConstraints,
      indeterminate: firstIndeterminate.indeterminate,
      supplierRemediation: firstIndeterminate.supplierRemediation,
      explanation: [
        "No deterministic firm promise can be issued within the current horizon because at least one candidate period depends on unresolved planning truth or resource allocation.",
        "Supplier remediation remains advisory and is not treated as committed supply until approved and represented as committed receipts.",
      ],
    };
  }

  const terminal = lastInfeasible ?? baseline;
  return {
    ...base,
    status: "not_available",
    candidates,
    blockingConstraints: terminal.bindingConstraints,
    indeterminate: terminal.indeterminate,
    supplierRemediation: terminal.supplierRemediation,
    explanation: [
      `No period from P${request.requestedPeriod} through P${model.horizonPeriods} can support the requested committed quantity using current governed material, committed receipts and finite resource capacity.`,
      "A later horizon, approved replenishment, approved substitute, capacity change, demand reallocation or revised commercial commitment must be evaluated before promising the order.",
    ],
  };
}
