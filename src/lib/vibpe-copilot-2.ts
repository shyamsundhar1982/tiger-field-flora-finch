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
  comparison?: IbpeScenarioComparison;
  horizonMonths?: number;
  doctrine: string;
  advisoryOnly: true;
};

function money(value: number) {
  return `₹${Number(value || 0).toFixed(1)}L`;
}

function scenarioAnswer(comparison: IbpeScenarioComparison) {
  const scenario = comparison.scenario;
  const baseline = comparison.baseline;
  const deltaFunding = scenario.funding.incrementalFundingNeedLakh - baseline.funding.incrementalFundingNeedLakh;
  const deltaLiquidity = scenario.summary.minimumFreeLiquidityAfterRecommendationsLakh - baseline.summary.minimumFreeLiquidityAfterRecommendationsLakh;
  return [
    `Scenario: ${comparison.request.label}.`,
    `Minimum free liquidity becomes ${money(scenario.summary.minimumFreeLiquidityAfterRecommendationsLakh)} (${deltaLiquidity >= 0 ? "+" : ""}${money(deltaLiquidity)} versus baseline).`,
    `Incremental funding need becomes ${money(scenario.funding.incrementalFundingNeedLakh)} (${deltaFunding >= 0 ? "+" : ""}${money(deltaFunding)} versus baseline).`,
    `Recommended procurement is ${money(scenario.summary.totalRecommendedProcurementLakh)} and capacity shortfall months are ${scenario.summary.capacityShortfallMonths}.`,
    "This scenario is advisory only; it does not modify the governed plan or create commitments.",
  ].join(" ");
}

function followUpAnswer(result: IntegratedPlanningResult, priorScenario?: IbpeScenarioRequest) {
  const target = priorScenario ? evaluateScenario(result, priorScenario).scenario : result;
  const top = target.findings.slice(0, 4);
  if (!top.length) return "No governed exception is currently ranked for follow-up. Review demand, materials, procurement, capacity and liquidity before changing the plan.";
  return `Next actions: ${top.map((finding) => `${finding.title} — ${finding.recommendedAction}`).join(" ")} Advisory only; approvals remain in owning workspaces.`;
}

export function runVibpeCopilot2(
  question: string,
  governedBaseline: IntegratedPlanningResult,
  options: { sessionKey?: string; uiScenario?: IbpeScenarioRequest } = {},
): VibpeCopilot2Result {
  const parsed = parseVibpeIntent(question);
  const sessionKey = options.sessionKey ?? "default";
  const session = getVibpeSession(sessionKey);
  const priorScenario = session.activeScenario ?? options.uiScenario;

  if (parsed.intent === "conversation") {
    updateVibpeSession(sessionKey, { lastIntent: parsed.intent, lastQuestion: question });
    return { intent: parsed.intent, answer: parsed.conversationalReply, doctrine: vibpeBusinessOperatorContext(), advisoryOnly: true };
  }

  if (parsed.intent === "follow-up") {
    updateVibpeSession(sessionKey, { lastIntent: parsed.intent, lastQuestion: question });
    return {
      intent: parsed.intent,
      answer: followUpAnswer(governedBaseline, priorScenario),
      scenario: priorScenario,
      doctrine: vibpeBusinessOperatorContext(),
      advisoryOnly: true,
    };
  }

  if (parsed.intent === "planning-horizon") {
    const horizonMonths = parsed.horizonMonths ?? session.planningHorizonMonths ?? 6;
    const target = priorScenario ? evaluateScenario(governedBaseline, priorScenario).scenario : governedBaseline;
    updateVibpeSession(sessionKey, { planningHorizonMonths: horizonMonths, lastIntent: parsed.intent, lastQuestion: question });
    return {
      intent: parsed.intent,
      answer: explainVibpeHorizon(target, horizonMonths),
      scenario: priorScenario,
      horizonMonths,
      doctrine: vibpeBusinessOperatorContext(),
      advisoryOnly: true,
    };
  }

  if (parsed.scenario) {
    const comparison = evaluateScenario(governedBaseline, parsed.scenario);
    updateVibpeSession(sessionKey, {
      previousScenario: priorScenario,
      activeScenario: parsed.scenario,
      planningHorizonMonths: parsed.horizonMonths ?? session.planningHorizonMonths,
      referencedProducts: parsed.referencedProducts,
      lastIntent: parsed.intent,
      lastQuestion: question,
    });
    return {
      intent: parsed.intent,
      answer: scenarioAnswer(comparison),
      scenario: parsed.scenario,
      comparison,
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
  return { intent: parsed.intent, scenario: priorScenario, doctrine: vibpeBusinessOperatorContext(), advisoryOnly: true };
}
