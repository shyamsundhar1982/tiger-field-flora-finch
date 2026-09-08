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

const GOVERNED_COST_ENGINE_VERSION = "VYNDI-IBPE-1.2.0";

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

function namedScenarioFromQuestion(question: string): IbpeScenarioRequest | undefined {
  const q = question.toLowerCase();
  const build = (id: string, label: string, patch: Partial<IbpeScenarioRequest>): IbpeScenarioRequest => ({
    ...BASE_SCENARIO,
    ...patch,
    id,
    label,
  });

  if (/growth\s*\+?\s*25|25%\s*growth/.test(q)) {
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
  return /\b(why|cause|caused|create|created|increase|increased|change|changed|impact|effect|affect|affected)\b/.test(
    question.toLowerCase(),
  );
}

function csvValidation(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function numericValidation(value: unknown) {
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
  const domains = requestedExecutiveDomains(question);
  return domains.size >= 3 || /executive\s+(assessment|summary)|complete\s+(assessment|summary)|full\s+(assessment|summary)|overall\s+(assessment|summary)/.test(q);
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
    procurementCostCoverageComplete: validation.procurementCostCoverageComplete,
    inventoryCostAuthority: validation.inventoryCostAuthority,
    bomCogsReconciliation: validation.bomCogsReconciliation,
    commercialBreakEvenPeriod: validation.commercialBreakEvenPeriod,
  };
}

function deterministicAnswer(
  question: string,
  result: IntegratedPlanningResult,
  validation: IbpeValidationContext,
  scenarioLabel?: string,
  comparison?: IbpeScenarioComparison,
) {
  const q = question.toLowerCase();
  const prefix = scenarioLabel ? `Scenario: ${scenarioLabel}. ` : "Governed baseline. ";
  const findings = result.findings;
  const relevant = (domains: string[]) => findings.filter((finding) => domains.includes(finding.domain)).slice(0, 8);
  const actions = (domains: string[]) => [...new Set(relevant(domains).map((item) => item.recommendedAction).filter(Boolean))].slice(0, 4);
  const uniqueIssues = [...new Map(findings.map((item) => [`${item.title}|${item.recommendedAction}`, item])).values()];
  const lines: string[] = [];

  if (isSmallTalk(question)) {
    return `Hi. IBPE Copilot is online and connected to the ${scenarioLabel ? `${scenarioLabel} scenario` : "governed baseline"}. Ask me about cash, funding, demand, materials, procurement, capacity, or a named scenario.`;
  }

  const low = [...result.cash].sort((a, b) => a.freeLiquidityAfterRecommendationsLakh - b.freeLiquidityAfterRecommendationsLakh)[0];
  const firstBreach = result.funding.firstLiquidityBreachAfterRecommendationsPeriod;
  const fundingNeed = result.funding.incrementalFundingNeedLakh;
  const asksAboutFunding = /cash|fund|liquid|budget|runway|money|finance/.test(q);

  if (isExecutiveAssessmentQuestion(question)) {
    const activeBomSkus = numericValidation(validation.activePlanningBomSkus) ?? 0;
    const resolvedCostSkus = numericValidation(validation.activePlanningBomResolvedCostSkus) ?? 0;
    const missingCostSkus = csvValidation(validation.activePlanningBomMissingCostSkus);
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
      lines.push(`Procurement cost authority: ${resolvedCostSkus}/${activeBomSkus} active planning-BOM SKUs have governed procurement cost coverage. ${missingCostSkus.length ? `Unresolved active-BOM costs: ${missingCostSkus.join(", ")}.` : "No active planning-BOM cost exceptions remain."}`);
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
    if (missingCostSkus.length) lines.push("Decision gate: do not treat the procurement valuation or derived funding recommendation as commercially complete until those active planning-BOM cost exceptions are governed.");
  } else if (scenarioLabel && comparison && isCausalQuestion(question) && asksAboutFunding) {
    const fundingDelta = comparison.fundingNeedDeltaLakh;
    const baselineFundingNeed = fundingNeed - fundingDelta;
    const liquidityDelta = comparison.minimumFreeLiquidityAfterRecommendationsDeltaLakh;
    const procurementDelta = comparison.procurementLakhDelta;
    const effectivelyZeroFundingDelta = Math.abs(fundingDelta) < 0.05;

    if (effectivelyZeroFundingDelta) {
      lines.push(
        `Causal assessment: Scenario: ${scenarioLabel}. This scenario does not create additional modelled funding need versus the governed baseline. Both currently require ${money(fundingNeed)} of incremental liquidity.`,
      );
    } else if (fundingDelta > 0) {
      lines.push(
        `Causal assessment: Scenario: ${scenarioLabel}. The scenario increases modelled funding need by ${money(fundingDelta)}, from ${money(baselineFundingNeed)} in the governed baseline to ${money(fundingNeed)}.`,
      );
    } else {
      lines.push(
        `Causal assessment: Scenario: ${scenarioLabel}. The scenario reduces modelled funding need by ${money(Math.abs(fundingDelta))}, from ${money(baselineFundingNeed)} in the governed baseline to ${money(fundingNeed)}.`,
      );
    }

    lines.push(
      `Scenario deltas versus baseline: expected units ${signedNumber(comparison.expectedUnitsDelta)}; recommended procurement ${signedMoney(procurementDelta)}; minimum free liquidity after recommendations ${signedMoney(liquidityDelta)}.`,
      `Liquidity timing: baseline first breach ${comparison.baseFirstLiquidityBreachPeriod ? `M${comparison.baseFirstLiquidityBreachPeriod}` : "none"}; scenario first breach ${comparison.scenarioFirstLiquidityBreachPeriod ? `M${comparison.scenarioFirstLiquidityBreachPeriod}` : "none"}${low ? `; scenario trough ${money(low.freeLiquidityAfterRecommendationsLakh)} at M${low.period}` : ""}.`,
    );

    if (result.summary.totalRecommendedProcurementLakh === 0 && relevant(["inventory", "supply", "procurement"]).length > 0) {
      lines.push(
        "Data-quality caution: the packet contains supply/procurement findings but no recommended purchase value. Govern active planning-BOM procurement prices before attributing a complete material-funding effect to this scenario.",
      );
    }

    const nextActions = actions(["finance", "funding", "procurement"]);
    if (nextActions.length) lines.push(`Controlled next actions: ${nextActions.join(" ")}`);
  } else if (/fund(?:ing)?\s+(requirement|requirements|need|needs)|how much.*fund|additional fund|incremental fund/.test(q)) {
    lines.push(
      `Funding requirement: ${prefix}${money(fundingNeed)} of incremental liquidity is required in the current model to prevent free liquidity from remaining negative.`,
      `Timing: the first post-recommendation liquidity breach is ${firstBreach ? `M${firstBreach}` : "not present in the 36-month horizon"}${low ? `; the lowest modelled point is ${money(low.freeLiquidityAfterRecommendationsLakh)} at M${low.period}` : ""}.`,
      `Procurement context: recommended procurement in this packet is ${money(result.summary.totalRecommendedProcurementLakh)}.`,
    );
    const missingCostSkus = csvValidation(validation.activePlanningBomMissingCostSkus);
    if (missingCostSkus.length) {
      lines.push(`Data-quality caution: ${missingCostSkus.length} active planning-BOM procurement cost${missingCostSkus.length === 1 ? " is" : "s are"} unresolved (${missingCostSkus.join(", ")}). Do not treat this as the complete material-funding requirement until those costs are governed.`);
    }
    const nextActions = actions(["finance", "funding", "procurement"]);
    if (nextActions.length) lines.push(`Controlled next actions: ${nextActions.join(" ")}`);
  } else if (asksAboutFunding) {
    if (/prevent|avoid|becoming negative|stay positive|keep.*positive|above zero/.test(q)) {
      lines.push(
        `Minimum modelled intervention: ${prefix}secure at least ${money(fundingNeed)} of incremental liquidity effective no later than ${firstBreach ? `M${firstBreach}` : "the first projected breach"}, or preserve the same amount through controlled cost/pace actions.`,
        `${low ? `The current trough is ${money(low.freeLiquidityAfterRecommendationsLakh)} at M${low.period}. ` : ""}This amount prevents negative modeled free liquidity; a higher reserve-floor target may require more funding than the packet's incremental-need figure.`,
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
      .sort((a, b) => b.committedFulfillmentShortageQty - a.committedFulfillmentShortageQty)
      .slice(0, 5);
    lines.push(
      `Assessment: ${prefix}${result.summary.fulfillmentShortageSkuMonths} SKU-months have committed-supply shortages and recommended procurement totals ${money(result.summary.totalRecommendedProcurementLakh)}.`,
    );
    if (rows.length) {
      lines.push(`Priority material rows: ${rows.map((row) => `${row.sku} M${row.period}: shortage ${row.committedFulfillmentShortageQty.toFixed(1)}, recommended buy ${row.recommendedPurchaseQty.toFixed(1)}${row.purchaseCostLakh == null ? "" : ` (${money(row.purchaseCostLakh)})`}`).join("; ")}.`);
    }
    const missingCostSkus = csvValidation(validation.activePlanningBomMissingCostSkus);
    if (missingCostSkus.length) lines.push(`Unresolved active planning-BOM costs: ${missingCostSkus.join(", ")}. Legacy/catalogue prices do not satisfy procurement cost authority.`);
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

  lines.push("Evidence: deterministic VYNDI IBPE decision packet. This is advisory analysis only; approvals and transactions remain in their owning workspaces.");
  return lines.join("\n\n");
}

function systemPrompt() {
  return [
    "You are VYNDI IBPE Copilot for Vayu Shastr Private Limited.",
    "You are an advisory exploration agent sitting on top of a deterministic Integrated Business Planning Engine.",
    "The deterministic IBPE packet is the authority for quantities, cash, MRP, ATP/MSL, capacity, funding and scenario deltas. Never invent or recompute numbers outside the supplied packet.",
    "Always distinguish plan, forecast, committed and actual truth. A scenario is hypothetical forecast analysis and must never be described as an approved plan or actual transaction.",
    "If the user explicitly names a scenario, answer that named scenario rather than a stale UI scenario context.",
    "For causal scenario questions, compare the scenario with the governed baseline and use the supplied deltas. Correct a false premise if the scenario did not actually increase the metric the user asks about.",
    "For multi-metric executive questions, answer every requested domain rather than selecting only one intent.",
    "Procurement cost authority is FIFO actual, then approved purchase/supplier price, then approved planning procurement price. Legacy/catalogue reference prices are not procurement authority.",
    "When discussing unresolved costs, emphasize active approved planning-BOM SKUs from validation; do not flood the response with unrelated inventory-master cost gaps.",
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
  if (row.engine_version !== GOVERNED_COST_ENGINE_VERSION) {
    throw new Error("Latest governed IBPE run predates the Procurement Cost Authority. Run governed IBPE once before using Copilot so catalogue/reference prices cannot masquerade as procurement cost.");
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
    let result = row.result_json;
    let scenarioContext: unknown = null;
    let scenarioId: string | undefined;
    let scenarioLabel: string | undefined;
    let scenarioComparison: IbpeScenarioComparison | undefined;

    const namedScenario = namedScenarioFromQuestion(data.question);
    const effectiveScenario = namedScenario ?? (explicitlyRequestsBaseline(data.question) ? undefined : data.scenario);

    if (effectiveScenario) {
      const packet = await evaluateScenario(sql, effectiveScenario);
      result = packet.result;
      scenarioId = packet.scenario.id;
      scenarioLabel = packet.scenario.label;
      scenarioComparison = packet.comparison;
      scenarioContext = {
        scenario: packet.scenario,
        comparisonVsGovernedBaseline: packet.comparison,
      };
    }

    const lineage = {
      governedRunId: row.id,
      approvedPlanRevision: Number(row.approved_plan_revision),
      inputHash: row.input_hash,
      sourceSha: row.source_sha,
    };

    const executiveAssessment = isExecutiveAssessmentQuestion(data.question);
    let answer = deterministicAnswer(data.question, result, row.validation_json ?? {}, scenarioLabel, scenarioComparison);
    let mode: "ai" | "deterministic" = "deterministic";
    const apiKey = isSmallTalk(data.question) || executiveAssessment ? undefined : process.env.XAI_API_KEY;

    if (apiKey) {
      const context = {
        lineage,
        scenario: scenarioContext,
        ibpe: compactResult(result),
        validation: compactValidation(row.validation_json ?? {}),
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
        JSON.stringify({ questionHash, scenarioId: scenarioId ?? null, mode, executiveAssessment, answerChars: answer.length }),
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