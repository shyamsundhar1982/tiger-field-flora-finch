import {
  runIntegratedBusinessPlanningEngine,
  type DecisionRecommendation,
  type FundingOutlook,
  type IntegratedPlanningInput,
  type IntegratedPlanningResult,
  type PlanningEngineOptions,
  type PlanningFinding,
  type PlanningSeverity,
} from "./integrated-business-planning-engine.ts";

/**
 * Workbook/runtime controls that must participate in the governed input hash.
 * Keeping them inside input_json makes every persisted result reproducible from
 * the same approved plan snapshot without a later database lookup.
 */
export type RuntimeIbpeInput = IntegratedPlanningInput & {
  runtimeControls?: {
    paymentLagBySku?: Record<string, number>;
  };
};

export type RuntimeIbpeResult = IntegratedPlanningResult & {
  runtimeParity: {
    paymentLagApplied: true;
    deferredProcurementBeyondHorizonLakh: number;
    capacityShortfallConstraintRows: number;
    capacityShortfallUniqueMonths: number;
  };
};

const severityRank: Record<PlanningSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const severityPenalty: Record<PlanningSeverity, number> = {
  critical: 25,
  high: 12,
  medium: 5,
  low: 2,
};

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function nonNegative(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function paymentLag(input: RuntimeIbpeInput, sku: string) {
  return Math.ceil(nonNegative(input.runtimeControls?.paymentLagBySku?.[sku]));
}

function fundingOutlook(
  input: RuntimeIbpeInput,
  cash: IntegratedPlanningResult["cash"],
): FundingOutlook {
  const minimumBase = cash.reduce(
    (minimum, row) => Math.min(minimum, row.freeLiquidityLakh),
    Number.POSITIVE_INFINITY,
  );
  const minimumAfter = cash.reduce(
    (minimum, row) => Math.min(minimum, row.freeLiquidityAfterRecommendationsLakh),
    Number.POSITIVE_INFINITY,
  );
  const firstBaseBreach = cash.find((row) => row.freeLiquidityLakh < 0)?.period ?? null;
  const firstAfterBreach = cash.find((row) => row.freeLiquidityAfterRecommendationsLakh < 0)?.period ?? null;
  const fundraisingLeadMonths = Math.ceil(nonNegative(input.funding.fundraisingLeadMonths));
  const fundingActionPeriod = firstAfterBreach === null
    ? null
    : Math.max(1, firstAfterBreach - fundraisingLeadMonths);

  return {
    firstBaseLiquidityBreachPeriod: firstBaseBreach,
    firstLiquidityBreachAfterRecommendationsPeriod: firstAfterBreach,
    fundingActionPeriod,
    minimumBaseFreeLiquidityLakh: Number.isFinite(minimumBase) ? round(minimumBase) : 0,
    minimumFreeLiquidityAfterRecommendationsLakh: Number.isFinite(minimumAfter) ? round(minimumAfter) : 0,
    incrementalFundingNeedLakh: round(Math.max(0, -minimumAfter)),
  };
}

function rebuildFundingFinding(
  base: IntegratedPlanningResult,
  funding: FundingOutlook,
  nearTermRiskMonths: number,
): PlanningFinding[] {
  const findings = base.findings.filter((finding) => finding.domain !== "funding");
  const breach = funding.firstLiquidityBreachAfterRecommendationsPeriod;
  if (breach === null) return findings;

  findings.push({
    id: `funding:liquidity-breach-${breach}`,
    severity: breach <= nearTermRiskMonths ? "critical" : "high",
    domain: "funding",
    title: "Free liquidity falls below operating reserve",
    problem: `Liquidity becomes negative in M${breach} after payment-lag-adjusted analytical replenishment recommendations.`,
    businessImpact: "The current operating plan and supply response are not fully funded at the stated reserve policy.",
    recommendedAction: `Start funding/cost/pace action by M${funding.fundingActionPeriod ?? breach}; do not convert unfunded recommendations into commitments automatically.`,
    evidence: [{ label: `Funding need ${round(funding.incrementalFundingNeedLakh)}L`, period: breach }],
  });

  return findings.sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity] || a.domain.localeCompare(b.domain),
  );
}

function rebuildDecisions(
  base: IntegratedPlanningResult,
  findings: PlanningFinding[],
  funding: FundingOutlook,
): DecisionRecommendation[] {
  const retained = base.decisions.filter((decision) => decision.domain !== "funding");
  const fundingFinding = findings.find((finding) => finding.domain === "funding");
  const breach = funding.firstLiquidityBreachAfterRecommendationsPeriod;

  if (fundingFinding) {
    retained.push({
      id: `decision:${fundingFinding.id}`,
      severity: fundingFinding.severity,
      domain: "funding",
      title: fundingFinding.title,
      decision: fundingFinding.recommendedAction,
      rationale: [fundingFinding.problem, fundingFinding.businessImpact],
      operationalImpact: fundingFinding.businessImpact,
      affectedPeriods: breach === null ? [] : [breach],
      confidence: fundingFinding.severity === "critical" ? 0.95 : 0.85,
      evidence: fundingFinding.evidence,
      requiresApproval: true,
    });
  }

  if (breach !== null) {
    retained.unshift({
      id: "decision:funding-pace-gate",
      severity: breach <= 3 ? "critical" : "high",
      domain: "funding",
      title: "Funding / operating pace gate",
      decision: `Approve funding, cost reduction, procurement staging or schedule slowdown before M${funding.fundingActionPeriod ?? breach}.`,
      rationale: [
        `Minimum free liquidity after payment-lag-adjusted recommendations is ${funding.minimumFreeLiquidityAfterRecommendationsLakh}L.`,
        `Analytical replenishment recommendations total ${base.summary.totalRecommendedProcurementLakh}L.`,
      ],
      financialImpactLakh: funding.incrementalFundingNeedLakh,
      operationalImpact: "Keeps the 36-month plan dynamically tied to available capital and controlled supplier payment timing.",
      affectedPeriods: [breach],
      confidence: 0.95,
      evidence: [{ label: `Funding need ${funding.incrementalFundingNeedLakh}L`, period: breach }],
      requiresApproval: true,
    });
  }

  return retained.slice(0, 12);
}

/**
 * Canonical governed runtime adapter for workbook v5 parity.
 *
 * The core IBPE remains deterministic and side-effect free. This adapter applies
 * workbook payment-lag semantics to analytical procurement cash timing, then
 * reconciles funding and summary semantics without creating any transaction.
 */
export function runRuntimeIbpe(
  input: RuntimeIbpeInput,
  options: Partial<PlanningEngineOptions> = {},
): RuntimeIbpeResult {
  const horizon = Math.max(1, Math.round(Number(options.horizonMonths ?? 36)));
  const nearTermRiskMonths = Math.max(0, Math.round(Number(options.nearTermRiskMonths ?? 3)));
  const base = runIntegratedBusinessPlanningEngine(input, { ...options, horizonMonths: horizon });

  const procurementByPaymentPeriod = new Map<number, number>();
  let deferredProcurementBeyondHorizonLakh = 0;

  for (const row of base.supply) {
    const purchaseCost = nonNegative(row.purchaseCostLakh);
    if (purchaseCost <= 0) continue;
    const duePeriod = row.orderByPeriod + paymentLag(input, row.sku);
    if (duePeriod > horizon) {
      deferredProcurementBeyondHorizonLakh += purchaseCost;
      continue;
    }
    const period = Math.max(1, duePeriod);
    procurementByPaymentPeriod.set(
      period,
      (procurementByPaymentPeriod.get(period) ?? 0) + purchaseCost,
    );
  }

  const restrictedCash = nonNegative(input.funding.restrictedCashLakh);
  const minimumReserve = nonNegative(input.funding.minimumOperatingReserveLakh);
  let baseCash = Number(input.funding.openingBankCashLakh) || 0;
  let plannedCash = baseCash;

  const cash = base.cash.map((row) => {
    const incrementalProcurementLakh = procurementByPaymentPeriod.get(row.period) ?? 0;
    baseCash += row.selectedInflowsLakh - row.selectedOutflowsLakh;
    plannedCash += row.selectedInflowsLakh - row.selectedOutflowsLakh - incrementalProcurementLakh;
    return {
      ...row,
      incrementalProcurementLakh: round(incrementalProcurementLakh),
      closingCashLakh: round(baseCash),
      freeLiquidityLakh: round(baseCash - restrictedCash - minimumReserve),
      closingCashAfterRecommendationsLakh: round(plannedCash),
      freeLiquidityAfterRecommendationsLakh: round(plannedCash - restrictedCash - minimumReserve),
    };
  });

  const funding = fundingOutlook(input, cash);
  const findings = rebuildFundingFinding(base, funding, nearTermRiskMonths);
  const decisions = rebuildDecisions(base, findings, funding);
  const findingCounts: Record<PlanningSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) findingCounts[finding.severity] += 1;
  const penalty = findings.reduce((sum, finding) => sum + severityPenalty[finding.severity], 0);
  const capacityShortfallRows = base.capacity.filter((row) => row.shortfallUnits > 0);
  const capacityShortfallUniqueMonths = new Set(capacityShortfallRows.map((row) => row.period)).size;

  return {
    ...base,
    cash,
    funding,
    findings,
    decisions,
    summary: {
      ...base.summary,
      capacityShortfallMonths: capacityShortfallUniqueMonths,
      minimumFreeLiquidityLakh: funding.minimumBaseFreeLiquidityLakh,
      minimumFreeLiquidityAfterRecommendationsLakh: funding.minimumFreeLiquidityAfterRecommendationsLakh,
      businessHealthScore: Math.max(0, 100 - penalty),
      findingCounts,
    },
    runtimeParity: {
      paymentLagApplied: true,
      deferredProcurementBeyondHorizonLakh: round(deferredProcurementBeyondHorizonLakh),
      capacityShortfallConstraintRows: capacityShortfallRows.length,
      capacityShortfallUniqueMonths,
    },
  };
}
