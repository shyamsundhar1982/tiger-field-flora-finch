import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";
import {
  type CashFlow,
  type IntegratedPlanningResult,
  type PlanningScenario,
} from "@/lib/integrated-business-planning-engine";
import { runRuntimeIbpe, type RuntimeIbpeInput } from "@/lib/ibpe-runtime-parity";

export type IbpeScenarioRequest = PlanningScenario & {
  /** Optional product-line demand overrides. Keys use runtime product IDs: aluminium, carbon, premiumCarbon. */
  demandMultiplierByProduct?: Record<string, number>;
};

export type IbpeScenarioComparison = {
  expectedUnitsDelta: number;
  expectedUnitsDeltaPct: number | null;
  procurementLakhDelta: number;
  minimumFreeLiquidityDeltaLakh: number;
  minimumFreeLiquidityAfterRecommendationsDeltaLakh: number;
  healthScoreDelta: number;
  findingDelta: number;
  fundingNeedDeltaLakh: number;
  baseFirstLiquidityBreachPeriod: number | null;
  scenarioFirstLiquidityBreachPeriod: number | null;
};

export type IbpeScenarioPacket = {
  lineage: {
    governedRunId: string;
    approvedPlanId: string;
    approvedPlanRevision: number;
    inputHash: string;
    sourceSha: string;
    snapshotAt: string;
  };
  scenario: IbpeScenarioRequest;
  baseline: IntegratedPlanningResult;
  result: IntegratedPlanningResult;
  comparison: IbpeScenarioComparison;
  advisoryOnly: true;
};

type SnapshotRow = {
  id: string;
  approved_plan_id: string;
  approved_plan_revision: number | string;
  input_hash: string;
  source_sha: string;
  snapshot_at: string;
  input_json: RuntimeIbpeInput;
  result_json: IntegratedPlanningResult;
};

function finite(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  return Math.min(max, Math.max(min, finite(value, fallback)));
}

function sanitizeProductDemandMultipliers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const allowed = new Set(["aluminium", "carbon", "premiumCarbon"]);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([productId]) => allowed.has(productId))
      .map(([productId, multiplier]) => [productId, clamp(multiplier, 0.1, 3, 1)]),
  );
}

function sanitizeScenario(value: IbpeScenarioRequest): IbpeScenarioRequest {
  const id = String(value.id || "scenario").slice(0, 64);
  const label = String(value.label || "Scenario").slice(0, 80);
  return {
    id,
    label,
    demandMultiplier: clamp(value.demandMultiplier, 0.1, 3, 1),
    demandMultiplierByProduct: sanitizeProductDemandMultipliers(value.demandMultiplierByProduct),
    capacityMultiplier: clamp(value.capacityMultiplier, 0.1, 3, 1),
    procurementCostMultiplier: clamp(value.procurementCostMultiplier, 0.25, 3, 1),
    leadTimeMultiplier: clamp(value.leadTimeMultiplier, 0.25, 3, 1),
    receiptDelayMonths: Math.round(clamp(value.receiptDelayMonths, 0, 12, 0)),
    cashInjectionLakh: clamp(value.cashInjectionLakh, 0, 10000, 0),
    cashInjectionPeriod: Math.round(clamp(value.cashInjectionPeriod, 1, 36, 1)),
  };
}

function cloneInput(input: RuntimeIbpeInput): RuntimeIbpeInput {
  return JSON.parse(JSON.stringify(input)) as RuntimeIbpeInput;
}

export function applyIbpeScenario(
  source: RuntimeIbpeInput,
  rawScenario: IbpeScenarioRequest,
): RuntimeIbpeInput {
  const scenario = sanitizeScenario(rawScenario);
  const input = cloneInput(source);
  const demandMultiplier = scenario.demandMultiplier ?? 1;
  const demandMultiplierByProduct = scenario.demandMultiplierByProduct ?? {};
  const capacityMultiplier = scenario.capacityMultiplier ?? 1;
  const procurementCostMultiplier = scenario.procurementCostMultiplier ?? 1;
  const leadTimeMultiplier = scenario.leadTimeMultiplier ?? 1;
  const receiptDelayMonths = scenario.receiptDelayMonths ?? 0;

  input.demand = input.demand.map((row) => {
    const actual = Math.max(0, row.actualQty);
    const committed = Math.max(0, row.committedQty);
    const residualForecast = Math.max(0, row.forecastQty - actual - committed);
    const rowDemandMultiplier = demandMultiplierByProduct[row.productId] ?? demandMultiplier;
    return {
      ...row,
      forecastQty: actual + committed + residualForecast * rowDemandMultiplier,
      weightedPipelineQty: Math.max(0, row.weightedPipelineQty ?? 0) * rowDemandMultiplier,
      sourceRef: `${row.sourceRef ?? "IBPE"}|SCN:${scenario.id}`,
    };
  });

  input.capacity = (input.capacity ?? []).map((row) => ({
    ...row,
    capacityUnits: Math.max(0, row.capacityUnits * capacityMultiplier),
    sourceRef: `${row.sourceRef ?? "IBPE"}|SCN:${scenario.id}`,
  }));

  input.inventory = input.inventory.map((row) => ({
    ...row,
    unitCostLakh: row.unitCostLakh == null ? row.unitCostLakh : Math.max(0, row.unitCostLakh * procurementCostMultiplier),
    leadTimeMonths: Math.max(0, (row.leadTimeMonths ?? 0) * leadTimeMultiplier),
    sourceRef: `${row.sourceRef ?? "IBPE"}|SCN:${scenario.id}`,
  }));

  input.receipts = (input.receipts ?? []).flatMap((row) => {
    const delayedPeriod = row.period + receiptDelayMonths;
    if (delayedPeriod > 36) return [];
    return [{
      ...row,
      period: Math.max(1, delayedPeriod),
      sourceRef: `${row.sourceRef ?? "IBPE"}|SCN:${scenario.id}`,
    }];
  });

  if ((scenario.cashInjectionLakh ?? 0) > 0) {
    const cashFlow: CashFlow = {
      id: `scenario-cash-${scenario.id}`,
      businessKey: `scenario-cash-${scenario.id}`,
      period: scenario.cashInjectionPeriod ?? 1,
      direction: "inflow",
      amountLakh: scenario.cashInjectionLakh ?? 0,
      truth: "forecast",
      category: "scenario-funding",
      sourceRef: `SCENARIO-${scenario.id}`,
    };
    input.cashFlows = [...(input.cashFlows ?? []), cashFlow];
  }

  return input;
}

function pctDelta(base: number, next: number) {
  return base === 0 ? (next === 0 ? 0 : null) : ((next - base) / Math.abs(base)) * 100;
}

function compareResults(base: IntegratedPlanningResult, scenario: IntegratedPlanningResult): IbpeScenarioComparison {
  return {
    expectedUnitsDelta: scenario.summary.expectedUnits - base.summary.expectedUnits,
    expectedUnitsDeltaPct: pctDelta(base.summary.expectedUnits, scenario.summary.expectedUnits),
    procurementLakhDelta: scenario.summary.totalRecommendedProcurementLakh - base.summary.totalRecommendedProcurementLakh,
    minimumFreeLiquidityDeltaLakh: scenario.summary.minimumFreeLiquidityLakh - base.summary.minimumFreeLiquidityLakh,
    minimumFreeLiquidityAfterRecommendationsDeltaLakh:
      scenario.summary.minimumFreeLiquidityAfterRecommendationsLakh - base.summary.minimumFreeLiquidityAfterRecommendationsLakh,
    healthScoreDelta: scenario.summary.businessHealthScore - base.summary.businessHealthScore,
    findingDelta: scenario.findings.length - base.findings.length,
    fundingNeedDeltaLakh: scenario.funding.incrementalFundingNeedLakh - base.funding.incrementalFundingNeedLakh,
    baseFirstLiquidityBreachPeriod: base.funding.firstLiquidityBreachAfterRecommendationsPeriod,
    scenarioFirstLiquidityBreachPeriod: scenario.funding.firstLiquidityBreachAfterRecommendationsPeriod,
  };
}

async function latestSnapshot(sql: Sql): Promise<SnapshotRow> {
  const rows = await sql.query<SnapshotRow>(
    `select id,approved_plan_id,approved_plan_revision,input_hash,source_sha,snapshot_at::text,input_json,result_json
       from vyndi_ibpe_runs where status='complete' order by created_at desc limit 1`,
  );
  const snapshot = rows[0];
  if (!snapshot) throw new Error("No governed IBPE run exists. Run governed IBPE first.");
  if (!snapshot.input_json?.runtimeControls?.paymentLagBySku) {
    throw new Error("Latest governed IBPE run predates Stage 2 payment-lag parity. Run governed IBPE once to create a Stage 2 snapshot before exploring scenarios.");
  }
  return snapshot;
}

async function requireView() {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("IBPE scenario view permission denied.");
  return role;
}

export async function evaluateScenario(sql: Sql, rawScenario: IbpeScenarioRequest): Promise<IbpeScenarioPacket> {
  const snapshot = await latestSnapshot(sql);
  const scenario = sanitizeScenario(rawScenario);
  const scenarioInput = applyIbpeScenario(snapshot.input_json, scenario);
  const baseline = snapshot.result_json;
  const result = runRuntimeIbpe(scenarioInput, { horizonMonths: 36 });
  return {
    lineage: {
      governedRunId: snapshot.id,
      approvedPlanId: snapshot.approved_plan_id,
      approvedPlanRevision: Number(snapshot.approved_plan_revision),
      inputHash: snapshot.input_hash,
      sourceSha: snapshot.source_sha,
      snapshotAt: snapshot.snapshot_at,
    },
    scenario,
    baseline,
    result,
    comparison: compareResults(baseline, result),
    advisoryOnly: true,
  };
}

export const runIbpeScenario = createServerFn({ method: "POST" })
  .validator((input: IbpeScenarioRequest) => sanitizeScenario(input))
  .handler(async ({ data }) => {
    await requireView();
    const sql = await getSql();
    return evaluateScenario(sql, data);
  });
