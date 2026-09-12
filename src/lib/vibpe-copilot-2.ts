import type { Sql } from "@/lib/db";
import type { IntegratedPlanningResult } from "@/lib/integrated-business-planning-engine";
import type { IbpeScenarioComparison, IbpeScenarioRequest } from "@/lib/ibpe-scenario-lab";
import { evaluateScenario } from "@/lib/ibpe-scenario-lab";
import { parseVibpeIntent, type VibpeScenarioParse } from "@/lib/vibpe-intent";
import { retrieveVibpeKnowledgeEvidence, type VibpeKnowledgeEvidence } from "@/lib/vibpe-knowledge-retrieval";
import { tryGovernanceDataAnswer } from "@/lib/vibpe-governance-queries";
import { tryOperationalDataAnswer } from "@/lib/vibpe-operational-queries";
import { explainVibpeHorizon } from "@/lib/vibpe-planning";
import { vibpeBusinessOperatorContext } from "@/lib/vibpe-business-operator";
import { getVibpeSession, updateVibpeSession } from "@/lib/vibpe-session";

export type VibpeCopilot2Result = {
  intent: VibpeScenarioParse["intent"];
  answer?: string;
  scenario?: IbpeScenarioRequest;
  scenarioResult?: IntegratedPlanningResult;
  comparison?: IbpeScenarioComparison;
  horizonMonths?: number;
  doctrine: string;
  advisoryOnly: true;
};

function money(value: number) {
  return `₹${Number(value || 0).toFixed(1)}L`;
}

function signedMoney(value: number) {
  const amount = Number(value || 0);
  return `${amount >= 0 ? "+" : "−"}₹${Math.abs(amount).toFixed(1)}L`;
}

function quantity(value: number) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 1 });
}

function isKnowledgeQuestion(question: string) {
  const q = question.toLowerCase();
  const knowledgeTopic = /\b(fork|axle[-\s]?to[-\s]?crown|a[-\s]?c|geometry|clearance|tyre|tire|wheelbase|chainstay|head tube|bottom bracket|\bbb\b|t47|headset|crank|stack|reach|trail|offset|layup|laminate|carbon|prepreg|toray|t700|t800|t1100|fea|cfd|dossier|cad|iso 4210|bis|is 10613|quality|apqp|fai|ncr|rcca|traveller|router|warranty|consumer|legal metrology|dpdp|privacy|contract|\bip\b|patent|trademark|trade mark|employment|payroll|epf|labour code|anthropometr|bike fit|ride metric|ftp|vo2|max|spo2)\b/i.test(q);
  if (!knowledgeTopic) return false;

  const explicitIbpeMetric = /\b(capacity shortfall|production capacity|work centre|work center|cash|liquidity|funding|runway|mrp|atp|msl|procurement total|recommended procurement|demand forecast|scenario|baseline health|business health)\b/i.test(q);
  return !explicitIbpeMetric;
}

function knowledgeAuthorityLabel(evidence: VibpeKnowledgeEvidence[]) {
  if (evidence.some((item) => item.authority === "unresolved")) return "UNRESOLVED / NON-GOVERNING";
  return "ADVISORY / NON-GOVERNING";
}

const KNOWLEDGE_EVIDENCE_STOP_WORDS = new Set([
  "about", "authority", "approved", "automatic", "before", "changed", "current", "design",
  "evidence", "governing", "master", "production", "released", "should", "toward", "treat",
  "what", "when", "where", "which", "why", "with", "would",
]);

function knowledgeEvidenceTerms(question: string) {
  return [...new Set(
    question
      .toLowerCase()
      .replace(/[^a-z0-9.+-]+/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !KNOWLEDGE_EVIDENCE_STOP_WORDS.has(token)),
  )].slice(0, 16);
}

function selectKnowledgeAnswerEvidence(question: string, evidence: VibpeKnowledgeEvidence[]) {
  if (evidence.length <= 1) return evidence;
  const primary = evidence[0];
  const terms = knowledgeEvidenceTerms(question);
  const seen = new Set([primary.claimText]);

  const supporting = evidence
    .slice(1)
    .map((item, index) => {
      const haystack = [item.claimText, item.title, item.sourceLocator ?? "", item.sourcePath ?? ""]
        .join(" ")
        .toLowerCase();
      const directMatches = terms.filter((term) => haystack.includes(term)).length;
      return { item, directMatches, index };
    })
    .filter(({ item, directMatches }) => directMatches > 0 && !seen.has(item.claimText))
    .sort((a, b) => b.directMatches - a.directMatches || a.index - b.index)
    .slice(0, 2)
    .map(({ item }) => {
      seen.add(item.claimText);
      return item;
    });

  return [primary, ...supporting];
}

function knowledgeAnswer(question: string, evidence: VibpeKnowledgeEvidence[]) {
  if (!evidence.length) return undefined;
  const selected = selectKnowledgeAnswerEvidence(question, evidence);
  const primary = selected[0];
  const asksAuthority = /production authority|design authority|released|approved|governing|master authority|can i treat|can we treat|is .* authority/i.test(question);
  const authority = knowledgeAuthorityLabel(selected);

  const lines = [
    `Knowledge-grounded assessment: ${primary.claimText}`,
  ];

  if (asksAuthority) {
    if (selected.some((item) => item.authority === "unresolved")) {
      lines.push("Authority: No. This evidence is unresolved/non-governing and cannot be treated as production or design authority. Verify the current released controlled master before manufacture, release or transaction use.");
    } else {
      lines.push("Authority: This is advisory knowledge, not automatic production or design authority. The current released controlled master remains governing.");
    }
  } else {
    lines.push(`Authority: ${authority}. Governed internal/master data takes precedence.`);
  }

  if (selected.length > 1) {
    lines.push(`Supporting evidence: ${selected.slice(1).map((item) => item.claimText).join(" ")}`);
  }
  lines.push(`Evidence source: ${primary.title}${primary.reviewDate ? ` · ${primary.reviewDate}` : ""}${primary.sourceLocator ? ` · ${primary.sourceLocator}` : ""}.`);
  return lines.join("\n\n");
}

function scenarioAnswer(
  scenario: IbpeScenarioRequest,
  result: IntegratedPlanningResult,
  comparison: IbpeScenarioComparison,
) {
  return [
    `Scenario: ${scenario.label}.`,
    `Minimum free liquidity becomes ${money(result.summary.minimumFreeLiquidityAfterRecommendationsLakh)} (${signedMoney(comparison.minimumFreeLiquidityAfterRecommendationsDeltaLakh)} versus baseline).`,
    `Incremental funding need becomes ${money(result.funding.incrementalFundingNeedLakh)} (${signedMoney(comparison.fundingNeedDeltaLakh)} versus baseline).`,
    `Recommended procurement is ${money(result.summary.totalRecommendedProcurementLakh)} (${signedMoney(comparison.procurementLakhDelta)} versus baseline) and capacity shortfall months are ${result.summary.capacityShortfallMonths}.`,
    `First liquidity breach is ${result.funding.firstLiquidityBreachAfterRecommendationsPeriod ? `M${result.funding.firstLiquidityBreachAfterRecommendationsPeriod}` : "not present in the modelled horizon"}.`,
    "This scenario is advisory only; it does not modify the governed plan or create commitments.",
  ].join(" ");
}

function followUpAnswer(result: IntegratedPlanningResult) {
  const top = result.findings.slice(0, 4);
  if (!top.length) {
    return "No governed exception is currently ranked for follow-up. Review demand, materials, procurement, capacity and liquidity before changing the plan.";
  }
  return `Next actions: ${top.map((finding) => `${finding.title} — ${finding.recommendedAction}`).join(" ")} Advisory only; approvals remain in owning workspaces.`;
}

const severityRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;

function rankedFindings(result: IntegratedPlanningResult) {
  return [...result.findings].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

function topActions(result: IntegratedPlanningResult, limit = 4) {
  return [...new Set(rankedFindings(result).map((finding) => finding.recommendedAction).filter(Boolean))].slice(0, limit);
}

function asksCommittedDemandFeasibility(question: string) {
  const q = question.toLowerCase();
  const committedDemand = /committed[^.?!]{0,30}demand|demand[^.?!]{0,30}committed/.test(q);
  const feasibility = /\b(produc(?:e|ed|ible|tion)|make|made|build|built|fulfil|fulfill|deliver|meet|cover|feasible|possible)\b/.test(q);
  return committedDemand && feasibility;
}

function committedDemandFeasibilityAnswer(result: IntegratedPlanningResult) {
  const materialShortages = [...result.supply]
    .filter((row) => row.committedFulfillmentShortageQty > 0)
    .sort((a, b) => b.committedFulfillmentShortageQty - a.committedFulfillmentShortageQty);
  const capacityShortfalls = [...result.capacity]
    .filter((row) => row.shortfallUnits > 0)
    .sort((a, b) => b.shortfallUnits - a.shortfallUnits);
  const committedShortageQty = materialShortages.reduce((sum, row) => sum + row.committedFulfillmentShortageQty, 0);
  const capacityShortfallUnits = capacityShortfalls.reduce((sum, row) => sum + row.shortfallUnits, 0);
  const fullyCovered = materialShortages.length === 0 && capacityShortfalls.length === 0;
  const lines = [
    `Committed-demand feasibility: ${fullyCovered ? "FEASIBLE in the governed model" : "AT RISK / not fully demonstrated"}.`,
    `Committed open demand is ${quantity(result.summary.committedOpenUnits)} units. Material coverage shows ${materialShortages.length} shortage SKU-month${materialShortages.length === 1 ? "" : "s"} affecting ${quantity(committedShortageQty)} units of committed requirement.`,
    `Capacity shows ${result.summary.capacityShortfallMonths} shortfall month${result.summary.capacityShortfallMonths === 1 ? "" : "s"}${capacityShortfalls.length ? ` and ${quantity(capacityShortfallUnits)} aggregate modeled shortfall units` : ""}.`,
  ];

  if (materialShortages.length) {
    lines.push(`Largest committed material gaps: ${materialShortages.slice(0, 5).map((row) => `${row.sku} M${row.period}: ${quantity(row.committedFulfillmentShortageQty)}`).join("; ")}.`);
  }
  if (capacityShortfalls.length) {
    lines.push(`Largest capacity gaps: ${capacityShortfalls.slice(0, 4).map((row) => `${row.id} M${row.period}: ${quantity(row.shortfallUnits)} units`).join("; ")}.`);
  }

  const actions = topActions(result, 4);
  if (actions.length) lines.push(`Required controlled actions: ${actions.join(" ")}`);
  lines.push("Conclusion: VIBPE should not promise production of all committed demand while any committed material shortage or modeled capacity shortfall remains open. Advisory only; production release and commitments remain in their owning workspaces.");
  return lines.join("\n\n");
}

function intentAnswer(intent: VibpeScenarioParse["intent"], question: string, result: IntegratedPlanningResult) {
  if (asksCommittedDemandFeasibility(question)) return committedDemandFeasibilityAnswer(result);

  const actions = topActions(result, 4);
  const top = rankedFindings(result).slice(0, 4);

  if (intent === "demand") {
    const rows = [...result.demand]
      .sort((a, b) => b.remainingDemandQty - a.remainingDemandQty || Math.abs(b.varianceToPlanQty) - Math.abs(a.varianceToPlanQty))
      .slice(0, 5);
    return [
      `Demand assessment: ${quantity(result.summary.expectedUnits)} expected units, including ${quantity(result.summary.committedOpenUnits)} committed open units in the governed horizon.`,
      rows.length ? `Largest demand positions: ${rows.map((row) => `${row.productId} M${row.period}: expected ${quantity(row.expectedTotalQty)}, committed ${quantity(row.committedQty)}, variance to plan ${quantity(row.varianceToPlanQty)}`).join("; ")}.` : "No demand rows are available in the governed packet.",
      actions.length ? `Controlled next actions: ${actions.join(" ")}` : "No demand-related management action is currently ranked.",
    ].join("\n\n");
  }

  if (intent === "materials") {
    const shortages = [...result.supply]
      .filter((row) => row.committedFulfillmentShortageQty > 0 || row.recommendedPurchaseQty > 0)
      .sort((a, b) => b.committedFulfillmentShortageQty - a.committedFulfillmentShortageQty || b.recommendedPurchaseQty - a.recommendedPurchaseQty)
      .slice(0, 6);
    return [
      `Materials assessment: ${result.summary.fulfillmentShortageSkuMonths} committed-supply shortage SKU-months are flagged.`,
      shortages.length ? `Priority material positions: ${shortages.map((row) => `${row.sku} M${row.period}: committed shortage ${quantity(row.committedFulfillmentShortageQty)}, recommended buy ${quantity(row.recommendedPurchaseQty)}`).join("; ")}.` : "No committed material shortage or purchase recommendation is active in the governed packet.",
      actions.length ? `Controlled next actions: ${actions.join(" ")}` : "No material action is currently ranked.",
    ].join("\n\n");
  }

  if (intent === "procurement") {
    const purchases = [...result.supply]
      .filter((row) => row.recommendedPurchaseQty > 0)
      .sort((a, b) => (b.purchaseCostLakh ?? 0) - (a.purchaseCostLakh ?? 0) || b.recommendedPurchaseQty - a.recommendedPurchaseQty)
      .slice(0, 6);
    return [
      `Procurement assessment: recommended procurement is ${money(result.summary.totalRecommendedProcurementLakh)}.`,
      purchases.length ? `Priority recommendations: ${purchases.map((row) => `${row.sku} M${row.period}: buy ${quantity(row.recommendedPurchaseQty)}${row.purchaseCostLakh != null ? ` (${money(row.purchaseCostLakh)})` : ""}${row.recommendationIsLate ? ", inside lead time" : ""}`).join("; ")}.` : "No purchase recommendation is active in the governed packet.",
      actions.length ? `Controlled next actions: ${actions.join(" ")}` : "No procurement action is currently ranked.",
    ].join("\n\n");
  }

  if (intent === "capacity") {
    const rows = [...result.capacity]
      .filter((row) => row.shortfallUnits > 0)
      .sort((a, b) => b.shortfallUnits - a.shortfallUnits)
      .slice(0, 6);
    return [
      `Capacity assessment: ${result.summary.capacityShortfallMonths} shortfall month${result.summary.capacityShortfallMonths === 1 ? "" : "s"} are flagged in the governed horizon.`,
      rows.length ? `Largest capacity gaps: ${rows.map((row) => `${row.id} M${row.period}: required ${quantity(row.requiredUnits)}, available ${quantity(row.availableCapacityUnits)}, shortfall ${quantity(row.shortfallUnits)}`).join("; ")}.` : "No modeled capacity shortfall is active.",
      actions.length ? `Controlled next actions: ${actions.join(" ")}` : "No capacity action is currently ranked.",
    ].join("\n\n");
  }

  if (intent === "funding") {
    const trough = [...result.cash].sort((a, b) => a.freeLiquidityAfterRecommendationsLakh - b.freeLiquidityAfterRecommendationsLakh)[0];
    return [
      `Funding assessment: minimum free liquidity after recommendations is ${money(result.summary.minimumFreeLiquidityAfterRecommendationsLakh)}${trough ? ` at M${trough.period}` : ""}.`,
      `Incremental funding need is ${money(result.funding.incrementalFundingNeedLakh)}; first post-recommendation liquidity breach is ${result.funding.firstLiquidityBreachAfterRecommendationsPeriod ? `M${result.funding.firstLiquidityBreachAfterRecommendationsPeriod}` : "not present in the modeled horizon"}.`,
      actions.length ? `Controlled next actions: ${actions.join(" ")}` : "No funding action is currently ranked.",
    ].join("\n\n");
  }

  if (intent === "root-cause") {
    return top.length
      ? `Root-cause view: ${top.map((finding) => `${finding.title} — ${finding.problem} Impact: ${finding.businessImpact} Action: ${finding.recommendedAction}`).join("\n\n")}`
      : "No governed exception is currently available for root-cause ranking.";
  }

  if (intent === "baseline" || intent === "assessment") {
    return [
      `Business health: ${result.summary.businessHealthScore}/100 across ${quantity(result.summary.expectedUnits)} expected units and ${quantity(result.summary.committedOpenUnits)} committed open units.`,
      `Operational exposure: ${result.summary.fulfillmentShortageSkuMonths} committed-supply shortage SKU-months; ${result.summary.capacityShortfallMonths} capacity shortfall months; recommended procurement ${money(result.summary.totalRecommendedProcurementLakh)}.`,
      `Liquidity: minimum free liquidity after recommendations is ${money(result.summary.minimumFreeLiquidityAfterRecommendationsLakh)}; incremental funding need is ${money(result.funding.incrementalFundingNeedLakh)}.`,
      top.length ? `Highest-priority findings: ${top.map((finding) => `${finding.title} — ${finding.recommendedAction}`).join(" ")}` : "No governed findings are currently ranked.",
    ].join("\n\n");
  }

  if (intent === "optimisation") {
    return "Optimization intent detected. Use Command → VIBPE → Optimizer to execute the governed HiGHS operator surface against an exact immutable advanced-planning packet. Chat remains advisory and cannot auto-run the optimizer.";
  }

  if (intent === "navigation") {
    return "Navigation request detected. VIBPE can identify the owning workspace, but protected business actions still require the relevant workspace and human confirmation.";
  }

  return undefined;
}

async function resolvePriorScenario(
  sql: Sql,
  governedBaseline: IntegratedPlanningResult,
  priorScenario?: IbpeScenarioRequest,
) {
  if (!priorScenario) return governedBaseline;
  return (await evaluateScenario(sql, priorScenario)).result;
}

export async function runVibpeCopilot2(
  sql: Sql,
  question: string,
  governedBaseline: IntegratedPlanningResult,
  options: { sessionKey?: string; uiScenario?: IbpeScenarioRequest } = {},
): Promise<VibpeCopilot2Result> {
  const parsed = parseVibpeIntent(question);
  const sessionKey = options.sessionKey ?? "default";
  const session = getVibpeSession(sessionKey);
  const priorScenario = session.activeScenario ?? options.uiScenario;

  try {
    const governanceAnswer = await tryGovernanceDataAnswer(sql, question);
    if (governanceAnswer) {
      updateVibpeSession(sessionKey, { lastIntent: parsed.intent, lastQuestion: question });
      return {
        intent: parsed.intent,
        answer: governanceAnswer,
        doctrine: vibpeBusinessOperatorContext(),
        advisoryOnly: true,
      };
    }
  } catch {
    // Cross-workspace governance/health queries are read-only. If a governed
    // source is temporarily unavailable, continue through normal VIBPE routing.
  }

  try {
    const operationalAnswer = await tryOperationalDataAnswer(sql, question);
    if (operationalAnswer) {
      updateVibpeSession(sessionKey, { lastIntent: parsed.intent, lastQuestion: question });
      return {
        intent: parsed.intent,
        answer: operationalAnswer,
        doctrine: vibpeBusinessOperatorContext(),
        advisoryOnly: true,
      };
    }
  } catch {
    // Operational lookup is supplementary to the governed IBPE packet. If a
    // view is temporarily unavailable, continue through normal VIBPE routing.
  }

  if (isKnowledgeQuestion(question)) {
    try {
      const evidence = await retrieveVibpeKnowledgeEvidence(sql, question, 8);
      const answer = knowledgeAnswer(question, evidence);
      if (answer) {
        updateVibpeSession(sessionKey, { lastIntent: parsed.intent, lastQuestion: question });
        return {
          intent: parsed.intent,
          answer,
          doctrine: vibpeBusinessOperatorContext(),
          advisoryOnly: true,
        };
      }
    } catch {
      // Knowledge retrieval is supplementary. If unavailable, continue to the
      // normal deterministic IBPE path instead of making Co-Pilot unavailable.
    }
  }

  if (parsed.intent === "conversation") {
    updateVibpeSession(sessionKey, { lastIntent: parsed.intent, lastQuestion: question });
    return {
      intent: parsed.intent,
      answer: parsed.conversationalReply,
      doctrine: vibpeBusinessOperatorContext(),
      advisoryOnly: true,
    };
  }

  if (parsed.intent === "follow-up") {
    const target = await resolvePriorScenario(sql, governedBaseline, priorScenario);
    updateVibpeSession(sessionKey, { lastIntent: parsed.intent, lastQuestion: question });
    return {
      intent: parsed.intent,
      answer: followUpAnswer(target),
      scenario: priorScenario,
      scenarioResult: target,
      doctrine: vibpeBusinessOperatorContext(),
      advisoryOnly: true,
    };
  }

  if (parsed.intent === "planning-horizon") {
    const horizonMonths = parsed.horizonMonths ?? session.planningHorizonMonths ?? 6;
    const target = await resolvePriorScenario(sql, governedBaseline, priorScenario);
    updateVibpeSession(sessionKey, {
      planningHorizonMonths: horizonMonths,
      lastIntent: parsed.intent,
      lastQuestion: question,
    });
    return {
      intent: parsed.intent,
      answer: explainVibpeHorizon(target, horizonMonths),
      scenario: priorScenario,
      scenarioResult: target,
      horizonMonths,
      doctrine: vibpeBusinessOperatorContext(),
      advisoryOnly: true,
    };
  }

  if (parsed.scenario) {
    const packet = await evaluateScenario(sql, parsed.scenario);
    updateVibpeSession(sessionKey, {
      previousScenario: priorScenario,
      activeScenario: packet.scenario,
      planningHorizonMonths: parsed.horizonMonths ?? session.planningHorizonMonths,
      referencedProducts: parsed.referencedProducts,
      lastIntent: parsed.intent,
      lastQuestion: question,
    });
    return {
      intent: parsed.intent,
      answer: scenarioAnswer(packet.scenario, packet.result, packet.comparison),
      scenario: packet.scenario,
      scenarioResult: packet.result,
      comparison: packet.comparison,
      horizonMonths: parsed.horizonMonths,
      doctrine: vibpeBusinessOperatorContext(),
      advisoryOnly: true,
    };
  }

  const answer = intentAnswer(parsed.intent, question, governedBaseline);
  updateVibpeSession(sessionKey, {
    referencedProducts: parsed.referencedProducts,
    lastIntent: parsed.intent,
    lastQuestion: question,
  });
  return {
    intent: parsed.intent,
    answer,
    doctrine: vibpeBusinessOperatorContext(),
    advisoryOnly: true,
  };
}
