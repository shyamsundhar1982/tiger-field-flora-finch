import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { requireBusinessActor } from "@/lib/business-actor";
import {
  evaluateScenario,
  type IbpeScenarioComparison,
  type IbpeScenarioRequest,
} from "@/lib/ibpe-scenario-lab";
import type { IntegratedPlanningResult } from "@/lib/integrated-business-planning-engine";
import { VIBPE_COPILOT_NAME } from "@/lib/ibpe-brand";
import { RUNTIME_IBPE_ENGINE_VERSION } from "@/lib/ibpe-runtime-parity";
import { runVibpeCopilot2 } from "@/lib/vibpe-copilot-2";
import { retrieveVibpeKnowledgeEvidence, type VibpeKnowledgeEvidence } from "@/lib/vibpe-knowledge-retrieval";

export type IbpeCopilotRequest = {
  question: string;
  scenario?: IbpeScenarioRequest;
};

export type IbpeCopilotResponse = {
  ok: boolean;
  answer?: string;
  error?: string;
  mode?: "ai" | "deterministic";
  lineage?: {
    governedRunId: string;
    approvedPlanRevision: number;
    inputHash: string;
    sourceSha: string;
  };
  scenarioId?: string;
  advisoryOnly: true;
};

type IbpeValidationContext = Record<string, unknown>;
type LatestRunRow = {
  id: string;
  engine_version: string;
  approved_plan_revision: number | string;
  input_hash: string;
  source_sha: string;
  result_json: IntegratedPlanningResult;
  validation_json: IbpeValidationContext;
};

const BASE_SCENARIO: Omit<IbpeScenarioRequest, "id" | "label"> = {
  demandMultiplier: 1,
  capacityMultiplier: 1,
  procurementCostMultiplier: 1,
  leadTimeMultiplier: 1,
  receiptDelayMonths: 0,
  cashInjectionLakh: 0,
  cashInjectionPeriod: 6,
};

function sanitizeQuestion(value: unknown) {
  return String(value ?? "").trim().slice(0, 1800);
}

function money(value: number) {
  return `₹${Number(value || 0).toFixed(1)}L`;
}

function signedMoney(value: number) {
  const amount = Number(value || 0);
  return `${amount >= 0 ? "+" : "−"}₹${Math.abs(amount).toFixed(1)}L`;
}

function signedNumber(value: number, digits = 0) {
  const amount = Number(value || 0);
  return `${amount >= 0 ? "+" : ""}${amount.toFixed(digits)}`;
}

function splitQuestions(question: string) {
  const clean = question.replace(/[“”]/g, '"').trim();
  const questionMarks = clean.match(/[^?]+\?/g)?.map((part) => part.replace(/^\s*["']+|["']+\s*$/g, "").trim()).filter(Boolean) ?? [];
  if (questionMarks.length > 1) return questionMarks.slice(0, 8);
  const lines = clean.split(/\n+|;\s+/).map((part) => part.replace(/^\s*["']+|["']+\s*$/g, "").trim()).filter(Boolean);
  return lines.length > 1 ? lines.slice(0, 8) : [question];
}

function namedScenarioFromQuestion(question: string): IbpeScenarioRequest | undefined {
  const q = question.toLowerCase();
  const build = (id: string, label: string, patch: Partial<IbpeScenarioRequest>): IbpeScenarioRequest => ({
    ...BASE_SCENARIO,
    ...patch,
    id,
    label,
  });

  const familyGrowth = [
    { family: "longitude", productId: "aluminium", label: "Longitude" },
    { family: "latitude", productId: "carbon", label: "Latitude" },
    { family: "altitude", productId: "premiumCarbon", label: "Altitude" },
  ].find(({ family }) => q.includes(family) && /25\s*%/.test(q) && /demand|sales|units|growth|increase|increases|increased|higher/.test(q));

  if (familyGrowth) {
    return build(`${familyGrowth.family}-growth-25`, `${familyGrowth.label} demand +25%`, {
      demandMultiplierByProduct: { [familyGrowth.productId]: 1.25 },
    });
  }
  if (/growth\s*\+?\s*25|25%\s*growth|demand\s+(?:increase|increases|increased).*25\s*%/.test(q)) {
    return build("growth-25", "Growth +25%", { demandMultiplier: 1.25 });
  }
  if (/supply\s*shock/.test(q)) {
    return build("supply-shock", "Supply shock", {
      leadTimeMultiplier: 1.5,
      receiptDelayMonths: 2,
      procurementCostMultiplier: 1.12,
    });
  }
  if (/capacity\s*lift/.test(q)) {
    return build("capacity-lift", "Capacity lift", { capacityMultiplier: 1.3 });
  }
  if (/cash\s*protect/.test(q)) {
    return build("cash-protect", "Cash protect", {
      demandMultiplier: 0.85,
      procurementCostMultiplier: 0.95,
    });
  }
  if (/funding\s*bridge/.test(q)) {
    return build("funding-bridge", "Funding bridge", {
      cashInjectionLakh: 50,
      cashInjectionPeriod: 6,
    });
  }
  if (/severe\s*stress/.test(q)) {
    return build("severe-stress", "Severe stress", {
      demandMultiplier: 0.65,
      procurementCostMultiplier: 1.2,
      leadTimeMultiplier: 1.6,
      receiptDelayMonths: 3,
      capacityMultiplier: 0.85,
    });
  }
  return undefined;
}

function explicitlyRequestsBaseline(question: string) {
  return /\b(governed|approved)?\s*baseline\b|\bbase\s+case\b/.test(question.toLowerCase());
}

function isSmallTalk(question: string) {
  const q = question.toLowerCase().trim().replace(/[!?.,]+$/g, "").trim();
  return /^(hi|hello|hey|good morning|good afternoon|good evening|how are you|how r you)$/.test(q);
}

function isCausalQuestion(question: string) {
  return /\b(why|cause|caused|create|created|increase|increased|increases|change|changed|impact|effect|affect|affected|happens)\b/.test(
    question.toLowerCase(),
  );
}

function csvValidation(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function numericValidation(value: unknown) {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function requestedExecutiveDomains(question: string) {
  const q = question.toLowerCase();
  const domains = new Set<string>();
  const tests: Array<[string, RegExp]> = [
    ["demand", /demand|expected\s+units?|forecast\s+units?|volume/],
    ["procurement", /procure|purchase|material|mrp|supplier/],
    ["shortage", /shortage|stock|inventory|atp|msl/],
    ["capacity", /capacity|production|manufactur|bottleneck|work\s+centre|outsourc/],
    ["liquidity", /cash|liquid|trough|runway|free\s+liquidity/],
    ["funding", /fund|financ|budget|money/],
    ["breakeven", /break[-\s]?even|breakeven/],
    ["findings", /finding|health|risk|exception|issue/],
    ["costs", /unresolved\s+cost|missing\s+cost|cost\s+authority|price\s+coverage|cost\s+coverage|bom\s+cost|cogs/],
  ];
  for (const [domain, test] of tests) if (test.test(q)) domains.add(domain);
  return domains;
}

function isExecutiveAssessmentQuestion(question: string) {
  const q = question.toLowerCase();
  return requestedExecutiveDomains(question).size >= 3 || /executive\s+(assessment|summary)|complete\s+(assessment|summary)|full\s+(assessment|summary)|overall\s+(assessment|summary)/.test(q);
}

function compactResult(result: IntegratedPlanningResult) {
  const supply = [...result.supply]
    .filter((row) => row.committedFulfillmentShortageQty > 0 || row.recommendedPurchaseQty > 0)
    .sort((a, b) =>
      b.committedFulfillmentShortageQty - a.committedFulfillmentShortageQty ||
      (b.purchaseCostLakh ?? 0) - (a.purchaseCostLakh ?? 0),
    )
    .slice(0, 14);

  const capacity = [...result.capacity]
    .filter((row) => row.shortfallUnits > 0)
    .sort((a, b) => b.shortfallUnits - a.shortfallUnits)
    .slice(0, 10);

  const cash = [...result.cash]
    .sort((a, b) => a.freeLiquidityAfterRecommendationsLakh - b.freeLiquidityAfterRecommendationsLakh)
    .slice(0, 8);

  return {
    summary: result.summary,
    funding: result.funding,
    findings: result.findings.slice(0, 12),
    decisions: result.decisions.slice(0, 10),
    supply,
    capacity,
    lowestLiquidityMonths: cash,
  };
}

function compactValidation(validation: IbpeValidationContext) {
  return {
    activePlanningBomSkus: validation.activePlanningBomSkus,
    activePlanningBomResolvedCostSkus: validation.activePlanningBomResolvedCostSkus,
    activePlanningBomMissingCostSkus: validation.activePlanningBomMissingCostSkus,
    activePlanningBomLegacyReferenceOnlySkus: validation.activePlanningBomLegacyReferenceOnlySkus,
    committedMaterialRequirementRows: validation.committedMaterialRequirementRows,
    committedMaterialRequirementSkus: validation.committedMaterialRequirementSkus,
    committedRequirementMissingCostSkus: validation.committedRequirementMissingCostSkus,
    materialDemandReconciliation: validation.materialDemandReconciliation,
    committedMaterialAuthority: validation.committedMaterialAuthority,
    missingControlledCostSkus: validation.missingControlledCostSkus,
    procurementCostCoverageComplete: validation.procurementCostCoverageComplete,
    inventoryCostAuthority: validation.inventoryCostAuthority,
    bomCogsReconciliation: validation.bomCogsReconciliation,
    commercialBreakEvenPeriod: validation.commercialBreakEvenPeriod,
  };
}

function deterministicAnswer(
  question: string,
  result: IntegratedPlanningResult,
  scenarioLabel?: string,
  comparison?: IbpeScenarioComparison,
  includeEvidence = true,
  validation: IbpeValidationContext = {},
) {
  const q = question.toLowerCase();
  const prefix = scenarioLabel ? `Scenario: ${scenarioLabel}. ` : "Governed baseline. ";
  const findings = result.findings;
  const relevant = (domains: string[]) => findings.filter((finding) => domains.includes(finding.domain)).slice(0, 8);
  const actions = (domains: string[]) => [...new Set(relevant(domains).map((item) => item.recommendedAction).filter(Boolean))].slice(0, 4);
  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  const uniqueIssues = [...new Map(findings.map((item) => [`${item.title}|${item.recommendedAction}`, item])).values()]
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  const lines: string[] = [];

  if (isSmallTalk(question)) {
    return `Hi. ${VIBPE_COPILOT_NAME} is online and connected to the ${scenarioLabel ? `${scenarioLabel} scenario` : "governed baseline"}. Ask me about cash, funding, demand, materials, procurement, capacity, or a named scenario.`;
  }

  const low = [...result.cash].sort((a, b) => a.freeLiquidityAfterRecommendationsLakh - b.freeLiquidityAfterRecommendationsLakh)[0];
  const low12 = [...result.cash]
    .filter((row) => row.period <= 12)
    .sort((a, b) => a.freeLiquidityAfterRecommendationsLakh - b.freeLiquidityAfterRecommendationsLakh)[0];
  const firstBreach = result.funding.firstLiquidityBreachAfterRecommendationsPeriod;
  const fundingNeed = result.funding.incrementalFundingNeedLakh;
  const fundingNeed12 = Math.max(0, -(low12?.freeLiquidityAfterRecommendationsLakh ?? 0));
  const asksAboutFunding = /cash|fund|liquid|budget|runway|money|finance/.test(q);
  const asksBiggestConstraint = /biggest|main|primary|largest/.test(q) && /constraint|bottleneck|risk|problem|issue/.test(q) && /plan|business|approved/.test(q);
  const asksNext12Funding = asksAboutFunding && /next\s*12|12\s*months|coming\s*12|one\s*year/.test(q);
  const asksLargestCashMonth = /which\s+month|what\s+month|largest\s+cash\s+risk|lowest\s+(?:cash|liquid)|cash\s+trough/.test(q) && /cash|liquid|risk|trough/.test(q);
  const asksReduceFundingNoDelay = /reduce|lower|cut|minimi[sz]e/.test(q) && /fund|cash|liquid/.test(q) && /without.*delay|not.*delay|without delaying|launch/.test(q);

  if (isExecutiveAssessmentQuestion(question)) {
    const activeBomSkus = numericValidation(validation.activePlanningBomSkus) ?? 0;
    const resolvedCostSkus = numericValidation(validation.activePlanningBomResolvedCostSkus) ?? 0;
    const missingCostSkus = csvValidation(validation.missingControlledCostSkus);
    const referenceOnlySkus = csvValidation(validation.activePlanningBomLegacyReferenceOnlySkus);
    const breakEvenPeriod = numericValidation(validation.commercialBreakEvenPeriod);
    const reconciliation = Array.isArray(validation.bomCogsReconciliation)
      ? validation.bomCogsReconciliation as Array<Record<string, unknown>>
      : [];

    lines.push(
      `IBPE Executive Assessment: ${prefix}business health is ${result.summary.businessHealthScore}/100 across ${result.summary.expectedUnits.toFixed(0)} expected units.`,
      `Procurement & shortages: recommended procurement is ${money(result.summary.totalRecommendedProcurementLakh)}; ${result.summary.fulfillmentShortageSkuMonths} committed-supply shortage SKU-months are flagged.`,
      `Capacity: ${result.summary.capacityShortfallMonths} capacity shortfall months are flagged in the active horizon.`,
      `Cash & liquidity: minimum free liquidity after recommendations is ${money(result.summary.minimumFreeLiquidityAfterRecommendationsLakh)}${low ? `, with the trough at M${low.period}` : ""}.`,
      `Funding: incremental funding need is ${money(fundingNeed)}; first post-recommendation liquidity breach is ${firstBreach ? `M${firstBreach}` : "not present in the 36-month horizon"}.`,
      `Commercial EBITDA break-even: ${breakEvenPeriod ? `M${breakEvenPeriod}` : "not established inside the approved 36-month commercial model"}${scenarioLabel ? "; this marker comes from the approved commercial plan and Scenario Studio does not independently recompute P&L break-even" : ""}.`,
      `Findings: ${result.summary.findingCounts.critical} critical, ${result.summary.findingCounts.high} high, ${result.summary.findingCounts.medium} medium and ${result.summary.findingCounts.low} low.`,
    );
    if (activeBomSkus > 0) {
      lines.push(`Procurement cost authority: ${resolvedCostSkus}/${activeBomSkus} active planning-BOM SKUs have governed procurement cost coverage. ${missingCostSkus.length ? `Unresolved planned or exact committed requirement costs: ${missingCostSkus.join(", ")}.` : "No governed requirement cost exceptions remain."}`);
    }
    if (referenceOnlySkus.length) {
      lines.push(`Reference-price caution: ${referenceOnlySkus.join(", ")} have legacy/catalogue reference prices, but those references are intentionally excluded from procurement valuation until a controlled supplier/purchase/planning price is approved.`);
    }
    if (reconciliation.length) {
      const rows = reconciliation.map((row) => {
        const label = String(row.modelLabel ?? row.productId ?? "Model");
        const target = numericValidation(row.targetCogsLakh) ?? 0;
        const bottomUp = numericValidation(row.bottomUpBomCostLakh);
        const variance = numericValidation(row.varianceLakh);
        const missing = Array.isArray(row.missingSkus) ? row.missingSkus.map(String) : [];
        if (bottomUp === undefined) return `${label}: target COGS ${money(target)}, bottom-up BOM cost unresolved (${missing.length} missing SKU${missing.length === 1 ? "" : "s"})`;
        return `${label}: target COGS ${money(target)}, bottom-up BOM ${money(bottomUp)}, variance ${variance === undefined ? "n/a" : signedMoney(variance)}`;
      });
      lines.push(`COGS reconciliation: ${rows.join("; ")}.`);
    }
    if (scenarioLabel && comparison) {
      lines.push(`Scenario deltas versus baseline: expected units ${signedNumber(comparison.expectedUnitsDelta)}; procurement ${signedMoney(comparison.procurementLakhDelta)}; minimum free liquidity ${signedMoney(comparison.minimumFreeLiquidityAfterRecommendationsDeltaLakh)}; funding need ${signedMoney(comparison.fundingNeedDeltaLakh)}.`);
    }
    if (uniqueIssues.length) lines.push(`Highest-priority findings: ${uniqueIssues.slice(0, 4).map((item) => `${item.title} — ${item.recommendedAction}`).join(" ")}`);
    const nextActions = actions(["inventory", "supply", "procurement", "capacity", "finance", "funding", "planning"]);
    if (nextActions.length) lines.push(`Controlled next actions: ${nextActions.join(" ")}`);
    if (missingCostSkus.length) lines.push("Decision gate: do not treat the procurement valuation or derived funding recommendation as commercially complete until those planned or exact committed requirement cost exceptions are governed.");
  } else if (asksBiggestConstraint) {
    const top = uniqueIssues[0];
    lines.push(
      top
        ? `Biggest constraint: ${prefix}${top.title}. ${top.problem}`
        : `Biggest constraint: ${prefix}no discrete governed finding is currently ranked above the rest; business health is ${result.summary.businessHealthScore}/100.`,
    );
    if (top?.businessImpact) lines.push(`Business impact: ${top.businessImpact}`);
    if (top?.recommendedAction) lines.push(`Controlled next action: ${top.recommendedAction}`);
  } else if (asksNext12Funding) {
    lines.push(
      `Next-12-month funding requirement: ${prefix}${money(fundingNeed12)} of incremental liquidity is required to keep modelled free liquidity at or above zero through M12.`,
      low12
        ? `The weakest point inside the next 12 months is ${money(low12.freeLiquidityAfterRecommendationsLakh)} at M${low12.period}.`
        : "No next-12-month cash rows are available in the governed packet.",
      `For comparison, the full 36-month model requires ${money(fundingNeed)} of incremental liquidity.`,
    );
  } else if (asksLargestCashMonth) {
    lines.push(
      low
        ? `Largest cash-risk month: ${prefix}M${low.period}, where free liquidity after recommended procurement reaches ${money(low.freeLiquidityAfterRecommendationsLakh)}.`
        : `Largest cash-risk month: ${prefix}the governed packet does not contain a cash row.`,
      `The first post-recommendation liquidity breach is ${firstBreach ? `M${firstBreach}` : "not present in the 36-month horizon"}.`,
    );
  } else if (asksReduceFundingNoDelay) {
    const controlled = actions(["finance", "funding", "procurement", "inventory"]);
    lines.push(
      `Funding reduction without delaying launch: ${prefix}protect the launch date and reduce the pre-launch cash load rather than slowing the programme.`,
      `Highest-value levers to test are: phase procurement to the actual order-by periods, reduce supplier/unit procurement cost, improve payment terms where commercially available, and avoid non-critical early commitments. A funding bridge improves liquidity timing but does not reduce the underlying operating cash requirement.`,
    );
    if (controlled.length) lines.push(`Packet-backed controlled actions: ${controlled.join(" ")}`);
    lines.push(`Current model reference: incremental funding need ${money(fundingNeed)}; recommended procurement ${money(result.summary.totalRecommendedProcurementLakh)}.`);
  } else if (scenarioLabel && comparison && isCausalQuestion(question)) {
    const fundingDelta = comparison.fundingNeedDeltaLakh;
    const baselineFundingNeed = fundingNeed - fundingDelta;
    const liquidityDelta = comparison.minimumFreeLiquidityAfterRecommendationsDeltaLakh;
    const procurementDelta = comparison.procurementLakhDelta;

    lines.push(
      `Scenario impact: ${scenarioLabel} changes expected units by ${signedNumber(comparison.expectedUnitsDelta)} versus the governed baseline. Recommended procurement changes by ${signedMoney(procurementDelta)} and minimum free liquidity after recommendations changes by ${signedMoney(liquidityDelta)}.`,
      `Funding effect: ${money(baselineFundingNeed)} baseline → ${money(fundingNeed)} scenario (${signedMoney(fundingDelta)}).`,
      `Liquidity timing: baseline first breach ${comparison.baseFirstLiquidityBreachPeriod ? `M${comparison.baseFirstLiquidityBreachPeriod}` : "none"}; scenario first breach ${comparison.scenarioFirstLiquidityBreachPeriod ? `M${comparison.scenarioFirstLiquidityBreachPeriod}` : "none"}${low ? `; scenario trough ${money(low.freeLiquidityAfterRecommendationsLakh)} at M${low.period}` : ""}.`,
    );
    const nextActions = actions(["demand", "planning", "finance", "funding", "procurement", "capacity"]);
    if (nextActions.length) lines.push(`Controlled next actions: ${nextActions.join(" ")}`);
  } else if (/fund(?:ing)?\s+(requirement|requirements|need|needs)|how much.*fund|additional fund|incremental fund/.test(q)) {
    lines.push(
      `Funding requirement: ${prefix}${money(fundingNeed)} of incremental liquidity is required in the current model to prevent free liquidity from remaining negative.`,
      `Timing: the first post-recommendation liquidity breach is ${firstBreach ? `M${firstBreach}` : "not present in the 36-month horizon"}${low ? `; the lowest modelled point is ${money(low.freeLiquidityAfterRecommendationsLakh)} at M${low.period}` : ""}.`,
      `Procurement context: recommended procurement in this packet is ${money(result.summary.totalRecommendedProcurementLakh)}.`,
    );
    const missingCostSkus = csvValidation(validation.missingControlledCostSkus);
    if (missingCostSkus.length) {
      lines.push(`Data-quality caution: ${missingCostSkus.length} planned or exact committed procurement cost${missingCostSkus.length === 1 ? " is" : "s are"} unresolved (${missingCostSkus.join(", ")}). Do not treat this as the complete material-funding requirement until those costs are governed.`);
    }
    const nextActions = actions(["finance", "funding", "procurement"]);
    if (nextActions.length) lines.push(`Controlled next actions: ${nextActions.join(" ")}`);
  } else if (asksAboutFunding) {
    if (/prevent|avoid|becoming negative|stay positive|keep.*positive|above zero/.test(q)) {
      lines.push(
        `Minimum modelled intervention: ${prefix}secure at least ${money(fundingNeed)} of incremental liquidity effective no later than ${firstBreach ? `M${firstBreach}` : "the first projected breach"}, or preserve the same amount through controlled cost/pace actions.`,
        `${low ? `The current trough is ${money(low.freeLiquidityAfterRecommendationsLakh)} at M${low.period}. ` : ""}This amount prevents negative modelled free liquidity; a higher reserve-floor target may require more funding than the packet's incremental-need figure.`,
      );
    } else {
      lines.push(
        `Assessment: ${prefix}minimum free liquidity after recommended procurement is ${money(result.summary.minimumFreeLiquidityAfterRecommendationsLakh)}${low ? `, with the lowest modelled month at M${low.period}` : ""}. Incremental funding need is ${money(fundingNeed)}.`,
        `Main drivers: recommended procurement totals ${money(result.summary.totalRecommendedProcurementLakh)}; the first post-recommendation liquidity breach is ${firstBreach ? `M${firstBreach}` : "not present in the 36-month horizon"}.`,
      );
    }
    const nextActions = actions(["finance", "funding", "procurement"]);
    if (nextActions.length) lines.push(`Controlled next actions: ${nextActions.join(" ")}`);
  } else if (/material|inventory|stock|purchase|procure|mrp|supplier|shortage|atp|msl/.test(q)) {
    const rows = [...result.supply]
      .filter((row) => row.committedFulfillmentShortageQty > 0 || row.recommendedPurchaseQty > 0)
      .sort((a, b) =>
        Number(b.recommendationIsLate) - Number(a.recommendationIsLate) ||
        a.orderByPeriod - b.orderByPeriod ||
        b.committedFulfillmentShortageQty - a.committedFulfillmentShortageQty ||
        (b.purchaseCostLakh ?? 0) - (a.purchaseCostLakh ?? 0),
      )
      .slice(0, 5);
    lines.push(
      `Material priority: ${prefix}${result.summary.fulfillmentShortageSkuMonths} SKU-months have committed-supply shortages and recommended procurement totals ${money(result.summary.totalRecommendedProcurementLakh)}.`,
    );
    if (rows.length) {
      lines.push(`Buy first: ${rows.map((row) => {
        const timing = row.recommendationIsLate || row.orderByPeriod < 1 ? "late / immediate" : `order by M${row.orderByPeriod}`;
        return `${row.sku} for M${row.period}: ${timing}, ${row.demandBasis} demand (plan ${row.plannedRequirementQty.toFixed(1)} / committed ${row.committedRequirementQty.toFixed(1)}), shortage ${row.committedFulfillmentShortageQty.toFixed(1)}, recommended buy ${row.recommendedPurchaseQty.toFixed(1)}${row.purchaseCostLakh == null ? "" : ` (${money(row.purchaseCostLakh)})`}`;
      }).join("; ")}.`);
    }
    const missingCostSkus = csvValidation(validation.missingControlledCostSkus);
    if (missingCostSkus.length) lines.push(`Unresolved planned or exact committed requirement costs: ${missingCostSkus.join(", ")}. Legacy/catalogue prices do not satisfy procurement cost authority.`);
    const nextActions = actions(["inventory", "supply", "procurement"]);
    if (nextActions.length) lines.push(`Controlled next actions: ${nextActions.join(" ")}`);
  } else if (/capacity|production|manufactur|work centre|bottleneck|outsourc/.test(q)) {
    const rows = [...result.capacity].filter((row) => row.shortfallUnits > 0).sort((a, b) => b.shortfallUnits - a.shortfallUnits).slice(0, 5);
    lines.push(`Assessment: ${prefix}${result.summary.capacityShortfallMonths} capacity shortfall months are flagged in the active horizon.`);
    if (rows.length) lines.push(`Largest shortfalls: ${rows.map((row) => `${row.id} M${row.period}: ${row.shortfallUnits.toFixed(1)} units`).join("; ")}.`);
    const nextActions = actions(["capacity", "planning"]);
    if (nextActions.length) lines.push(`Controlled next actions: ${nextActions.join(" ")}`);
  } else {
    lines.push(
      `Assessment: ${prefix}business health is ${result.summary.businessHealthScore}/100 across ${result.summary.expectedUnits.toFixed(0)} expected units. Recommended procurement is ${money(result.summary.totalRecommendedProcurementLakh)} and minimum free liquidity after recommendations is ${money(result.summary.minimumFreeLiquidityAfterRecommendationsLakh)}.`,
      `Exceptions: ${result.summary.findingCounts.critical} critical, ${result.summary.findingCounts.high} high, ${result.summary.findingCounts.medium} medium and ${result.summary.findingCounts.low} low findings.`,
    );
    if (uniqueIssues.length) lines.push(`Highest-priority issues: ${uniqueIssues.slice(0, 4).map((item) => `${item.title} — ${item.recommendedAction}`).join(" ")}`);
  }

  if (includeEvidence) lines.push("Evidence: deterministic VYNDI IBPE decision packet. This is advisory analysis only; approvals and transactions remain in their owning workspaces.");
  return lines.join("\n\n");
}

function systemPrompt() {
  return [
    `You are ${VIBPE_COPILOT_NAME} for Vayu Shastr Private Limited.`,
    "You are an advisory exploration agent sitting on top of a deterministic Integrated Business Planning Engine.",
    "The deterministic IBPE packet is the authority for quantities, cash, MRP, ATP/MSL, capacity, funding and scenario deltas. Never invent or recompute numbers outside the supplied packet.",
    "Weekly-review knowledge evidence is advisory or unresolved context only. It may explain progress, blockers, decisions, design, prototype, incubation and launch readiness, but it must never override governed internal/master data or deterministic IBPE transaction truth.",
    "When weekly-review evidence conflicts with governed internal knowledge, use the governed value and identify the review item as historical or unresolved evidence.",
    "If you use weekly-review evidence, preserve its provenance by naming the source review date/title when practical and state unresolved status explicitly.",
    "Always distinguish plan, forecast, committed and actual truth. A scenario is hypothetical forecast analysis and must never be described as an approved plan or actual transaction.",
    "If the user asks multiple distinct questions, answer every question separately and in the same order.",
    "If the user asks for several executive metrics in one question, return one complete IBPE Executive Assessment covering every requested domain.",
    "If the user explicitly names a scenario, answer that named scenario rather than a stale UI scenario context.",
    "For causal scenario questions, compare the scenario with the governed baseline and use the supplied deltas. Correct a false premise if the scenario did not actually increase the metric the user asks about.",
    "Procurement cost authority is FIFO actual, then approved purchase/supplier price, then approved planning procurement price. Legacy/catalogue reference prices are not procurement authority.",
    "Material demand is reconciled by SKU and month: keep planning-BOM demand and exact released job-card demand visible, then use the larger requirement rather than adding forecast and commitment together.",
    "When discussing unresolved costs, emphasize active approved planning-BOM and exact released job-card requirement SKUs from validation; do not flood the response with unrelated inventory-master cost gaps.",
    "Handle greetings and conversational small talk naturally and briefly instead of dumping the business-health packet.",
    "Never repeat an identical recommendation merely because several findings carry the same action.",
    "You may recommend actions, trade-offs and questions to investigate, but you must never claim that you created a purchase order, reservation, job card, accounting posting, funding draw, approval or plan revision.",
    "When data is insufficient, say exactly what is missing.",
    "Prefer concise executive reasoning with: Assessment; Main drivers; Feasible options; Recommended controlled next action; Evidence.",
    "Use month labels like M1..M36 and lakh units exactly as supplied. Mention the governed plan revision/input hash when it materially supports provenance.",
  ].join(" ");
}

async function latestRun() {
  const sql = await getSql();
  const rows = await sql.query<LatestRunRow>(
    `select id,engine_version,approved_plan_revision,input_hash,source_sha,result_json,validation_json
       from vyndi_ibpe_runs where status='complete' order by created_at desc limit 1`,
  );
  const row = rows[0];
  if (!row) throw new Error("No governed IBPE run exists. Run governed IBPE first.");
  if (row.engine_version !== RUNTIME_IBPE_ENGINE_VERSION) {
    throw new Error(`Latest governed IBPE run predates exact committed-material reconciliation. Run governed IBPE 1.3 once before using ${VIBPE_COPILOT_NAME} so released job-card requirements participate in procurement and funding analysis.`);
  }
  return { sql, row };
}

export const askIbpeCopilot = createServerFn({ method: "POST" })
  .validator((input: IbpeCopilotRequest) => ({
    question: sanitizeQuestion(input.question),
    scenario: input.scenario,
  }))
  .handler(async ({ data }): Promise<IbpeCopilotResponse> => {
    const actor = await requireBusinessActor("view");
    if (!data.question) return { ok: false, error: "Ask a question first.", advisoryOnly: true };

    const { sql, row } = await latestRun();
    const lineage = {
      governedRunId: row.id,
      approvedPlanRevision: Number(row.approved_plan_revision),
      inputHash: row.input_hash,
      sourceSha: row.source_sha,
    };
    const questions = splitQuestions(data.question);
    let knowledgeEvidence: VibpeKnowledgeEvidence[] = [];
    try {
      knowledgeEvidence = await retrieveVibpeKnowledgeEvidence(sql, data.question, 10);
    } catch {
      // Knowledge evidence is supplementary. A migration/configuration lag must
      // not make the governed deterministic Co-Pilot unavailable.
      knowledgeEvidence = [];
    }
    const scenarioCache = new Map<string, Awaited<ReturnType<typeof evaluateScenario>>>();

    async function resolveQuestion(question: string) {
      const namedScenario = namedScenarioFromQuestion(question);
      const effectiveScenario = namedScenario ?? (explicitlyRequestsBaseline(question) ? undefined : data.scenario);
      if (!effectiveScenario) {
        return {
          result: row.result_json,
          scenarioId: undefined as string | undefined,
          scenarioLabel: undefined as string | undefined,
          scenarioComparison: undefined as IbpeScenarioComparison | undefined,
          scenarioContext: null as unknown,
        };
      }
      const key = JSON.stringify(effectiveScenario);
      let packet = scenarioCache.get(key);
      if (!packet) {
        packet = await evaluateScenario(sql, effectiveScenario);
        scenarioCache.set(key, packet);
      }
      return {
        result: packet.result,
        scenarioId: packet.scenario.id,
        scenarioLabel: packet.scenario.label,
        scenarioComparison: packet.comparison,
        scenarioContext: {
          scenario: packet.scenario,
          comparisonVsGovernedBaseline: packet.comparison,
        } as unknown,
      };
    }

    let answer = "";
    let mode: "ai" | "deterministic" = "deterministic";
    let scenarioId: string | undefined;
    const scenarioIds = new Set<string>();
    const executiveAssessment = questions.length === 1 && isExecutiveAssessmentQuestion(data.question);
    let vibpe2: Awaited<ReturnType<typeof runVibpeCopilot2>> | undefined;
    let vibpe2FallbackReason: "runtime-error" | undefined;
    if (questions.length === 1) {
      try {
        vibpe2 = await runVibpeCopilot2(sql, data.question, row.result_json, {
          sessionKey: actor.userId,
          uiScenario: data.scenario,
        });
      } catch {
        // VIBPE 2.0 is advisory: a runtime-specific failure must not take down
        // the governed deterministic/AI Co-Pilot response path.
        vibpe2FallbackReason = "runtime-error";
      }
    }
    const handledByVibpe2 = Boolean(vibpe2?.answer);

    if (handledByVibpe2 && vibpe2?.answer) {
      answer = vibpe2.answer;
      scenarioId = vibpe2.scenario?.id;
      if (scenarioId) scenarioIds.add(scenarioId);
    } else if (questions.length > 1) {
      const sections: string[] = [];
      for (const [index, question] of questions.entries()) {
        const resolved = await resolveQuestion(question);
        if (resolved.scenarioId) scenarioIds.add(resolved.scenarioId);
        sections.push(
          `${index + 1}. ${question.replace(/\?\s*$/, "")}\n${deterministicAnswer(
            question,
            resolved.result,
            resolved.scenarioLabel,
            resolved.scenarioComparison,
            false,
            row.validation_json ?? {},
          )}`,
        );
      }
      if (scenarioIds.size === 1) scenarioId = [...scenarioIds][0];
      answer = `${sections.join("\n\n")}\n\nEvidence: deterministic VYNDI IBPE decision packet. Each numbered answer uses the governed baseline unless that question explicitly requests, or the UI supplies, a scenario. This is advisory analysis only; approvals and transactions remain in their owning workspaces.`;
    } else {
      const resolved = await resolveQuestion(data.question);
      scenarioId = resolved.scenarioId;
      if (scenarioId) scenarioIds.add(scenarioId);
      answer = deterministicAnswer(data.question, resolved.result, resolved.scenarioLabel, resolved.scenarioComparison, true, row.validation_json ?? {});
      const apiKey = isSmallTalk(data.question) || executiveAssessment ? undefined : process.env.XAI_API_KEY;

      if (apiKey) {
        const context = {
          lineage,
          scenario: resolved.scenarioContext,
          ibpe: compactResult(resolved.result),
          validation: compactValidation(row.validation_json ?? {}),
          knowledgeEvidence: knowledgeEvidence.map((item) => ({
            claim: item.claimText,
            class: item.claimClass,
            authority: item.authority,
            domain: item.domain,
            sourceTitle: item.title,
            reviewDate: item.reviewDate,
            sourceRevision: item.sourceRevision,
            sourceUrl: item.externalUrl,
          })),
        };
        try {
          const response = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "grok-4.5",
              temperature: 0.2,
              max_tokens: 900,
              messages: [
                { role: "system", content: systemPrompt() },
                {
                  role: "user",
                  content: `Question: ${data.question}\n\nGoverned IBPE context:\n${JSON.stringify(context)}`,
                },
              ],
            }),
          });
          if (response.ok) {
            const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
            const aiAnswer = body.choices?.[0]?.message?.content?.trim() ?? "";
            if (aiAnswer) {
              answer = aiAnswer;
              mode = "ai";
            }
          }
        } catch {
          // Deterministic IBPE explanation remains available if the external AI service fails.
        }
      }
    }

    const questionHash = createHash("sha256").update(data.question).digest("hex");
    await sql.query(
      `insert into vyndi_audit_events
        (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
       values ($1,'ibpe_copilot',$2,$3,'explored',$4,$5,$6,$7::jsonb)`,
      [
        `AUD-IBPE-AI-${crypto.randomUUID()}`,
        row.id,
        Number(row.approved_plan_revision),
        actor.userId,
        actor.role,
        `IBPE:${row.input_hash.slice(0,12)}`,
        JSON.stringify({
          questionHash,
          questionCount: questions.length,
          scenarioId: scenarioId ?? null,
          scenarioIds: [...scenarioIds],
          mode,
          executiveAssessment,
          answerChars: answer.length,
          knowledgeEvidenceCount: knowledgeEvidence.length,
          knowledgeEvidenceDocumentIds: [...new Set(knowledgeEvidence.map((item) => item.documentId))],
          copilotVersion: handledByVibpe2 ? "2.0" : "legacy-fallback",
          vibpe2FallbackReason: vibpe2FallbackReason ?? null,
        }),
      ],
    );

    return {
      ok: true,
      answer,
      mode,
      lineage,
      scenarioId,
      advisoryOnly: true,
    };
  });
