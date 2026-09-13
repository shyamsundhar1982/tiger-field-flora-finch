import type { AdvancedPlanningConstraintModel } from "./advanced-planning-constraints.ts";
import {
  compileAdvancedPlanningMathematicalModel,
  type AdvancedPlanningMathematicalModel,
  type MathConstraint,
  type MathVariable,
} from "./advanced-planning-math-model.ts";

const EPSILON = 1e-7;
const DEFAULT_WITNESS_LIMIT = 25;

export type InfeasibilityBoundWitness = {
  constraintId: string;
  constraintFamily: string;
  semantic: string;
  sense: MathConstraint["sense"];
  rhs: number;
  minPossibleLhs: number;
  maxPossibleLhs: number;
  violationGap: number;
  variableCount: number;
};

export type AdvancedPlanningInfeasibilityDiagnosis = {
  method: "constraint-bound-propagation-v1";
  totalBoundContradictions: number;
  witnesses: InfeasibilityBoundWitness[];
  diagnostics: string[];
};

function family(constraintId: string) {
  return constraintId.split("__")[0] || "OTHER";
}

function addBoundContribution(
  coefficient: number,
  variable: MathVariable,
  interval: { min: number; max: number },
) {
  const lower = variable.lowerBound;
  const upper = variable.upperBound ?? Number.POSITIVE_INFINITY;

  if (coefficient >= 0) {
    interval.min += coefficient * lower;
    interval.max += upper === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : coefficient * upper;
    return;
  }

  interval.min += upper === Number.POSITIVE_INFINITY
    ? Number.NEGATIVE_INFINITY
    : coefficient * upper;
  interval.max += coefficient * lower;
}

function intervalForConstraint(
  math: AdvancedPlanningMathematicalModel,
  constraint: MathConstraint,
) {
  const variableById = new Map(math.variables.map((row) => [row.id, row]));
  const interval = { min: 0, max: 0 };

  for (const term of constraint.terms) {
    const variable = variableById.get(term.variableId);
    if (!variable) continue;
    addBoundContribution(term.coefficient, variable, interval);
  }
  return interval;
}

function contradictionGap(
  constraint: MathConstraint,
  minPossibleLhs: number,
  maxPossibleLhs: number,
) {
  if (constraint.sense === "ge") {
    return maxPossibleLhs < constraint.rhs - EPSILON
      ? constraint.rhs - maxPossibleLhs
      : 0;
  }
  if (constraint.sense === "le") {
    return minPossibleLhs > constraint.rhs + EPSILON
      ? minPossibleLhs - constraint.rhs
      : 0;
  }
  if (constraint.rhs < minPossibleLhs - EPSILON) return minPossibleLhs - constraint.rhs;
  if (constraint.rhs > maxPossibleLhs + EPSILON) return constraint.rhs - maxPossibleLhs;
  return 0;
}

function numeric(value: number) {
  if (value === Number.POSITIVE_INFINITY) return "+∞";
  if (value === Number.NEGATIVE_INFINITY) return "−∞";
  if (Math.abs(value) < EPSILON) return "0";
  return Number(value.toFixed(6)).toString();
}

function requirementText(witness: InfeasibilityBoundWitness) {
  if (witness.sense === "ge") return `LHS >= ${numeric(witness.rhs)}`;
  if (witness.sense === "le") return `LHS <= ${numeric(witness.rhs)}`;
  return `LHS = ${numeric(witness.rhs)}`;
}

function witnessText(witness: InfeasibilityBoundWitness) {
  return [
    `INFEASIBILITY_WITNESS ${witness.constraintId}:`,
    witness.semantic + ".",
    `Governed variable bounds permit LHS in [${numeric(witness.minPossibleLhs)}, ${numeric(witness.maxPossibleLhs)}]`,
    `but the constraint requires ${requirementText(witness)}.`,
    `Minimum bound relaxation: ${numeric(witness.violationGap)}.`,
  ].join(" ");
}

export function diagnoseAdvancedPlanningInfeasibility(
  source: AdvancedPlanningConstraintModel,
  witnessLimit = DEFAULT_WITNESS_LIMIT,
): AdvancedPlanningInfeasibilityDiagnosis {
  const compiled = compileAdvancedPlanningMathematicalModel(source);
  if (!compiled.valid || !compiled.model) {
    return {
      method: "constraint-bound-propagation-v1",
      totalBoundContradictions: 0,
      witnesses: [],
      diagnostics: [
        "INFEASIBILITY_ANALYSIS unavailable because the governed mathematical model did not compile successfully.",
      ],
    };
  }

  const contradictions = compiled.model.constraints
    .map((constraint) => {
      const interval = intervalForConstraint(compiled.model!, constraint);
      const gap = contradictionGap(constraint, interval.min, interval.max);
      if (!(gap > EPSILON) || !Number.isFinite(gap)) return null;
      return {
        constraintId: constraint.id,
        constraintFamily: family(constraint.id),
        semantic: constraint.semantic,
        sense: constraint.sense,
        rhs: constraint.rhs,
        minPossibleLhs: interval.min,
        maxPossibleLhs: interval.max,
        violationGap: gap,
        variableCount: constraint.terms.length,
      } satisfies InfeasibilityBoundWitness;
    })
    .filter((row): row is InfeasibilityBoundWitness => Boolean(row))
    .sort(
      (a, b) =>
        b.violationGap - a.violationGap ||
        a.constraintFamily.localeCompare(b.constraintFamily) ||
        a.constraintId.localeCompare(b.constraintId),
    );

  const boundedLimit = Number.isInteger(witnessLimit) && witnessLimit > 0
    ? witnessLimit
    : DEFAULT_WITNESS_LIMIT;
  const witnesses = contradictions.slice(0, boundedLimit);
  const diagnostics = [
    `INFEASIBILITY_ANALYSIS method=constraint-bound-propagation-v1 boundContradictions=${contradictions.length}. These are constraints that cannot be satisfied even at the most favourable governed variable bounds; they are exact infeasibility witnesses, not heuristic shortage warnings.`,
    ...witnesses.map(witnessText),
  ];
  if (contradictions.length > witnesses.length) {
    diagnostics.push(
      `INFEASIBILITY_ANALYSIS_TRUNCATED showing ${witnesses.length} of ${contradictions.length} exact bound contradictions.`,
    );
  }
  if (contradictions.length === 0) {
    diagnostics.push(
      "INFEASIBILITY_ANALYSIS found no single constraint contradicted by variable bounds; infeasibility therefore depends on interaction among multiple constraints and requires a deeper conflict-refinement pass.",
    );
  }

  return {
    method: "constraint-bound-propagation-v1",
    totalBoundContradictions: contradictions.length,
    witnesses,
    diagnostics,
  };
}
