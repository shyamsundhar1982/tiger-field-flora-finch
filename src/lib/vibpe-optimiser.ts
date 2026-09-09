import { evaluateScenario, type IbpeScenarioComparison, type IbpeScenarioRequest } from "@/lib/ibpe-scenario-lab";
import type { Sql } from "@/lib/db";

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

function scoreScenario(
  comparison: IbpeScenarioComparison,
  result: {
    funding: { incrementalFundingNeedLakh: number };
    summary: {
      minimumFreeLiquidityAfterRecommendationsLakh: number;
      capacityShortfallMonths: number;
      findingCounts: { critical: number; high: number };
    };
  },
  goal: VibpeOptimisationGoal,
) {
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
  if (comparison.fundingNeedDeltaLakh > 0) rationale.push(`Funding need worsens by ₹${comparison.fundingNeedDeltaLakh.toFixed(1)}L versus governed baseline.`);
  if (comparison.minimumFreeLiquidityAfterRecommendationsDeltaLakh < 0) rationale.push(`Liquidity deteriorates by ₹${Math.abs(comparison.minimumFreeLiquidityAfterRecommendationsDeltaLakh).toFixed(1)}L versus governed baseline.`);
  if (!rationale.length) rationale.push("Candidate satisfies the supplied optimisation guardrails before governance review.");

  return { score: Math.max(0, score), rationale };
}

export async function rankVibpeCandidates(
  sql: Sql,
  candidates: IbpeScenarioRequest[],
  goal: VibpeOptimisationGoal,
): Promise<VibpeCandidate[]> {
  const ranked = await Promise.all(
    candidates.map(async (scenario) => {
      const packet = await evaluateScenario(sql, scenario);
      const judged = scoreScenario(packet.comparison, packet.result, goal);
      return { scenario: packet.scenario, comparison: packet.comparison, ...judged };
    }),
  );
  return ranked.sort((a, b) => b.score - a.score);
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
