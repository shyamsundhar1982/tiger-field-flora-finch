import {
  type AdvancedPlanningConstraintModel,
  type PlanningObjectiveWeights,
  validateAdvancedPlanningConstraintModel,
} from "./advanced-planning-constraints.ts";
import {
  evaluateDeterministicFeasibility,
  type DeterministicFeasibilityResult,
} from "./deterministic-feasibility.ts";

export const ADVANCED_OPTIMIZER_CONTRACT_VERSION = "VYNDI-ADVANCED-OPTIMIZER-0.1" as const;

export type AdvancedOptimizerClass = "lp" | "milp";
export type AdvancedOptimizationStatus = "optimal" | "feasible" | "infeasible" | "indeterminate" | "error";

export type AdvancedOptimizerMetadata = {
  id: string;
  version: string;
  solverClass: AdvancedOptimizerClass;
  engine: string;
  deterministic: boolean;
};

export type AdvancedOptimizationRequest = {
  requestId: string;
  maxRuntimeMs?: number;
  mipGap?: number;
};

export type AdvancedDemandOutcome = {
  demandId: string;
  servedQty: number;
  unmetQty: number;
  latenessPeriods: number;
};

export type AdvancedProductionDecision = {
  productId: string;
  period: number;
  quantity: number;
};

export type AdvancedProcurementDecision = {
  laneId: string;
  supplierId: string;
  sku: string;
  orderPeriod: number;
  receiptPeriod: number;
  quantity: number;
};

export type AdvancedResourceAssignment = {
  operationId: string;
  resourceId: string;
  period: number;
  quantity: number;
  loadHours: number;
};

export type AdvancedOptimizationSolution = {
  demandOutcomes: AdvancedDemandOutcome[];
  production: AdvancedProductionDecision[];
  procurement: AdvancedProcurementDecision[];
  resourceAssignments: AdvancedResourceAssignment[];
};

export type AdvancedObjectiveContribution = {
  objective: keyof PlanningObjectiveWeights;
  rawValue: number;
  weight: number;
  weightedValue: number;
};

export type AdvancedBindingConstraint = {
  code: string;
  entityType: "demand" | "material" | "resource" | "supplier_lane" | "cash" | "other";
  entityId: string;
  period?: number;
  slack?: number;
  shadowPrice?: number;
  message: string;
};

export type AdvancedOptimizationResult = {
  status: AdvancedOptimizationStatus;
  objectiveValue?: number;
  objectiveContributions?: AdvancedObjectiveContribution[];
  solution?: AdvancedOptimizationSolution;
  bindingConstraints: AdvancedBindingConstraint[];
  diagnostics: string[];
};

export interface AdvancedPlanningOptimizer {
  metadata: AdvancedOptimizerMetadata;
  solve(
    model: AdvancedPlanningConstraintModel,
    request: AdvancedOptimizationRequest,
  ): Promise<AdvancedOptimizationResult>;
}

export type AdvancedOptimizationValidationIssue = {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
};

export type GovernedAdvancedOptimizationRun = {
  contractVersion: typeof ADVANCED_OPTIMIZER_CONTRACT_VERSION;
  requestId: string;
  optimizer: AdvancedOptimizerMetadata;
  governance: {
    advisoryOnly: true;
    mayCreateTransactions: false;
    humanApprovalRequiredForBusinessAction: true;
  };
  baseline: DeterministicFeasibilityResult;
  result?: AdvancedOptimizationResult;
  accepted: boolean;
  issues: AdvancedOptimizationValidationIssue[];
};

function addIssue(
  issues: AdvancedOptimizationValidationIssue[],
  severity: AdvancedOptimizationValidationIssue["severity"],
  code: string,
  path: string,
  message: string,
) {
  issues.push({ severity, code, path, message });
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0;
}

function validPeriod(period: number, horizon: number) {
  return Number.isInteger(period) && period >= 1 && period <= horizon;
}

function validateMetadata(metadata: AdvancedOptimizerMetadata, issues: AdvancedOptimizationValidationIssue[]) {
  if (!metadata.id.trim()) addIssue(issues, "error", "OPTIMIZER_ID", "optimizer.id", "Optimizer ID is required.");
  if (!metadata.version.trim()) addIssue(issues, "error", "OPTIMIZER_VERSION", "optimizer.version", "Optimizer version is required.");
  if (!metadata.engine.trim()) addIssue(issues, "error", "OPTIMIZER_ENGINE", "optimizer.engine", "Optimizer engine identity is required.");
  if (metadata.solverClass !== "lp" && metadata.solverClass !== "milp") {
    addIssue(issues, "error", "OPTIMIZER_CLASS", "optimizer.solverClass", "Optimizer must declare LP or MILP solver class.");
  }
}

function validateObjective(
  model: AdvancedPlanningConstraintModel,
  result: AdvancedOptimizationResult,
  issues: AdvancedOptimizationValidationIssue[],
) {
  if (result.status !== "optimal" && result.status !== "feasible") return;
  if (!Number.isFinite(result.objectiveValue)) {
    addIssue(issues, "error", "OBJECTIVE_VALUE", "result.objectiveValue", "Feasible solver output requires a finite objective value.");
    return;
  }
  const contributions = result.objectiveContributions ?? [];
  const seen = new Set<keyof PlanningObjectiveWeights>();
  let total = 0;
  for (const [index, row] of contributions.entries()) {
    if (seen.has(row.objective)) {
      addIssue(issues, "error", "OBJECTIVE_DUPLICATE", `result.objectiveContributions[${index}]`, `Objective ${row.objective} is duplicated.`);
    }
    seen.add(row.objective);
    const expectedWeight = model.objectiveWeights[row.objective];
    if (!Number.isFinite(row.rawValue) || row.rawValue < 0) {
      addIssue(issues, "error", "OBJECTIVE_RAW_VALUE", `result.objectiveContributions[${index}].rawValue`, "Objective raw value must be finite and non-negative.");
    }
    if (row.weight !== expectedWeight) {
      addIssue(issues, "error", "OBJECTIVE_WEIGHT_MISMATCH", `result.objectiveContributions[${index}].weight`, `Objective ${row.objective} must use governed weight ${expectedWeight}.`);
    }
    const expectedWeighted = row.rawValue * row.weight;
    if (!Number.isFinite(row.weightedValue) || Math.abs(row.weightedValue - expectedWeighted) > 1e-6) {
      addIssue(issues, "error", "OBJECTIVE_WEIGHTED_VALUE", `result.objectiveContributions[${index}].weightedValue`, `Weighted value for ${row.objective} does not equal raw value × governed weight.`);
    }
    total += row.weightedValue;
  }
  if (Math.abs(total - (result.objectiveValue ?? 0)) > 1e-6) {
    addIssue(issues, "error", "OBJECTIVE_TOTAL_MISMATCH", "result.objectiveValue", "Objective value must equal the sum of declared weighted objective contributions.");
  }
}

function validateSolution(
  model: AdvancedPlanningConstraintModel,
  result: AdvancedOptimizationResult,
  issues: AdvancedOptimizationValidationIssue[],
) {
  const feasible = result.status === "optimal" || result.status === "feasible";
  if (feasible && !result.solution) {
    addIssue(issues, "error", "SOLUTION_MISSING", "result.solution", "Optimal/feasible solver output requires an explicit solution.");
    return;
  }
  if (!feasible && result.solution) {
    addIssue(issues, "warning", "SOLUTION_ON_NONFEASIBLE_STATUS", "result.solution", "Solution payload on a non-feasible status will not be treated as an executable proposal.");
  }
  const solution = result.solution;
  if (!solution) return;

  const demandIds = new Set(model.demands.map((row) => row.id));
  const productIds = new Set(model.demands.map((row) => row.productId));
  const laneById = new Map(model.supplierLanes.map((row) => [row.id, row]));
  const operationById = new Map(model.routingOperations.map((row) => [row.id, row]));
  const resourceIds = new Set(model.resources.map((row) => row.id));

  for (const [index, row] of solution.demandOutcomes.entries()) {
    if (!demandIds.has(row.demandId)) addIssue(issues, "error", "UNKNOWN_DEMAND", `result.solution.demandOutcomes[${index}].demandId`, `Unknown demand ${row.demandId}.`);
    if (!finiteNonNegative(row.servedQty) || !finiteNonNegative(row.unmetQty)) addIssue(issues, "error", "DEMAND_OUTCOME_QUANTITY", `result.solution.demandOutcomes[${index}]`, "Served and unmet quantities must be finite and non-negative.");
    if (!Number.isInteger(row.latenessPeriods) || row.latenessPeriods < 0) addIssue(issues, "error", "DEMAND_LATENESS", `result.solution.demandOutcomes[${index}].latenessPeriods`, "Lateness periods must be a non-negative integer.");
  }

  for (const [index, row] of solution.production.entries()) {
    if (!productIds.has(row.productId)) addIssue(issues, "error", "UNKNOWN_PRODUCT", `result.solution.production[${index}].productId`, `Unknown product ${row.productId}.`);
    if (!validPeriod(row.period, model.horizonPeriods)) addIssue(issues, "error", "PRODUCTION_PERIOD", `result.solution.production[${index}].period`, "Production period is outside the planning horizon.");
    if (!finiteNonNegative(row.quantity)) addIssue(issues, "error", "PRODUCTION_QUANTITY", `result.solution.production[${index}].quantity`, "Production quantity must be finite and non-negative.");
  }

  for (const [index, row] of solution.procurement.entries()) {
    const lane = laneById.get(row.laneId);
    if (!lane) {
      addIssue(issues, "error", "UNKNOWN_SUPPLIER_LANE", `result.solution.procurement[${index}].laneId`, `Unknown supplier lane ${row.laneId}.`);
    } else {
      if (row.supplierId !== lane.supplierId || row.sku !== lane.sku) addIssue(issues, "error", "SUPPLIER_LANE_IDENTITY", `result.solution.procurement[${index}]`, `Procurement decision identity does not match lane ${row.laneId}.`);
      if (!lane.approved) addIssue(issues, "error", "UNAPPROVED_SUPPLIER_LANE", `result.solution.procurement[${index}].laneId`, `Solver cannot propose procurement through unapproved lane ${row.laneId}.`);
      if (row.receiptPeriod - row.orderPeriod < lane.leadTimePeriods) addIssue(issues, "error", "SUPPLIER_LEAD_TIME", `result.solution.procurement[${index}]`, `Procurement decision violates governed lead time for lane ${row.laneId}.`);
      if (row.quantity > 0 && row.quantity + 1e-9 < lane.moq) addIssue(issues, "error", "SUPPLIER_MOQ", `result.solution.procurement[${index}].quantity`, `Procurement quantity is below MOQ for lane ${row.laneId}.`);
      if (row.quantity > 0 && lane.orderMultiple > 0) {
        const multiple = row.quantity / lane.orderMultiple;
        if (Math.abs(multiple - Math.round(multiple)) > 1e-6) addIssue(issues, "error", "SUPPLIER_ORDER_MULTIPLE", `result.solution.procurement[${index}].quantity`, `Procurement quantity violates order multiple for lane ${row.laneId}.`);
      }
    }
    if (!validPeriod(row.orderPeriod, model.horizonPeriods) || !validPeriod(row.receiptPeriod, model.horizonPeriods)) addIssue(issues, "error", "PROCUREMENT_PERIOD", `result.solution.procurement[${index}]`, "Procurement order/receipt periods must be inside the planning horizon.");
    if (!finiteNonNegative(row.quantity)) addIssue(issues, "error", "PROCUREMENT_QUANTITY", `result.solution.procurement[${index}].quantity`, "Procurement quantity must be finite and non-negative.");
  }

  for (const [index, row] of solution.resourceAssignments.entries()) {
    const operation = operationById.get(row.operationId);
    if (!operation) addIssue(issues, "error", "UNKNOWN_OPERATION", `result.solution.resourceAssignments[${index}].operationId`, `Unknown routing operation ${row.operationId}.`);
    if (!resourceIds.has(row.resourceId)) addIssue(issues, "error", "UNKNOWN_RESOURCE", `result.solution.resourceAssignments[${index}].resourceId`, `Unknown resource ${row.resourceId}.`);
    if (operation && !operation.eligibleResourceIds.includes(row.resourceId)) addIssue(issues, "error", "INELIGIBLE_RESOURCE", `result.solution.resourceAssignments[${index}].resourceId`, `Resource ${row.resourceId} is not eligible for operation ${row.operationId}.`);
    if (!validPeriod(row.period, model.horizonPeriods)) addIssue(issues, "error", "RESOURCE_ASSIGNMENT_PERIOD", `result.solution.resourceAssignments[${index}].period`, "Resource assignment period is outside the planning horizon.");
    if (!finiteNonNegative(row.quantity) || !finiteNonNegative(row.loadHours)) addIssue(issues, "error", "RESOURCE_ASSIGNMENT_QUANTITY", `result.solution.resourceAssignments[${index}]`, "Resource assignment quantity/load must be finite and non-negative.");
  }
}

function validateBindingConstraints(
  model: AdvancedPlanningConstraintModel,
  result: AdvancedOptimizationResult,
  issues: AdvancedOptimizationValidationIssue[],
) {
  for (const [index, row] of result.bindingConstraints.entries()) {
    if (!row.code.trim() || !row.entityId.trim() || !row.message.trim()) {
      addIssue(issues, "error", "BINDING_CONSTRAINT_IDENTITY", `result.bindingConstraints[${index}]`, "Binding constraints require code, entity ID and explanation.");
    }
    if (row.period !== undefined && !validPeriod(row.period, model.horizonPeriods)) {
      addIssue(issues, "error", "BINDING_CONSTRAINT_PERIOD", `result.bindingConstraints[${index}].period`, "Binding constraint period is outside the planning horizon.");
    }
    if (row.slack !== undefined && !Number.isFinite(row.slack)) addIssue(issues, "error", "BINDING_CONSTRAINT_SLACK", `result.bindingConstraints[${index}].slack`, "Constraint slack must be finite when supplied.");
    if (row.shadowPrice !== undefined && !Number.isFinite(row.shadowPrice)) addIssue(issues, "error", "BINDING_CONSTRAINT_SHADOW_PRICE", `result.bindingConstraints[${index}].shadowPrice`, "Shadow price must be finite when supplied.");
  }
}

export async function runGovernedAdvancedOptimizer(
  model: AdvancedPlanningConstraintModel,
  optimizer: AdvancedPlanningOptimizer,
  request: AdvancedOptimizationRequest,
): Promise<GovernedAdvancedOptimizationRun> {
  const issues: AdvancedOptimizationValidationIssue[] = [];
  const governance = {
    advisoryOnly: true as const,
    mayCreateTransactions: false as const,
    humanApprovalRequiredForBusinessAction: true as const,
  };
  validateMetadata(optimizer.metadata, issues);
  if (!request.requestId.trim()) addIssue(issues, "error", "REQUEST_ID", "request.requestId", "Optimization request ID is required.");
  if (request.maxRuntimeMs !== undefined && (!Number.isFinite(request.maxRuntimeMs) || request.maxRuntimeMs <= 0)) addIssue(issues, "error", "MAX_RUNTIME", "request.maxRuntimeMs", "Maximum runtime must be greater than zero when supplied.");
  if (request.mipGap !== undefined && (!Number.isFinite(request.mipGap) || request.mipGap < 0 || request.mipGap > 1)) addIssue(issues, "error", "MIP_GAP", "request.mipGap", "MIP gap must be between zero and one.");

  const modelValidation = validateAdvancedPlanningConstraintModel(model);
  for (const row of modelValidation.issues.filter((row) => row.severity === "error")) {
    addIssue(issues, "error", `MODEL_${row.code}`, row.path, row.message);
  }
  const baseline = evaluateDeterministicFeasibility(model);

  if (issues.some((row) => row.severity === "error")) {
    return {
      contractVersion: ADVANCED_OPTIMIZER_CONTRACT_VERSION,
      requestId: request.requestId,
      optimizer: optimizer.metadata,
      governance,
      baseline,
      accepted: false,
      issues,
    };
  }

  let result: AdvancedOptimizationResult;
  try {
    result = await optimizer.solve(model, request);
  } catch (error) {
    addIssue(issues, "error", "SOLVER_EXCEPTION", "optimizer.solve", error instanceof Error ? error.message : String(error));
    return {
      contractVersion: ADVANCED_OPTIMIZER_CONTRACT_VERSION,
      requestId: request.requestId,
      optimizer: optimizer.metadata,
      governance,
      baseline,
      accepted: false,
      issues,
    };
  }

  validateObjective(model, result, issues);
  validateSolution(model, result, issues);
  validateBindingConstraints(model, result, issues);
  if (!Array.isArray(result.diagnostics)) addIssue(issues, "error", "DIAGNOSTICS", "result.diagnostics", "Solver diagnostics must be an array.");

  return {
    contractVersion: ADVANCED_OPTIMIZER_CONTRACT_VERSION,
    requestId: request.requestId,
    optimizer: optimizer.metadata,
    governance,
    baseline,
    result,
    accepted: !issues.some((row) => row.severity === "error"),
    issues,
  };
}
