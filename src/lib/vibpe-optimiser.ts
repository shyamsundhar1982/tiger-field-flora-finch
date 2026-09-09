import { evaluateScenario, type IbpeScenarioComparison, type IbpeScenarioRequest } from "@/lib/ibpe-scenario-lab";
import type { IntegratedPlanningResult } from "@/lib/integrated-business-planning-engine";

export type VibpeCandidate = {
  scenario: IbpeScenarioRequest;
  comparison: IbpeScenarioComparison;
  score: number;
  rationale: string[];
};

export type VibpeOptimisationGoal = {
  maxFundingNeedLakh?: number;
  minFreeLiquidityLakh?: number;
  maxCapacityShortfallMonths?: number;
};

function scoreComparison(comparison: IbpeScenarioComparison, goal: VibpeOptimisationGoal) {
  const result = comparison.scenario;
  let score = 100;
  const rationale: string[] = [];

  const fundingNeed = result.funding.incrementalFundingNeedLakh;
  const minimumLiquidity = result.summary.minimumFreeLiquidityAfterRecommendationsLakh;
  const capacityShortfalls = result.summary.capacityShortfallMonths;

  if (goal.maxFundingNeedLakh != null && fundingNeed > goal.maxFundingNeedLakh) {
    const penalty = Math.min(60, (fundingNeed - goal.maxFundingNeedLakh) * 2);
    score -= penalty;
    rationale.push(`Funding need exceeds target by ₹${(fundingNeed - goal.maxFundingNeedLakh).toFixed(1)}L.`);
  }
  if (goal.minFreeLiquidityLakh != null && minimumLiquidity < goal.minFreeLiquidityLakh) {
    const penalty = Math.min(60, (goal.minFreeLiquidityLakh - minimumLiquidity) * 2);
    score -= penalty;
    rationale.push(`Minimum liquidity misses reserve target by ₹${(goal.minFreeLiquidityLakh - minimumLiquidity).toFixed(1)}L.`);
  }
  if (goal.maxCapacityShortfallMonths != null && capacityShortfalls > goal.maxCapacityShortfallMonths) {
    score -= Math.min(40, (capacityShortfalls - goal.maxCapacityShortfallMonths) * 8);
    rationale.push(`${capacityShortfalls} capacity-shortfall months exceed target.`);
  }
  score -= result.summary.findingCounts.critical * 10;
  score -= result.summary.findingCounts.high * 2;
  if (!rationale.length) rationale.push("Candidate satisfies the supplied optimisation guardrails before governance review.");

  return { score: Math.max(0, score), rationale };
}

export function rankVibpeCandidates(
  governedBaseline: IntegratedPlanningResult,
  candidates: IbpeScenarioRequest[],
  goal: VibpeOptimisationGoal,
): VibpeCandidate[] {
  return candidates
    .map((scenario) => {
      const comparison = evaluateScenario(governedBaseline, scenario);
      const judged = scoreComparison(comparison, goal);
      return { scenario, comparison, ...judged };
    })
    .sort((a, b) => b.score - a.score);
}

export function buildFundingPaceCandidates(maxFundingLakh: number, horizon = 6): IbpeScenarioRequest[] {
  const fundingSteps = [...new Set([0, Math.round(maxFundingLakh * 0.4), Math.round(maxFundingLakh * 0.7), Math.round(maxFundingLakh)])];
  const demandMultipliers = [1, 0.95, 0.9, 0.85];
  return fundingSteps.flatMap((funding) =>
    demandMultipliers.map((demandMultiplier) => ({
      id: `opt-f${funding}-d${Math.round(demandMultiplier * 100)}`,
      label: `Funding ₹${funding}L · demand ${(demandMultiplier * 100).toFixed(0)}%`,
      demandMultiplier,
      capacityMultiplier: 1,
      procurementCostMultiplier: 1,
      leadTimeMultiplier: 1,
      receiptDelayMonths: 0,
      cashInjectionLakh: funding,
      cashInjectionPeriod: Math.max(1, Math.min(36, horizon)),
    })),
  );
}
