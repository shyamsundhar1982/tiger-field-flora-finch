import type { Sql } from "@/lib/db";
import type { IntegratedPlanningResult } from "@/lib/integrated-business-planning-engine";
import type { IbpeScenarioComparison, IbpeScenarioRequest } from "@/lib/ibpe-scenario-lab";
import { evaluateScenario } from "@/lib/ibpe-scenario-lab";
import { parseVibpeIntent, type VibpeScenarioParse } from "@/lib/vibpe-intent";
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

  updateVibpeSession(sessionKey, {
    referencedProducts: parsed.referencedProducts,
    lastIntent: parsed.intent,
    lastQuestion: question,
  });
  return {
    intent: parsed.intent,
    scenario: priorScenario,
    doctrine: vibpeBusinessOperatorContext(),
    advisoryOnly: true,
  };
}
