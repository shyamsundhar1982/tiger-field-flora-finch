/*
 * VYNDI Integrated Business Planning Engine (IBPE)
 *
 * Deterministic, side-effect-free planning core for connecting demand,
 * approved BOMs, inventory/ATP, procurement, capacity, finance and funding.
 *
 * Truth separation is explicit:
 *   actual    = what happened
 *   committed = what is contractually/operationally committed
 *   forecast  = latest expected outcome
 *   plan      = approved management intent
 *
 * This engine may recommend actions. It must never silently approve a plan,
 * create a PO, reserve stock, post accounting actuals or mutate transaction
 * truth. Those remain governed workflows outside this module.
 */

export const DEFAULT_PLANNING_HORIZON_MONTHS = 36;

export type BusinessTruthMode = "plan" | "forecast" | "committed" | "actual";
export type PlanningSeverity = "critical" | "high" | "medium" | "low";
export type DecisionDomain =
  | "planning"
  | "demand"
  | "supply"
  | "inventory"
  | "procurement"
  | "capacity"
  | "finance"
  | "funding"
  | "governance";

export type EvidenceRef = {
  label: string;
  sourceRef?: string;
  entityId?: string;
  period?: number;
};

export type DemandSignal = {
  id: string;
  productId: string;
  variantId?: string;
  period: number;
  planQty: number;
  /** Total expected demand for the period, including actual + committed demand. */
  forecastQty: number;
  /** Open confirmed demand not yet fulfilled. */
  committedQty: number;
  actualQty: number;
  /** Probability-weighted upside not already included in forecastQty. */
  weightedPipelineQty?: number;
  confidence?: number;
  sourceRef?: string;
};

export type BomRequirement = {
  id: string;
  productId: string;
  variantId?: string;
  revisionId: string;
  approved: boolean;
  sku: string;
  quantityPerUnit: number;
  scrapPct?: number;
  sourceRef?: string;
};

export type InventoryPosition = {
  sku: string;
  onHandQty: number;
  quarantineQty?: number;
  qualityHoldQty?: number;
  blockedQty?: number;
  /** Fallback aggregate reservation when explicit reservation rows are absent. */
  reservedQty?: number;
  safetyStockQty?: number;
  mslQty?: number;
  unitCostLakh?: number;
  leadTimeMonths?: number;
  moq?: number;
  orderMultiple?: number;
  sourceRef?: string;
};

export type InventoryReservation = {
  id: string;
  sku: string;
  period: number;
  quantity: number;
  status: "active" | "released" | "consumed";
  demandRef?: string;
  sourceRef?: string;
};

export type InventoryReceipt = {
  id: string;
  sku: string;
  period: number;
  quantity: number;
  truth: "committed" | "actual";
  sourceRef?: string;
};

export type CapacityPosition = {
  id: string;
  period: number;
  capacityUnits: number;
  productId?: string;
  otherCommittedLoadQty?: number;
  sourceRef?: string;
};

export type CashFlow = {
  id: string;
  /** Stable key shared by plan/forecast/commit/actual versions of one flow. */
  businessKey: string;
  period: number;
  direction: "inflow" | "outflow";
  amountLakh: number;
  truth: BusinessTruthMode;
  category: string;
  sourceRef?: string;
};

export type FundingSettings = {
  openingBankCashLakh: number;
  restrictedCashLakh?: number;
  minimumOperatingReserveLakh?: number;
  fundraisingLeadMonths?: number;
};

export type IntegratedPlanningInput = {
  demand: DemandSignal[];
  bom: BomRequirement[];
  inventory: InventoryPosition[];
  reservations?: InventoryReservation[];
  receipts?: InventoryReceipt[];
  capacity?: CapacityPosition[];
  cashFlows?: CashFlow[];
  funding: FundingSettings;
};

export type PlanningScenario = {
  id: string;
  label: string;
  demandMultiplier?: number;
  capacityMultiplier?: number;
  procurementCostMultiplier?: number;
  leadTimeMultiplier?: number;
  receiptDelayMonths?: number;
  /** Analytical cash assumption only; remains forecast truth. */
  cashInjectionLakh?: number;
  cashInjectionPeriod?: number;
};

export type PlanningEngineOptions = {
  horizonMonths: number;
  forecastVarianceAlertPct: number;
  lowConfidenceThreshold: number;
  nearTermRiskMonths: number;
};

export const DEFAULT_PLANNING_ENGINE_OPTIONS: PlanningEngineOptions = {
  horizonMonths: DEFAULT_PLANNING_HORIZON_MONTHS,
  forecastVarianceAlertPct: 0.2,
  lowConfidenceThreshold: 0.6,
  nearTermRiskMonths: 3,
};

export type PlanningFinding = {
  id: string;
  severity: PlanningSeverity;
  domain: DecisionDomain;
  title: string;
  problem: string;
  businessImpact: string;
  recommendedAction: string;
  evidence: EvidenceRef[];
};

export type DemandPlanRow = {
  id: string;
  productId: string;
  variantId?: string;
  period: number;
  planQty: number;
  forecastQty: number;
  committedQty: number;
  actualQty: number;
  residualForecastQty: number;
  weightedPipelineQty: number;
  remainingDemandQty: number;
  expectedTotalQty: number;
  confidence: number;
  varianceToPlanQty: number;
  varianceToPlanPct: number | null;
  sourceRef?: string;
};

export type MrpRequirementRow = {
  period: number;
  productId: string;
  variantId?: string;
  revisionId: string;
  sku: string;
  demandUnits: number;
  quantityPerUnit: number;
  grossRequirementQty: number;
  sourceRef?: string;
};

export type InventoryHealthRow = {
  sku: string;
  onHandQty: number;
  unusableQty: number;
  activeReservedQty: number;
  usablePhysicalQty: number;
  freeAtpQty: number;
  safetyStockQty: number;
  mslQty: number;
  targetBufferQty: number;
};

export type SupplyPlanRow = {
  period: number;
  sku: string;
  grossRequirementQty: number;
  reservedCoverageQty: number;
  unreservedRequirementQty: number;
  confirmedReceiptsQty: number;
  committedFreeStockStartQty: number;
  committedFreeStockEndQty: number;
  committedFulfillmentShortageQty: number;
  targetBufferQty: number;
  plannedFreeStockStartQty: number;
  plannedFreeStockEndQty: number;
  recommendedPurchaseQty: number;
  orderByPeriod: number;
  recommendationIsLate: boolean;
  purchaseCostLakh: number | null;
};

export type CapacityPlanRow = {
  id: string;
  period: number;
  productId?: string;
  requiredUnits: number;
  availableCapacityUnits: number;
  shortfallUnits: number;
};

export type CashPlanRow = {
  period: number;
  selectedInflowsLakh: number;
  selectedOutflowsLakh: number;
  incrementalProcurementLakh: number;
  closingCashLakh: number;
  freeLiquidityLakh: number;
  closingCashAfterRecommendationsLakh: number;
  freeLiquidityAfterRecommendationsLakh: number;
};

export type FundingOutlook = {
  firstBaseLiquidityBreachPeriod: number | null;
  firstLiquidityBreachAfterRecommendationsPeriod: number | null;
  fundingActionPeriod: number | null;
  minimumBaseFreeLiquidityLakh: number;
  minimumFreeLiquidityAfterRecommendationsLakh: number;
  incrementalFundingNeedLakh: number;
};

export type DecisionRecommendation = {
  id: string;
  severity: PlanningSeverity;
  domain: DecisionDomain;
  title: string;
  decision: string;
  rationale: string[];
  financialImpactLakh?: number;
  operationalImpact: string;
  affectedPeriods: number[];
  confidence: number;
  evidence: EvidenceRef[];
  requiresApproval: true;
};

export type PlanningSummary = {
  horizonMonths: number;
  expectedUnits: number;
  committedOpenUnits: number;
  totalRecommendedProcurementLakh: number;
  fulfillmentShortageSkuMonths: number;
  capacityShortfallMonths: number;
  minimumFreeLiquidityLakh: number;
  minimumFreeLiquidityAfterRecommendationsLakh: number;
  businessHealthScore: number;
  findingCounts: Record<PlanningSeverity, number>;
};

export type IntegratedPlanningResult = {
  demand: DemandPlanRow[];
  mrp: MrpRequirementRow[];
  inventoryHealth: InventoryHealthRow[];
  supply: SupplyPlanRow[];
  capacity: CapacityPlanRow[];
  cash: CashPlanRow[];
  funding: FundingOutlook;
  findings: PlanningFinding[];
  decisions: DecisionRecommendation[];
  summary: PlanningSummary;
};

export type ScenarioComparison = {
  scenarioId: string;
  scenarioLabel: string;
  expectedUnitsDelta: number;
  procurementLakhDelta: number;
  minimumFreeLiquidityDeltaLakh: number;
  healthScoreDelta: number;
  findingDelta: number;
};

const truthRank: Record<BusinessTruthMode, number> = {
  plan: 0,
  forecast: 1,
  committed: 2,
  actual: 3,
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

function finiteOrZero(value: number | undefined) {
  return Number.isFinite(value) ? (value ?? 0) : 0;
}

function nonNegative(value: number | undefined) {
  return Math.max(0, finiteOrZero(value));
}

function clamp01(value: number | undefined, fallback = 1) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value ?? fallback));
}

function validPeriod(period: number, horizon: number) {
  return Number.isInteger(period) && period >= 1 && period <= horizon;
}

function key(productId: string, variantId?: string) {
  return `${productId}::${variantId ?? "*"}`;
}

function skuPeriodKey(sku: string, period: number) {
  return `${sku}::${period}`;
}

function findingId(domain: DecisionDomain, subject: string) {
  return `${domain}:${subject}`.replace(/\s+/g, "-").toLowerCase();
}

function addFinding(findings: PlanningFinding[], finding: PlanningFinding) {
  if (!findings.some((existing) => existing.id === finding.id)) findings.push(finding);
}

function buildDemandPlan(
  input: IntegratedPlanningInput,
  options: PlanningEngineOptions,
  findings: PlanningFinding[],
): DemandPlanRow[] {
  const seen = new Set<string>();
  const rows: DemandPlanRow[] = [];

  for (const signal of input.demand) {
    if (seen.has(signal.id)) {
      addFinding(findings, {
        id: findingId("demand", `duplicate-${signal.id}`),
        severity: "high",
        domain: "demand",
        title: "Duplicate demand signal ID",
        problem: `${signal.id} occurs more than once.`,
        businessImpact: "Demand can be double-counted and inflate MRP, procurement and cash requirements.",
        recommendedAction: "Use one stable record per demand signal/revision.",
        evidence: [{ label: signal.id, entityId: signal.id, sourceRef: signal.sourceRef }],
      });
    }
    seen.add(signal.id);

    if (!validPeriod(signal.period, options.horizonMonths)) {
      addFinding(findings, {
        id: findingId("demand", `outside-horizon-${signal.id}`),
        severity: "high",
        domain: "demand",
        title: "Demand outside planning horizon",
        problem: `${signal.id} uses M${signal.period}, outside M1–M${options.horizonMonths}.`,
        businessImpact: "The requirement will not propagate into supply, capacity or funding planning.",
        recommendedAction: "Move the signal into the rolling horizon or extend the approved horizon.",
        evidence: [{ label: `M${signal.period}`, entityId: signal.id, sourceRef: signal.sourceRef }],
      });
      continue;
    }

    const planQty = nonNegative(signal.planQty);
    const forecastQty = nonNegative(signal.forecastQty);
    const committedQty = nonNegative(signal.committedQty);
    const actualQty = nonNegative(signal.actualQty);
    const weightedPipelineQty = nonNegative(signal.weightedPipelineQty);
    const confidence = clamp01(signal.confidence);

    // Forecast is total expected demand. Actual + committed truth therefore
    // displaces the same portion of forecast rather than being added twice.
    const residualForecastQty = Math.max(0, forecastQty - actualQty - committedQty);
    const remainingDemandQty = committedQty + residualForecastQty + weightedPipelineQty;
    const expectedTotalQty = actualQty + remainingDemandQty;
    const varianceToPlanQty = expectedTotalQty - planQty;
    const varianceToPlanPct = planQty > 0 ? varianceToPlanQty / planQty : expectedTotalQty > 0 ? 1 : null;

    if (confidence < options.lowConfidenceThreshold && remainingDemandQty > committedQty) {
      addFinding(findings, {
        id: findingId("demand", `low-confidence-${signal.id}`),
        severity: "medium",
        domain: "demand",
        title: "Forecast confidence is below planning threshold",
        problem: `${signal.id} confidence is ${round(confidence * 100, 1)}% in M${signal.period}.`,
        businessImpact: "Purchasing or capacity commitments based on the full upside may create excess stock or cash burn.",
        recommendedAction: "Keep the upside visible but gate irreversible commitments behind stronger evidence or staged release.",
        evidence: [{ label: `${round(confidence * 100, 1)}% confidence`, entityId: signal.id, period: signal.period, sourceRef: signal.sourceRef }],
      });
    }

    if (varianceToPlanPct !== null && Math.abs(varianceToPlanPct) >= options.forecastVarianceAlertPct) {
      addFinding(findings, {
        id: findingId("planning", `variance-${signal.id}`),
        severity: Math.abs(varianceToPlanPct) >= 0.5 ? "high" : "medium",
        domain: "planning",
        title: "Demand has moved materially away from plan",
        problem: `${signal.id} is ${round(varianceToPlanPct * 100, 1)}% versus approved plan in M${signal.period}.`,
        businessImpact: "The approved plan may no longer represent the most likely operating outcome.",
        recommendedAction: "Review the variance and create an auditable plan revision if management accepts the new outlook.",
        evidence: [
          { label: `Plan ${planQty}`, entityId: signal.id, period: signal.period, sourceRef: signal.sourceRef },
          { label: `Expected ${round(expectedTotalQty)}`, entityId: signal.id, period: signal.period, sourceRef: signal.sourceRef },
        ],
      });
    }

    rows.push({
      id: signal.id,
      productId: signal.productId,
      variantId: signal.variantId,
      period: signal.period,
      planQty,
      forecastQty,
      committedQty,
      actualQty,
      residualForecastQty: round(residualForecastQty),
      weightedPipelineQty: round(weightedPipelineQty),
      remainingDemandQty: round(remainingDemandQty),
      expectedTotalQty: round(expectedTotalQty),
      confidence,
      varianceToPlanQty: round(varianceToPlanQty),
      varianceToPlanPct,
      sourceRef: signal.sourceRef,
    });
  }

  return rows.sort((a, b) => a.period - b.period || a.productId.localeCompare(b.productId));
}

function approvedBomFor(
  input: IntegratedPlanningInput,
  productId: string,
  variantId: string | undefined,
  findings: PlanningFinding[],
  demand: DemandPlanRow,
) {
  const exact = input.bom.filter(
    (line) => line.approved && line.productId === productId && line.variantId === variantId,
  );
  const productLevel = input.bom.filter(
    (line) => line.approved && line.productId === productId && line.variantId === undefined,
  );
  const selected = exact.length > 0 ? exact : productLevel;

  if (selected.length === 0 && demand.remainingDemandQty > 0) {
    addFinding(findings, {
      id: findingId("supply", `no-approved-bom-${key(productId, variantId)}`),
      severity: "high",
      domain: "supply",
      title: "Demand has no approved executable BOM",
      problem: `${productId}${variantId ? ` / ${variantId}` : ""} has demand but no approved BOM revision for MRP.`,
      businessImpact: "Procurement and production requirements cannot be released with engineering traceability.",
      recommendedAction: "Release an approved BOM revision and controlled BOM-to-SKU mapping before production commitment.",
      evidence: [{ label: demand.id, entityId: demand.id, period: demand.period, sourceRef: demand.sourceRef }],
    });
  }

  return selected;
}

function buildMrp(
  input: IntegratedPlanningInput,
  demand: DemandPlanRow[],
  findings: PlanningFinding[],
): MrpRequirementRow[] {
  const rows: MrpRequirementRow[] = [];
  for (const demandRow of demand) {
    if (demandRow.remainingDemandQty <= 0) continue;
    const bom = approvedBomFor(input, demandRow.productId, demandRow.variantId, findings, demandRow);
    for (const line of bom) {
      const quantityPerUnit = nonNegative(line.quantityPerUnit);
      const scrapFactor = 1 + nonNegative(line.scrapPct) / 100;
      rows.push({
        period: demandRow.period,
        productId: demandRow.productId,
        variantId: demandRow.variantId,
        revisionId: line.revisionId,
        sku: line.sku,
        demandUnits: demandRow.remainingDemandQty,
        quantityPerUnit,
        grossRequirementQty: round(demandRow.remainingDemandQty * quantityPerUnit * scrapFactor),
        sourceRef: line.sourceRef,
      });
    }
  }
  return rows.sort((a, b) => a.period - b.period || a.sku.localeCompare(b.sku));
}

function buildInventoryHealth(
  input: IntegratedPlanningInput,
  findings: PlanningFinding[],
): InventoryHealthRow[] {
  const reservationBySku = new Map<string, number>();
  for (const reservation of input.reservations ?? []) {
    if (reservation.status !== "active") continue;
    reservationBySku.set(
      reservation.sku,
      (reservationBySku.get(reservation.sku) ?? 0) + nonNegative(reservation.quantity),
    );
  }

  const seen = new Set<string>();
  const rows: InventoryHealthRow[] = [];
  for (const item of input.inventory) {
    if (seen.has(item.sku)) {
      addFinding(findings, {
        id: findingId("inventory", `duplicate-${item.sku}`),
        severity: "critical",
        domain: "inventory",
        title: "Multiple canonical inventory positions for one SKU",
        problem: `${item.sku} appears more than once in the planning snapshot.`,
        businessImpact: "ATP and purchasing calculations can read two competing stock truths.",
        recommendedAction: "Reconcile duplicate ledger ownership and expose one authoritative physical inventory position.",
        evidence: [{ label: item.sku, entityId: item.sku, sourceRef: item.sourceRef }],
      });
      continue;
    }
    seen.add(item.sku);

    const onHandQty = nonNegative(item.onHandQty);
    const unusableQty = nonNegative(item.quarantineQty) + nonNegative(item.qualityHoldQty) + nonNegative(item.blockedQty);
    const usablePhysicalQty = Math.max(0, onHandQty - unusableQty);
    const explicitReserved = reservationBySku.get(item.sku);
    const activeReservedQty = explicitReserved === undefined ? nonNegative(item.reservedQty) : explicitReserved;
    const freeAtpQty = Math.max(0, usablePhysicalQty - activeReservedQty);
    const safetyStockQty = nonNegative(item.safetyStockQty);
    const mslQty = nonNegative(item.mslQty);

    if (activeReservedQty > usablePhysicalQty) {
      addFinding(findings, {
        id: findingId("inventory", `over-reserved-${item.sku}`),
        severity: "high",
        domain: "inventory",
        title: "Inventory is over-reserved",
        problem: `${item.sku} has ${round(activeReservedQty)} reserved against ${round(usablePhysicalQty)} usable physical units.`,
        businessImpact: "More stock has been promised than can currently be allocated.",
        recommendedAction: "Reconcile reservations and replenish, deallocate or backorder the excess commitment.",
        evidence: [{ label: item.sku, entityId: item.sku, sourceRef: item.sourceRef }],
      });
    }

    rows.push({
      sku: item.sku,
      onHandQty,
      unusableQty: round(unusableQty),
      activeReservedQty: round(activeReservedQty),
      usablePhysicalQty: round(usablePhysicalQty),
      freeAtpQty: round(freeAtpQty),
      safetyStockQty,
      mslQty,
      targetBufferQty: Math.max(safetyStockQty, mslQty),
    });
  }
  return rows.sort((a, b) => a.sku.localeCompare(b.sku));
}

function aggregateMrp(mrp: MrpRequirementRow[]) {
  const map = new Map<string, number>();
  for (const row of mrp) {
    const k = skuPeriodKey(row.sku, row.period);
    map.set(k, (map.get(k) ?? 0) + row.grossRequirementQty);
  }
  return map;
}

function aggregateReservations(input: IntegratedPlanningInput, horizon: number) {
  const map = new Map<string, number>();
  for (const row of input.reservations ?? []) {
    if (row.status !== "active" || !validPeriod(row.period, horizon)) continue;
    const k = skuPeriodKey(row.sku, row.period);
    map.set(k, (map.get(k) ?? 0) + nonNegative(row.quantity));
  }
  return map;
}

function aggregateReceipts(input: IntegratedPlanningInput, horizon: number) {
  const map = new Map<string, number>();
  for (const row of input.receipts ?? []) {
    if (!validPeriod(row.period, horizon)) continue;
    const k = skuPeriodKey(row.sku, row.period);
    map.set(k, (map.get(k) ?? 0) + nonNegative(row.quantity));
  }
  return map;
}

function roundOrder(requiredQty: number, moq: number, multiple: number) {
  if (requiredQty <= 0) return 0;
  const step = Math.max(1, multiple);
  return Math.max(moq, Math.ceil(requiredQty / step) * step);
}

function buildSupplyPlan(
  input: IntegratedPlanningInput,
  mrp: MrpRequirementRow[],
  health: InventoryHealthRow[],
  options: PlanningEngineOptions,
  findings: PlanningFinding[],
): SupplyPlanRow[] {
  const requirements = aggregateMrp(mrp);
  const reservations = aggregateReservations(input, options.horizonMonths);
  const receipts = aggregateReceipts(input, options.horizonMonths);
  const inventoryBySku = new Map(input.inventory.map((item) => [item.sku, item]));
  const healthBySku = new Map(health.map((item) => [item.sku, item]));
  const requiredSkus = [...new Set(mrp.map((row) => row.sku))].sort();
  const rows: SupplyPlanRow[] = [];

  for (const sku of requiredSkus) {
    const position = inventoryBySku.get(sku);
    const inventoryHealth = healthBySku.get(sku);
    if (!position) {
      addFinding(findings, {
        id: findingId("inventory", `missing-${sku}`),
        severity: "high",
        domain: "inventory",
        title: "BOM SKU missing from canonical inventory",
        problem: `${sku} is required by an approved BOM but has no inventory master position.`,
        businessImpact: "MRP cannot establish ATP, cost, MOQ or supplier lead-time for the component.",
        recommendedAction: "Create/map the SKU in the authoritative inventory master before release.",
        evidence: [{ label: sku, entityId: sku }],
      });
    }

    const explicitReservationTotal = [...reservations.entries()]
      .filter(([k]) => k.startsWith(`${sku}::`))
      .reduce((sum, [, qty]) => sum + qty, 0);
    const aggregateReservationFallback = explicitReservationTotal > 0 ? 0 : nonNegative(position?.reservedQty);
    const usablePhysical = inventoryHealth?.usablePhysicalQty ?? 0;
    let committedFreeStock = Math.max(0, usablePhysical - explicitReservationTotal - aggregateReservationFallback);
    let plannedFreeStock = committedFreeStock;
    const targetBuffer = inventoryHealth?.targetBufferQty ?? 0;
    const leadTimeMonths = nonNegative(position?.leadTimeMonths);
    const moq = nonNegative(position?.moq);
    const orderMultiple = Math.max(1, nonNegative(position?.orderMultiple) || 1);
    const unitCostLakh = Number.isFinite(position?.unitCostLakh) ? nonNegative(position?.unitCostLakh) : null;

    for (let period = 1; period <= options.horizonMonths; period += 1) {
      const grossRequirementQty = requirements.get(skuPeriodKey(sku, period)) ?? 0;
      const reservationQty = reservations.get(skuPeriodKey(sku, period)) ?? 0;
      const reservedCoverageQty = Math.min(grossRequirementQty, reservationQty);
      const unreservedRequirementQty = Math.max(0, grossRequirementQty - reservedCoverageQty);
      const confirmedReceiptsQty = receipts.get(skuPeriodKey(sku, period)) ?? 0;

      const committedFreeStockStartQty = committedFreeStock + confirmedReceiptsQty;
      const committedFulfillmentShortageQty = Math.max(0, unreservedRequirementQty - committedFreeStockStartQty);
      committedFreeStock = Math.max(0, committedFreeStockStartQty - unreservedRequirementQty);

      const plannedFreeStockStartQty = plannedFreeStock + confirmedReceiptsQty;
      const purchaseNeedQty = Math.max(0, unreservedRequirementQty + targetBuffer - plannedFreeStockStartQty);
      const recommendedPurchaseQty = roundOrder(purchaseNeedQty, moq, orderMultiple);
      plannedFreeStock = Math.max(0, plannedFreeStockStartQty - unreservedRequirementQty + recommendedPurchaseQty);

      const rawOrderBy = period - Math.ceil(leadTimeMonths);
      const orderByPeriod = Math.max(1, rawOrderBy);
      const recommendationIsLate = recommendedPurchaseQty > 0 && rawOrderBy < 1;
      const purchaseCostLakh =
        recommendedPurchaseQty > 0 && unitCostLakh !== null ? round(recommendedPurchaseQty * unitCostLakh) : null;

      if (committedFulfillmentShortageQty > 0) {
        addFinding(findings, {
          id: findingId("supply", `shortage-${sku}-${period}`),
          severity: period <= Math.max(options.nearTermRiskMonths, Math.ceil(leadTimeMonths)) ? "high" : "medium",
          domain: "supply",
          title: "Committed supply does not cover requirement",
          problem: `${sku} is short ${round(committedFulfillmentShortageQty)} units in M${period} before unapproved recommendations.`,
          businessImpact: "Production/customer commitments can slip unless supply or allocation changes.",
          recommendedAction: "Approve replenishment, an approved substitute, demand reallocation or a revised promise date.",
          evidence: [{ label: `${sku} shortage ${round(committedFulfillmentShortageQty)}`, entityId: sku, period }],
        });
      }

      if (recommendationIsLate) {
        addFinding(findings, {
          id: findingId("procurement", `late-${sku}-${period}`),
          severity: "high",
          domain: "procurement",
          title: "Purchase recommendation is inside supplier lead time",
          problem: `${sku} needs action for M${period}, but its lead time implies ordering before the active planning fence.`,
          businessImpact: "A normal PO may no longer protect the requirement date.",
          recommendedAction: "Escalate expedite/alternate-source options or revise the affected production/customer commitment.",
          evidence: [{ label: sku, entityId: sku, period, sourceRef: position?.sourceRef }],
        });
      }

      if (recommendedPurchaseQty > 0 && unitCostLakh === null) {
        addFinding(findings, {
          id: findingId("procurement", `missing-cost-${sku}`),
          severity: "medium",
          domain: "procurement",
          title: "Purchase recommendation has no controlled unit cost",
          problem: `${sku} requires replenishment but no valid unit cost is available.`,
          businessImpact: "Cash and funding consequences are understated until the buy is valued.",
          recommendedAction: "Load an approved supplier/rate source before procurement approval.",
          evidence: [{ label: sku, entityId: sku, sourceRef: position?.sourceRef }],
        });
      }

      if (grossRequirementQty > 0 || confirmedReceiptsQty > 0 || reservationQty > 0 || recommendedPurchaseQty > 0) {
        rows.push({
          period,
          sku,
          grossRequirementQty: round(grossRequirementQty),
          reservedCoverageQty: round(reservedCoverageQty),
          unreservedRequirementQty: round(unreservedRequirementQty),
          confirmedReceiptsQty: round(confirmedReceiptsQty),
          committedFreeStockStartQty: round(committedFreeStockStartQty),
          committedFreeStockEndQty: round(committedFreeStock),
          committedFulfillmentShortageQty: round(committedFulfillmentShortageQty),
          targetBufferQty: round(targetBuffer),
          plannedFreeStockStartQty: round(plannedFreeStockStartQty),
          plannedFreeStockEndQty: round(plannedFreeStock),
          recommendedPurchaseQty: round(recommendedPurchaseQty),
          orderByPeriod,
          recommendationIsLate,
          purchaseCostLakh,
        });
      }
    }
  }

  return rows.sort((a, b) => a.period - b.period || a.sku.localeCompare(b.sku));
}

function buildCapacityPlan(
  demand: DemandPlanRow[],
  constraints: CapacityPosition[],
  options: PlanningEngineOptions,
  findings: PlanningFinding[],
): CapacityPlanRow[] {
  const rows: CapacityPlanRow[] = [];
  for (const constraint of constraints) {
    if (!validPeriod(constraint.period, options.horizonMonths)) continue;
    const requiredUnits = demand
      .filter(
        (row) =>
          row.period === constraint.period &&
          (constraint.productId === undefined || row.productId === constraint.productId),
      )
      .reduce((sum, row) => sum + row.remainingDemandQty, 0);
    const availableCapacityUnits = Math.max(0, nonNegative(constraint.capacityUnits) - nonNegative(constraint.otherCommittedLoadQty));
    const shortfallUnits = Math.max(0, requiredUnits - availableCapacityUnits);

    if (shortfallUnits > 0) {
      addFinding(findings, {
        id: findingId("capacity", `shortfall-${constraint.id}`),
        severity: constraint.period <= options.nearTermRiskMonths ? "high" : "medium",
        domain: "capacity",
        title: "Production capacity is below requirement",
        problem: `${constraint.id} is short ${round(shortfallUnits)} units in M${constraint.period}.`,
        businessImpact: "Material availability alone cannot make the demand plan feasible.",
        recommendedAction: "Re-sequence demand, add approved capacity, outsource, or revise delivery/launch timing.",
        evidence: [{ label: constraint.id, entityId: constraint.id, period: constraint.period, sourceRef: constraint.sourceRef }],
      });
    }

    rows.push({
      id: constraint.id,
      period: constraint.period,
      productId: constraint.productId,
      requiredUnits: round(requiredUnits),
      availableCapacityUnits: round(availableCapacityUnits),
      shortfallUnits: round(shortfallUnits),
    });
  }
  return rows.sort((a, b) => a.period - b.period || a.id.localeCompare(b.id));
}

function selectCashFlows(
  flows: CashFlow[],
  horizon: number,
  findings: PlanningFinding[],
): CashFlow[] {
  const groups = new Map<string, CashFlow[]>();
  for (const flow of flows) {
    if (!validPeriod(flow.period, horizon)) continue;
    const groupKey = `${flow.businessKey}::${flow.period}::${flow.direction}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), flow]);
  }

  const selected: CashFlow[] = [];
  for (const [groupKey, group] of groups.entries()) {
    const maxRank = Math.max(...group.map((flow) => truthRank[flow.truth]));
    const highest = group.filter((flow) => truthRank[flow.truth] === maxRank);
    const distinctAmounts = new Set(highest.map((flow) => round(nonNegative(flow.amountLakh))));
    if (distinctAmounts.size > 1) {
      addFinding(findings, {
        id: findingId("finance", `conflict-${groupKey}`),
        severity: "high",
        domain: "finance",
        title: "Conflicting cash values at the same truth level",
        problem: `${groupKey} has multiple ${highest[0]?.truth ?? "unknown"} values with different amounts.`,
        businessImpact: "The same obligation/receipt can produce different runway outcomes for different consumers.",
        recommendedAction: "Reconcile the stable business key to one controlled revision before approval.",
        evidence: highest.map((flow) => ({ label: `${flow.id}: ${flow.amountLakh}L`, entityId: flow.id, period: flow.period, sourceRef: flow.sourceRef })),
      });
    }
    if (highest[0]) selected.push(highest[0]);
  }
  return selected;
}

function buildCashPlan(
  input: IntegratedPlanningInput,
  supply: SupplyPlanRow[],
  options: PlanningEngineOptions,
  findings: PlanningFinding[],
): { rows: CashPlanRow[]; outlook: FundingOutlook } {
  const selectedFlows = selectCashFlows(input.cashFlows ?? [], options.horizonMonths, findings);
  const procurementByPeriod = new Map<number, number>();
  for (const row of supply) {
    if (!row.purchaseCostLakh || row.purchaseCostLakh <= 0) continue;
    procurementByPeriod.set(row.orderByPeriod, (procurementByPeriod.get(row.orderByPeriod) ?? 0) + row.purchaseCostLakh);
  }

  const restrictedCash = nonNegative(input.funding.restrictedCashLakh);
  const minimumReserve = nonNegative(input.funding.minimumOperatingReserveLakh);
  let baseCash = finiteOrZero(input.funding.openingBankCashLakh);
  let plannedCash = baseCash;
  const rows: CashPlanRow[] = [];

  for (let period = 1; period <= options.horizonMonths; period += 1) {
    const periodFlows = selectedFlows.filter((flow) => flow.period === period);
    const selectedInflowsLakh = periodFlows
      .filter((flow) => flow.direction === "inflow")
      .reduce((sum, flow) => sum + nonNegative(flow.amountLakh), 0);
    const selectedOutflowsLakh = periodFlows
      .filter((flow) => flow.direction === "outflow")
      .reduce((sum, flow) => sum + nonNegative(flow.amountLakh), 0);
    const incrementalProcurementLakh = procurementByPeriod.get(period) ?? 0;

    baseCash += selectedInflowsLakh - selectedOutflowsLakh;
    plannedCash += selectedInflowsLakh - selectedOutflowsLakh - incrementalProcurementLakh;
    const freeLiquidityLakh = baseCash - restrictedCash - minimumReserve;
    const freeLiquidityAfterRecommendationsLakh = plannedCash - restrictedCash - minimumReserve;

    rows.push({
      period,
      selectedInflowsLakh: round(selectedInflowsLakh),
      selectedOutflowsLakh: round(selectedOutflowsLakh),
      incrementalProcurementLakh: round(incrementalProcurementLakh),
      closingCashLakh: round(baseCash),
      freeLiquidityLakh: round(freeLiquidityLakh),
      closingCashAfterRecommendationsLakh: round(plannedCash),
      freeLiquidityAfterRecommendationsLakh: round(freeLiquidityAfterRecommendationsLakh),
    });
  }

  const minimumBase = rows.reduce((min, row) => Math.min(min, row.freeLiquidityLakh), Number.POSITIVE_INFINITY);
  const minimumAfter = rows.reduce(
    (min, row) => Math.min(min, row.freeLiquidityAfterRecommendationsLakh),
    Number.POSITIVE_INFINITY,
  );
  const firstBaseBreach = rows.find((row) => row.freeLiquidityLakh < 0)?.period ?? null;
  const firstAfterBreach = rows.find((row) => row.freeLiquidityAfterRecommendationsLakh < 0)?.period ?? null;
  const fundraisingLeadMonths = Math.ceil(nonNegative(input.funding.fundraisingLeadMonths));
  const fundingActionPeriod = firstAfterBreach === null ? null : Math.max(1, firstAfterBreach - fundraisingLeadMonths);
  const incrementalFundingNeedLakh = Math.max(0, -minimumAfter);

  if (firstAfterBreach !== null) {
    addFinding(findings, {
      id: findingId("funding", `liquidity-breach-${firstAfterBreach}`),
      severity: firstAfterBreach <= options.nearTermRiskMonths ? "critical" : "high",
      domain: "funding",
      title: "Free liquidity falls below operating reserve",
      problem: `Liquidity becomes negative in M${firstAfterBreach} after analytical replenishment recommendations.`,
      businessImpact: "The current operating plan and supply response are not fully funded at the stated reserve policy.",
      recommendedAction: `Start funding/cost/pace action by M${fundingActionPeriod ?? firstAfterBreach}; do not convert unfunded recommendations into commitments automatically.`,
      evidence: [{ label: `Funding need ${round(incrementalFundingNeedLakh)}L`, period: firstAfterBreach }],
    });
  }

  return {
    rows,
    outlook: {
      firstBaseLiquidityBreachPeriod: firstBaseBreach,
      firstLiquidityBreachAfterRecommendationsPeriod: firstAfterBreach,
      fundingActionPeriod,
      minimumBaseFreeLiquidityLakh: Number.isFinite(minimumBase) ? round(minimumBase) : 0,
      minimumFreeLiquidityAfterRecommendationsLakh: Number.isFinite(minimumAfter) ? round(minimumAfter) : 0,
      incrementalFundingNeedLakh: round(incrementalFundingNeedLakh),
    },
  };
}

function buildDecisions(
  findings: PlanningFinding[],
  supply: SupplyPlanRow[],
  funding: FundingOutlook,
): DecisionRecommendation[] {
  const sorted = [...findings].sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity] || a.domain.localeCompare(b.domain),
  );
  const decisions: DecisionRecommendation[] = sorted.slice(0, 12).map((finding) => ({
    id: `decision:${finding.id}`,
    severity: finding.severity,
    domain: finding.domain,
    title: finding.title,
    decision: finding.recommendedAction,
    rationale: [finding.problem, finding.businessImpact],
    operationalImpact: finding.businessImpact,
    affectedPeriods: [...new Set(finding.evidence.map((item) => item.period).filter((period): period is number => period !== undefined))],
    confidence: finding.severity === "critical" ? 0.95 : finding.severity === "high" ? 0.85 : 0.7,
    evidence: finding.evidence,
    requiresApproval: true,
  }));

  const procurementLakh = supply.reduce((sum, row) => sum + (row.purchaseCostLakh ?? 0), 0);
  if (funding.firstLiquidityBreachAfterRecommendationsPeriod !== null) {
    decisions.unshift({
      id: "decision:funding-pace-gate",
      severity: funding.firstLiquidityBreachAfterRecommendationsPeriod <= 3 ? "critical" : "high",
      domain: "funding",
      title: "Funding / operating pace gate",
      decision: `Approve funding, cost reduction, procurement staging or schedule slowdown before M${funding.fundingActionPeriod ?? funding.firstLiquidityBreachAfterRecommendationsPeriod}.`,
      rationale: [
        `Minimum free liquidity after recommendations is ${funding.minimumFreeLiquidityAfterRecommendationsLakh}L.`,
        `Analytical replenishment recommendations total ${round(procurementLakh)}L.`,
      ],
      financialImpactLakh: funding.incrementalFundingNeedLakh,
      operationalImpact: "Keeps the 36-month plan dynamically tied to available capital rather than assuming the original pace is always affordable.",
      affectedPeriods: [funding.firstLiquidityBreachAfterRecommendationsPeriod],
      confidence: 0.95,
      evidence: [{ label: `Funding need ${funding.incrementalFundingNeedLakh}L`, period: funding.firstLiquidityBreachAfterRecommendationsPeriod }],
      requiresApproval: true,
    });
  }

  return decisions.slice(0, 12);
}

function buildSummary(
  options: PlanningEngineOptions,
  demand: DemandPlanRow[],
  supply: SupplyPlanRow[],
  capacity: CapacityPlanRow[],
  funding: FundingOutlook,
  findings: PlanningFinding[],
): PlanningSummary {
  const findingCounts: Record<PlanningSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) findingCounts[finding.severity] += 1;
  const penalty = findings.reduce((sum, finding) => sum + severityPenalty[finding.severity], 0);

  return {
    horizonMonths: options.horizonMonths,
    expectedUnits: round(demand.reduce((sum, row) => sum + row.expectedTotalQty, 0)),
    committedOpenUnits: round(demand.reduce((sum, row) => sum + row.committedQty, 0)),
    totalRecommendedProcurementLakh: round(supply.reduce((sum, row) => sum + (row.purchaseCostLakh ?? 0), 0)),
    fulfillmentShortageSkuMonths: supply.filter((row) => row.committedFulfillmentShortageQty > 0).length,
    capacityShortfallMonths: capacity.filter((row) => row.shortfallUnits > 0).length,
    minimumFreeLiquidityLakh: funding.minimumBaseFreeLiquidityLakh,
    minimumFreeLiquidityAfterRecommendationsLakh: funding.minimumFreeLiquidityAfterRecommendationsLakh,
    businessHealthScore: Math.max(0, 100 - penalty),
    findingCounts,
  };
}

export function runIntegratedBusinessPlanningEngine(
  input: IntegratedPlanningInput,
  options: Partial<PlanningEngineOptions> = {},
): IntegratedPlanningResult {
  const resolvedOptions: PlanningEngineOptions = { ...DEFAULT_PLANNING_ENGINE_OPTIONS, ...options };
  const findings: PlanningFinding[] = [];
  const demand = buildDemandPlan(input, resolvedOptions, findings);
  const mrp = buildMrp(input, demand, findings);
  const inventoryHealth = buildInventoryHealth(input, findings);
  const supply = buildSupplyPlan(input, mrp, inventoryHealth, resolvedOptions, findings);
  const capacity = buildCapacityPlan(demand, input.capacity ?? [], resolvedOptions, findings);
  const cashResult = buildCashPlan(input, supply, resolvedOptions, findings);
  const decisions = buildDecisions(findings, supply, cashResult.outlook);
  const summary = buildSummary(resolvedOptions, demand, supply, capacity, cashResult.outlook, findings);

  return {
    demand,
    mrp,
    inventoryHealth,
    supply,
    capacity,
    cash: cashResult.rows,
    funding: cashResult.outlook,
    findings: findings.sort(
      (a, b) => severityRank[a.severity] - severityRank[b.severity] || a.domain.localeCompare(b.domain),
    ),
    decisions,
    summary,
  };
}

export function applyPlanningScenario(
  input: IntegratedPlanningInput,
  scenario: PlanningScenario,
): IntegratedPlanningInput {
  const demandMultiplier = Math.max(0, finiteOrZero(scenario.demandMultiplier) || 1);
  const capacityMultiplier = Math.max(0, finiteOrZero(scenario.capacityMultiplier) || 1);
  const procurementCostMultiplier = Math.max(0, finiteOrZero(scenario.procurementCostMultiplier) || 1);
  const leadTimeMultiplier = Math.max(0, finiteOrZero(scenario.leadTimeMultiplier) || 1);
  const receiptDelayMonths = Math.max(0, Math.round(finiteOrZero(scenario.receiptDelayMonths)));

  const scenarioCashFlow: CashFlow[] =
    nonNegative(scenario.cashInjectionLakh) > 0 && Number.isInteger(scenario.cashInjectionPeriod)
      ? [
          {
            id: `scenario:${scenario.id}:cash-injection`,
            businessKey: `scenario:${scenario.id}:cash-injection`,
            period: scenario.cashInjectionPeriod as number,
            direction: "inflow",
            amountLakh: nonNegative(scenario.cashInjectionLakh),
            truth: "forecast",
            category: "scenario-funding",
            sourceRef: `scenario:${scenario.id}`,
          },
        ]
      : [];

  return {
    ...input,
    demand: input.demand.map((row) => ({
      ...row,
      forecastQty: round(row.actualQty + row.committedQty + Math.max(0, row.forecastQty - row.actualQty - row.committedQty) * demandMultiplier),
      weightedPipelineQty: round(nonNegative(row.weightedPipelineQty) * demandMultiplier),
    })),
    inventory: input.inventory.map((row) => ({
      ...row,
      unitCostLakh: Number.isFinite(row.unitCostLakh) ? round(nonNegative(row.unitCostLakh) * procurementCostMultiplier) : row.unitCostLakh,
      leadTimeMonths: round(nonNegative(row.leadTimeMonths) * leadTimeMultiplier),
    })),
    receipts: (input.receipts ?? []).map((row) => ({ ...row, period: row.period + receiptDelayMonths })),
    capacity: (input.capacity ?? []).map((row) => ({ ...row, capacityUnits: round(nonNegative(row.capacityUnits) * capacityMultiplier) })),
    cashFlows: [...(input.cashFlows ?? []), ...scenarioCashFlow],
  };
}

export function runPlanningScenario(
  input: IntegratedPlanningInput,
  scenario: PlanningScenario,
  options: Partial<PlanningEngineOptions> = {},
): IntegratedPlanningResult {
  return runIntegratedBusinessPlanningEngine(applyPlanningScenario(input, scenario), options);
}

export function comparePlanningScenarios(
  input: IntegratedPlanningInput,
  scenarios: PlanningScenario[],
  options: Partial<PlanningEngineOptions> = {},
): ScenarioComparison[] {
  const base = runIntegratedBusinessPlanningEngine(input, options);
  return scenarios.map((scenario) => {
    const result = runPlanningScenario(input, scenario, options);
    return {
      scenarioId: scenario.id,
      scenarioLabel: scenario.label,
      expectedUnitsDelta: round(result.summary.expectedUnits - base.summary.expectedUnits),
      procurementLakhDelta: round(
        result.summary.totalRecommendedProcurementLakh - base.summary.totalRecommendedProcurementLakh,
      ),
      minimumFreeLiquidityDeltaLakh: round(
        result.summary.minimumFreeLiquidityAfterRecommendationsLakh -
          base.summary.minimumFreeLiquidityAfterRecommendationsLakh,
      ),
      healthScoreDelta: result.summary.businessHealthScore - base.summary.businessHealthScore,
      findingDelta: result.findings.length - base.findings.length,
    };
  });
}
