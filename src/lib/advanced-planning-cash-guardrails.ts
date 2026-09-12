import type { CashPlanRow } from "./integrated-business-planning-engine.ts";
import type { SupplierLane } from "./advanced-planning-constraints.ts";
import type { AdvancedProcurementDecision } from "./advanced-planning-optimizer.ts";

export type AdvancedCashGuardrail = {
  period: number;
  baselineFreeLiquidityLakh: number;
  cumulativeIncrementalProcurementHeadroomLakh: number;
  sourceRef: string;
};

export type AdvancedCashGuardrailCompilation = {
  valid: boolean;
  guardrails: AdvancedCashGuardrail[];
  issues: Array<{
    severity: "error" | "warning";
    code: string;
    period?: number;
    message: string;
  }>;
  assumptions: string[];
};

export type ProcurementCashPeriodResult = {
  period: number;
  periodProcurementSpendLakh: number;
  cumulativeProcurementSpendLakh: number;
  cumulativeHeadroomLakh: number;
  headroomAfterProposedProcurementLakh: number;
  baselineReserveAlreadyBreached: boolean;
  proposedProcurementBreachesHeadroom: boolean;
};

export type ProcurementCashGuardrailResult = {
  status: "feasible" | "infeasible" | "indeterminate";
  periods: ProcurementCashPeriodResult[];
  totalProposedProcurementLakh: number;
  firstBaselineBreachPeriod?: number;
  firstProposedBreachPeriod?: number;
  issues: Array<{
    severity: "error" | "warning";
    code: string;
    period?: number;
    decisionIndex?: number;
    message: string;
  }>;
  assumptions: string[];
};

function round(value: number) {
  return Number(value.toFixed(6));
}

export function compileCashGuardrailsFromIbpe(
  cashRows: CashPlanRow[],
  horizonPeriods: number,
  sourceRef: string,
): AdvancedCashGuardrailCompilation {
  const issues: AdvancedCashGuardrailCompilation["issues"] = [];
  const byPeriod = new Map<number, CashPlanRow>();

  if (!Number.isInteger(horizonPeriods) || horizonPeriods < 1) {
    issues.push({ severity: "error", code: "INVALID_HORIZON", message: "Cash guardrail horizon must be a positive integer." });
  }
  if (!sourceRef.trim()) {
    issues.push({ severity: "error", code: "SOURCE_REF_REQUIRED", message: "Cash guardrails require governed IBPE source evidence." });
  }

  for (const row of cashRows) {
    if (!Number.isInteger(row.period) || row.period < 1 || row.period > horizonPeriods) {
      issues.push({ severity: "error", code: "CASH_PERIOD", period: row.period, message: `IBPE cash row period ${row.period} is outside the planning horizon.` });
      continue;
    }
    if (byPeriod.has(row.period)) {
      issues.push({ severity: "error", code: "DUPLICATE_CASH_PERIOD", period: row.period, message: `IBPE cash row period ${row.period} is duplicated.` });
      continue;
    }
    if (!Number.isFinite(row.freeLiquidityLakh)) {
      issues.push({ severity: "error", code: "INVALID_FREE_LIQUIDITY", period: row.period, message: `IBPE base free liquidity for period ${row.period} is not finite.` });
      continue;
    }
    byPeriod.set(row.period, row);
  }

  const guardrails: AdvancedCashGuardrail[] = [];
  for (let period = 1; period <= horizonPeriods; period += 1) {
    const row = byPeriod.get(period);
    if (!row) {
      issues.push({ severity: "error", code: "MISSING_CASH_PERIOD", period, message: `IBPE cash authority has no base free-liquidity row for period ${period}.` });
      continue;
    }
    guardrails.push({
      period,
      baselineFreeLiquidityLakh: round(row.freeLiquidityLakh),
      cumulativeIncrementalProcurementHeadroomLakh: round(row.freeLiquidityLakh),
      sourceRef,
    });
    if (row.freeLiquidityLakh < 0) {
      issues.push({
        severity: "warning",
        code: "BASELINE_RESERVE_BREACH",
        period,
        message: `Base IBPE free liquidity is already below reserve by ₹${round(Math.abs(row.freeLiquidityLakh))}L in period ${period}.`,
      });
    }
  }

  return {
    valid: !issues.some((row) => row.severity === "error"),
    guardrails,
    issues,
    assumptions: [
      "Headroom is derived from IBPE base free liquidity before analytical replenishment recommendations, preserving Finance/IBPE as cash authority.",
      "The guardrail is cumulative: proposed incremental procurement paid in or before a period must not exceed that period's reserve-preserving free-liquidity headroom.",
      "Until governed supplier payment timing is modelled, proposed procurement cash is conservatively recognized in the solver order period, matching current IBPE recommendation timing.",
    ],
  };
}

export function evaluateProcurementCashGuardrails(
  decisions: AdvancedProcurementDecision[],
  supplierLanes: SupplierLane[],
  guardrails: AdvancedCashGuardrail[],
): ProcurementCashGuardrailResult {
  const issues: ProcurementCashGuardrailResult["issues"] = [];
  const laneById = new Map(supplierLanes.map((lane) => [lane.id, lane]));
  const guardrailByPeriod = new Map(guardrails.map((row) => [row.period, row]));
  const horizon = guardrails.reduce((max, row) => Math.max(max, row.period), 0);
  const spendByPeriod = new Map<number, number>();
  let indeterminate = false;

  for (const [index, decision] of decisions.entries()) {
    const lane = laneById.get(decision.laneId);
    if (!lane) {
      indeterminate = true;
      issues.push({ severity: "error", code: "UNKNOWN_SUPPLIER_LANE", decisionIndex: index, message: `Procurement decision ${index} references unknown supplier lane ${decision.laneId}.` });
      continue;
    }
    if (!Number.isFinite(decision.quantity) || decision.quantity < 0) {
      indeterminate = true;
      issues.push({ severity: "error", code: "INVALID_PROCUREMENT_QUANTITY", decisionIndex: index, message: `Procurement decision ${index} has an invalid quantity.` });
      continue;
    }
    if (!Number.isInteger(decision.orderPeriod) || decision.orderPeriod < 1 || decision.orderPeriod > horizon) {
      indeterminate = true;
      issues.push({ severity: "error", code: "INVALID_ORDER_PERIOD", decisionIndex: index, period: decision.orderPeriod, message: `Procurement decision ${index} order period is outside the cash-guardrail horizon.` });
      continue;
    }
    if (!Number.isFinite(lane.landedUnitCostLakh) || lane.landedUnitCostLakh < 0) {
      indeterminate = true;
      issues.push({ severity: "error", code: "INVALID_LANDED_COST", decisionIndex: index, message: `Supplier lane ${lane.id} has no valid landed unit cost.` });
      continue;
    }

    const spend = decision.quantity * lane.landedUnitCostLakh;
    spendByPeriod.set(decision.orderPeriod, (spendByPeriod.get(decision.orderPeriod) ?? 0) + spend);
  }

  const periods: ProcurementCashPeriodResult[] = [];
  let cumulativeSpend = 0;
  let firstBaselineBreachPeriod: number | undefined;
  let firstProposedBreachPeriod: number | undefined;

  for (let period = 1; period <= horizon; period += 1) {
    const guardrail = guardrailByPeriod.get(period);
    if (!guardrail) {
      indeterminate = true;
      issues.push({ severity: "error", code: "MISSING_GUARDRAIL_PERIOD", period, message: `No governed cash headroom exists for period ${period}.` });
      continue;
    }
    cumulativeSpend += spendByPeriod.get(period) ?? 0;
    const baselineBreach = guardrail.cumulativeIncrementalProcurementHeadroomLakh < 0;
    const proposedBreach = cumulativeSpend - guardrail.cumulativeIncrementalProcurementHeadroomLakh > 1e-9;
    if (baselineBreach && firstBaselineBreachPeriod === undefined) firstBaselineBreachPeriod = period;
    if (proposedBreach && firstProposedBreachPeriod === undefined) firstProposedBreachPeriod = period;

    periods.push({
      period,
      periodProcurementSpendLakh: round(spendByPeriod.get(period) ?? 0),
      cumulativeProcurementSpendLakh: round(cumulativeSpend),
      cumulativeHeadroomLakh: round(guardrail.cumulativeIncrementalProcurementHeadroomLakh),
      headroomAfterProposedProcurementLakh: round(guardrail.cumulativeIncrementalProcurementHeadroomLakh - cumulativeSpend),
      baselineReserveAlreadyBreached: baselineBreach,
      proposedProcurementBreachesHeadroom: proposedBreach,
    });
  }

  const totalProposedProcurementLakh = [...spendByPeriod.values()].reduce((sum, value) => sum + value, 0);
  const infeasible = firstBaselineBreachPeriod !== undefined || firstProposedBreachPeriod !== undefined;
  return {
    status: indeterminate ? "indeterminate" : infeasible ? "infeasible" : "feasible",
    periods,
    totalProposedProcurementLakh: round(totalProposedProcurementLakh),
    firstBaselineBreachPeriod,
    firstProposedBreachPeriod,
    issues,
    assumptions: [
      "Only proposed incremental procurement is tested here; existing governed cash flows remain embedded in the IBPE base free-liquidity headroom.",
      "Procurement cash is valued using governed supplier-lane landed unit cost and recognized in the order period until payment-term timing authority is implemented.",
      "This calculation is advisory and cannot authorize funding, a purchase order or a reserve-policy override.",
    ],
  };
}
