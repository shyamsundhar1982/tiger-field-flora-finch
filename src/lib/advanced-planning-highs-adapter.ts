import type { AdvancedPlanningConstraintModel } from "./advanced-planning-constraints.ts";
import {
  compileAdvancedPlanningMathematicalModel,
  type AdvancedPlanningMathematicalModel,
  type MathConstraint,
  type MathTerm,
} from "./advanced-planning-math-model.ts";
import type {
  AdvancedBindingConstraint,
  AdvancedOptimizationRequest,
  AdvancedOptimizationResult,
  AdvancedPlanningOptimizer,
} from "./advanced-planning-optimizer.ts";

export const VYNDI_HIGHS_ADAPTER_VERSION = "VYNDI-HIGHS-ADAPTER-0.1" as const;
const EPSILON = 1e-7;

export type HighsColumnLike = { Primal: number; [key: string]: unknown };
export type HighsRowLike = { Name: string; Primal: number; [key: string]: unknown };
export type HighsLegacySolutionLike = {
  Status: string;
  ObjectiveValue?: number;
  Columns?: Record<string, HighsColumnLike>;
  Rows?: HighsRowLike[];
};
export type HighsLegacyLike = {
  solve(problem: string, options?: Record<string, unknown>): HighsLegacySolutionLike;
};

function finite(value: number) {
  return Number.isFinite(value);
}

function normalizeNumber(value: number) {
  if (!finite(value)) throw new Error(`Non-finite LP coefficient ${value}.`);
  if (Math.abs(value) <= 1e-12) return "0";
  return Number(value.toPrecision(14)).toString();
}

function termText(term: MathTerm, first: boolean) {
  const sign = term.coefficient < 0 ? "-" : "+";
  const abs = Math.abs(term.coefficient);
  const coefficient = Math.abs(abs - 1) <= 1e-12 ? "" : `${normalizeNumber(abs)} `;
  return `${first && sign === "+" ? "" : `${sign} `}${coefficient}${term.variableId}`;
}

function expressionText(terms: MathTerm[]) {
  const nonZero = terms.filter((term) => Math.abs(term.coefficient) > 1e-12);
  if (!nonZero.length) return "0";
  return nonZero.map((term, index) => termText(term, index === 0)).join(" ");
}

function constraintOperator(row: MathConstraint) {
  if (row.sense === "le") return "<=";
  if (row.sense === "ge") return ">=";
  return "=";
}

export function encodeAdvancedMathModelToCplexLp(model: AdvancedPlanningMathematicalModel) {
  const lines: string[] = ["Minimize"];
  const objectiveTerms = model.variables
    .filter((row) => Math.abs(row.objectiveCoefficient) > 1e-12)
    .map((row) => ({ variableId: row.id, coefficient: row.objectiveCoefficient }));
  lines.push(` obj: ${expressionText(objectiveTerms)}`);
  lines.push("Subject To");
  for (const row of model.constraints) {
    lines.push(` ${row.id}: ${expressionText(row.terms)} ${constraintOperator(row)} ${normalizeNumber(row.rhs)}`);
  }
  lines.push("Bounds");
  for (const row of model.variables.filter((variable) => variable.type === "continuous")) {
    if (row.upperBound === undefined) lines.push(` ${normalizeNumber(row.lowerBound)} <= ${row.id}`);
    else lines.push(` ${normalizeNumber(row.lowerBound)} <= ${row.id} <= ${normalizeNumber(row.upperBound)}`);
  }
  const integer = model.variables.filter((row) => row.type === "integer");
  if (integer.length) {
    for (const row of integer) {
      if (row.upperBound === undefined) lines.push(` ${normalizeNumber(row.lowerBound)} <= ${row.id}`);
      else lines.push(` ${normalizeNumber(row.lowerBound)} <= ${row.id} <= ${normalizeNumber(row.upperBound)}`);
    }
    lines.push("General");
    for (const row of integer) lines.push(` ${row.id}`);
  }
  const binary = model.variables.filter((row) => row.type === "binary");
  if (binary.length) {
    lines.push("Binary");
    for (const row of binary) lines.push(` ${row.id}`);
  }
  lines.push("End");
  return `${lines.join("\n")}\n`;
}

function clean(value: string) {
  return value.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "X";
}
function id(prefix: string, ...parts: Array<string | number>) {
  return [prefix, ...parts.map((part) => clean(String(part)))].join("__");
}

function primal(solution: HighsLegacySolutionLike, variableId: string) {
  const value = solution.Columns?.[variableId]?.Primal ?? 0;
  return finite(value) && Math.abs(value) > EPSILON ? value : 0;
}

function hasPrimalSolution(solution: HighsLegacySolutionLike) {
  return Boolean(solution.Columns && Object.values(solution.Columns).some((row) => finite(row.Primal)));
}

function mapStatus(solution: HighsLegacySolutionLike): AdvancedOptimizationResult["status"] {
  const status = solution.Status.toLowerCase();
  if (status === "optimal" || status === "empty") return "optimal";
  if (status === "infeasible") return "infeasible";
  if (
    status.includes("time limit") ||
    status.includes("iteration limit") ||
    status.includes("solution limit") ||
    status.includes("objective target")
  ) {
    return hasPrimalSolution(solution) ? "feasible" : "indeterminate";
  }
  if (status.includes("error")) return "error";
  return "indeterminate";
}

function constraintEntityType(idValue: string): AdvancedBindingConstraint["entityType"] {
  if (idValue.startsWith("DEMAND_")) return "demand";
  if (idValue.startsWith("MATERIAL_")) return "material";
  if (idValue.startsWith("RESOURCE_")) return "resource";
  if (idValue.startsWith("SUP_")) return "supplier_lane";
  return "other";
}

function bindingConstraints(math: AdvancedPlanningMathematicalModel, solution: HighsLegacySolutionLike) {
  const byName = new Map((solution.Rows ?? []).map((row) => [row.Name, row]));
  const result: AdvancedBindingConstraint[] = [];
  for (const constraint of math.constraints) {
    const row = byName.get(constraint.id);
    if (!row || !finite(row.Primal)) continue;
    const slack = constraint.sense === "le"
      ? constraint.rhs - row.Primal
      : constraint.sense === "ge"
        ? row.Primal - constraint.rhs
        : Math.abs(row.Primal - constraint.rhs);
    if (Math.abs(slack) > 1e-6) continue;
    result.push({
      code: constraint.id.split("__")[0],
      entityType: constraintEntityType(constraint.id),
      entityId: constraint.id,
      slack: Math.max(0, slack),
      message: constraint.semantic,
    });
  }
  return result;
}

function reconstructSolution(
  source: AdvancedPlanningConstraintModel,
  solution: HighsLegacySolutionLike,
) {
  const demandOutcomes = source.demands.map((demand) => {
    const unmetQty = primal(solution, id("UNMET", demand.id));
    let servedQty = 0;
    let latenessPeriods = 0;
    for (let delivery = demand.period; delivery <= source.horizonPeriods; delivery += 1) {
      const quantity = primal(solution, id("FULFILL", demand.id, delivery));
      servedQty += quantity;
      if (quantity > EPSILON) latenessPeriods = Math.max(latenessPeriods, delivery - demand.period);
    }
    return { demandId: demand.id, servedQty, unmetQty, latenessPeriods };
  });

  const products = [...new Set(source.demands.map((row) => row.productId))].sort();
  const production = products.flatMap((productId) =>
    Array.from({ length: source.horizonPeriods }, (_, index) => {
      const period = index + 1;
      return { productId, period, quantity: primal(solution, id("PROD", productId, period)) };
    }).filter((row) => row.quantity > EPSILON),
  );

  const procurement = source.supplierLanes
    .filter((lane) => lane.approved)
    .flatMap((lane) =>
      Array.from({ length: source.horizonPeriods }, (_, index) => {
        const orderPeriod = index + 1;
        const receiptPeriod = orderPeriod + lane.leadTimePeriods;
        if (receiptPeriod > source.horizonPeriods) return null;
        const lots = primal(solution, id("PROC_LOTS", lane.id, orderPeriod));
        const quantity = lots * lane.orderMultiple;
        return quantity > EPSILON
          ? { laneId: lane.id, supplierId: lane.supplierId, sku: lane.sku, orderPeriod, receiptPeriod, quantity }
          : null;
      }).filter((row): row is NonNullable<typeof row> => Boolean(row)),
    );

  const resourceAssignments = source.routingOperations.flatMap((operation) =>
    operation.eligibleResourceIds.flatMap((resourceId) =>
      Array.from({ length: source.horizonPeriods }, (_, index) => {
        const period = index + 1;
        const quantity = primal(solution, id("ASSIGN", operation.id, resourceId, period));
        if (quantity <= EPSILON) return null;
        const active = primal(solution, id("OP_ACTIVE", operation.id, resourceId, period)) > 0.5;
        const loadHours = quantity * operation.runHoursPerUnit / (operation.yieldPct ?? 1) + (active ? operation.setupHours ?? 0 : 0);
        return { operationId: operation.id, resourceId, period, quantity, loadHours };
      }).filter((row): row is NonNullable<typeof row> => Boolean(row)),
    ),
  );

  return { demandOutcomes, production, procurement, resourceAssignments };
}

function objectiveContributions(math: AdvancedPlanningMathematicalModel, solution: HighsLegacySolutionLike) {
  const raw = new Map<keyof AdvancedPlanningMathematicalModel["objectiveWeights"], number>();
  for (const variable of math.variables) {
    if (!variable.objectiveKey || variable.objectiveRawFactor === undefined) continue;
    const contribution = primal(solution, variable.id) * variable.objectiveRawFactor;
    raw.set(variable.objectiveKey, (raw.get(variable.objectiveKey) ?? 0) + contribution);
  }
  return [...raw.entries()].map(([objective, rawValue]) => {
    const weight = math.objectiveWeights[objective];
    return { objective, rawValue, weight, weightedValue: rawValue * weight };
  });
}

export function createHighsAdvancedPlanningOptimizer(highs: HighsLegacyLike): AdvancedPlanningOptimizer {
  return {
    metadata: {
      id: "vyndi-highs-wasm",
      version: VYNDI_HIGHS_ADAPTER_VERSION,
      solverClass: "milp",
      engine: "HiGHS Wasm",
      deterministic: true,
    },
    async solve(source, request: AdvancedOptimizationRequest): Promise<AdvancedOptimizationResult> {
      const compiled = compileAdvancedPlanningMathematicalModel(source);
      if (!compiled.valid || !compiled.model) {
        return {
          status: "error",
          bindingConstraints: [],
          diagnostics: compiled.issues.map((issue) => `${issue.code}: ${issue.message}`),
        };
      }
      const math = compiled.model;
      const lp = encodeAdvancedMathModelToCplexLp(math);
      const highsSolution = highs.solve(lp, {
        output_flag: false,
        log_to_console: false,
        parallel: "off",
        threads: 1,
        random_seed: 0,
        ...(request.maxRuntimeMs ? { time_limit: request.maxRuntimeMs / 1000 } : {}),
        ...(request.mipGap !== undefined ? { mip_rel_gap: request.mipGap } : {}),
      });
      const status = mapStatus(highsSolution);
      const diagnostics = [
        `HiGHS status: ${highsSolution.Status}`,
        ...compiled.issues.map((issue) => `${issue.code}: ${issue.message}`),
      ];
      if (status !== "optimal" && status !== "feasible") {
        return { status, bindingConstraints: bindingConstraints(math, highsSolution), diagnostics };
      }
      const contributions = objectiveContributions(math, highsSolution);
      const objectiveValue = contributions.reduce((sum, row) => sum + row.weightedValue, 0);
      if (finite(highsSolution.ObjectiveValue ?? Number.NaN) && Math.abs((highsSolution.ObjectiveValue ?? 0) - objectiveValue) > 1e-5) {
        diagnostics.push(`Solver objective ${highsSolution.ObjectiveValue} differs from governed reconstructed objective ${objectiveValue}.`);
      }
      return {
        status,
        objectiveValue,
        objectiveContributions: contributions,
        solution: reconstructSolution(source, highsSolution),
        bindingConstraints: bindingConstraints(math, highsSolution),
        diagnostics,
      };
    },
  };
}
