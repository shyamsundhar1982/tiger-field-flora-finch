export type OperatingPlanMilestoneId =
  | "foundation"
  | "engineeringBaseline"
  | "prototypeValidation"
  | "toolingPilot"
  | "commercialLaunch";

export type OperatingPlanProductId = "longitude" | "latitude" | "altitude";
export type PlanningScenarioId = "base" | "delayed" | "stress";

export type OperatingPlan = {
  schemaVersion: 1;
  horizonStart: string;
  horizonMonths: 36;
  milestoneMonths: Record<OperatingPlanMilestoneId, number>;
  productLaunchMonths: Record<OperatingPlanProductId, number>;
  demandScale: number;
  /**
   * Optional base-plan unit overrides by relative plan month ("1".."36").
   * These are planning inputs only. They never create Commercial orders,
   * Production job cards, inventory, travellers or supplier commitments.
   */
  monthlyDemandOverrides?: Record<string, number>;
  fundingTimingOffsetMonths: number;
  cashFloorLakh: number;
  note: string;
};

export type PlanningRisk = {
  severity: "high" | "medium" | "low";
  code: string;
  message: string;
};

export const DEFAULT_APPROVED_OPERATING_PLAN: OperatingPlan = {
  schemaVersion: 1,
  horizonStart: "2026-09",
  horizonMonths: 36,
  milestoneMonths: {
    foundation: 1,
    engineeringBaseline: 3,
    prototypeValidation: 6,
    toolingPilot: 10,
    commercialLaunch: 14,
  },
  productLaunchMonths: {
    longitude: 14,
    latitude: 14,
    altitude: 16,
  },
  demandScale: 1,
  monthlyDemandOverrides: {},
  fundingTimingOffsetMonths: 0,
  cashFloorLakh: 15,
  note: "Initial approved rolling operating plan. Baseline commercial launch is Month 14.",
};

const BASE_DEMAND_RAMP = [
  3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 10, 10, 12, 12, 14, 14, 16, 16, 18, 18, 20, 20,
  22, 22, 24, 24, 26, 26, 28, 28, 30, 30, 32, 32, 34, 34,
] as const;

const SCENARIO_DELAY: Record<PlanningScenarioId, number> = { base: 0, delayed: 3, stress: 6 };
const SCENARIO_DEMAND_FACTOR: Record<PlanningScenarioId, number> = {
  base: 1,
  delayed: 0.8,
  stress: 0.45,
};
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const clampRelativeMonth = (value: number) => Math.max(-120, Math.min(36, Math.round(value)));

function normalizeMonthlyDemandOverrides(overrides?: Record<string, number>) {
  const normalized: Record<string, number> = {};
  for (const [monthKey, unitsValue] of Object.entries(overrides ?? {})) {
    const month = Number(monthKey);
    const units = Number(unitsValue);
    if (!Number.isInteger(month) || month < 1 || month > 36 || !Number.isFinite(units)) continue;
    normalized[String(month)] = Math.max(0, Math.min(1_000_000, Math.round(units)));
  }
  return normalized;
}

function shiftMonthlyDemandOverrides(overrides: Record<string, number> | undefined, deltaMonths: number) {
  const shifted: Record<string, number> = {};
  for (const [monthKey, units] of Object.entries(overrides ?? {})) {
    const shiftedMonth = Number(monthKey) + deltaMonths;
    if (shiftedMonth >= 1 && shiftedMonth <= 36) shifted[String(shiftedMonth)] = units;
  }
  return shifted;
}

export function normalizeOperatingPlan(plan: OperatingPlan): OperatingPlan {
  return {
    ...plan,
    schemaVersion: 1,
    horizonMonths: 36,
    horizonStart: MONTH_PATTERN.test(plan.horizonStart)
      ? plan.horizonStart
      : DEFAULT_APPROVED_OPERATING_PLAN.horizonStart,
    milestoneMonths: {
      foundation: clampRelativeMonth(plan.milestoneMonths.foundation),
      engineeringBaseline: clampRelativeMonth(plan.milestoneMonths.engineeringBaseline),
      prototypeValidation: clampRelativeMonth(plan.milestoneMonths.prototypeValidation),
      toolingPilot: clampRelativeMonth(plan.milestoneMonths.toolingPilot),
      commercialLaunch: clampRelativeMonth(plan.milestoneMonths.commercialLaunch),
    },
    productLaunchMonths: {
      longitude: clampRelativeMonth(plan.productLaunchMonths.longitude),
      latitude: clampRelativeMonth(plan.productLaunchMonths.latitude),
      altitude: clampRelativeMonth(plan.productLaunchMonths.altitude),
    },
    demandScale: Math.max(0, Math.min(5, Number(plan.demandScale) || 0)),
    monthlyDemandOverrides: normalizeMonthlyDemandOverrides(plan.monthlyDemandOverrides),
    fundingTimingOffsetMonths: Math.max(-12, Math.min(24, Math.round(plan.fundingTimingOffsetMonths))),
    cashFloorLakh: Math.max(0, Math.min(500, Number(plan.cashFloorLakh) || 0)),
    note: plan.note?.trim().slice(0, 1000) || "Rolling 36-month operating plan.",
  };
}

export function scenarioDelayMonths(scenario: PlanningScenarioId) {
  return SCENARIO_DELAY[scenario];
}

export function effectiveMilestoneMonth(
  plan: OperatingPlan,
  milestone: OperatingPlanMilestoneId,
  scenario: PlanningScenarioId = "base",
) {
  return clampRelativeMonth(plan.milestoneMonths[milestone] + scenarioDelayMonths(scenario));
}

export function effectiveProductLaunchMonth(
  plan: OperatingPlan,
  product: OperatingPlanProductId,
  scenario: PlanningScenarioId = "base",
) {
  return clampRelativeMonth(plan.productLaunchMonths[product] + scenarioDelayMonths(scenario));
}

export function unitsForPlanMonth(
  plan: OperatingPlan,
  month: number,
  scenario: PlanningScenarioId = "base",
) {
  // Monthly overrides belong to the base plan. Scenario timing shifts the base
  // month forward while scenario demand factors still apply consistently.
  const sourceMonth = month - scenarioDelayMonths(scenario);
  if (sourceMonth < 1 || sourceMonth > 36) return 0;

  const override = plan.monthlyDemandOverrides?.[String(sourceMonth)];
  if (override !== undefined) {
    return Math.max(0, Math.round(override * SCENARIO_DEMAND_FACTOR[scenario]));
  }

  const index = sourceMonth - plan.milestoneMonths.commercialLaunch;
  if (index < 0) return 0;
  const base = BASE_DEMAND_RAMP[Math.min(index, BASE_DEMAND_RAMP.length - 1)] ?? 0;
  return Math.max(0, Math.round(base * plan.demandScale * SCENARIO_DEMAND_FACTOR[scenario]));
}

export function fundingGateMonth(
  plan: OperatingPlan,
  gateId: string,
  scenario: PlanningScenarioId = "base",
) {
  if (gateId === "T1") return plan.milestoneMonths.foundation;
  const launch = effectiveMilestoneMonth(plan, "commercialLaunch", scenario);
  const offsets: Record<string, number> = { T2: -11, T3: -8, STBY: -5, T4: -4, T5: 0 };
  return clampRelativeMonth(launch + (offsets[gateId] ?? 0) + plan.fundingTimingOffsetMonths);
}

export function shiftOperatingPlan(plan: OperatingPlan, deltaMonths: number): OperatingPlan {
  const delta = Math.max(-12, Math.min(24, Math.round(deltaMonths)));
  return normalizeOperatingPlan({
    ...plan,
    milestoneMonths: {
      foundation: plan.milestoneMonths.foundation,
      engineeringBaseline: plan.milestoneMonths.engineeringBaseline + delta,
      prototypeValidation: plan.milestoneMonths.prototypeValidation + delta,
      toolingPilot: plan.milestoneMonths.toolingPilot + delta,
      commercialLaunch: plan.milestoneMonths.commercialLaunch + delta,
    },
    productLaunchMonths: {
      longitude: plan.productLaunchMonths.longitude + delta,
      latitude: plan.productLaunchMonths.latitude + delta,
      altitude: plan.productLaunchMonths.altitude + delta,
    },
    monthlyDemandOverrides: shiftMonthlyDemandOverrides(plan.monthlyDemandOverrides, delta),
  });
}

function addCalendarMonths(month: string, delta: number) {
  const [yearText, monthText] = month.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function rollOperatingPlan(plan: OperatingPlan, months = 1): OperatingPlan {
  const delta = Math.max(1, Math.min(12, Math.round(months)));
  return normalizeOperatingPlan({
    ...plan,
    horizonStart: addCalendarMonths(plan.horizonStart, delta),
    milestoneMonths: {
      foundation: plan.milestoneMonths.foundation - delta,
      engineeringBaseline: plan.milestoneMonths.engineeringBaseline - delta,
      prototypeValidation: plan.milestoneMonths.prototypeValidation - delta,
      toolingPilot: plan.milestoneMonths.toolingPilot - delta,
      commercialLaunch: plan.milestoneMonths.commercialLaunch - delta,
    },
    productLaunchMonths: {
      longitude: plan.productLaunchMonths.longitude - delta,
      latitude: plan.productLaunchMonths.latitude - delta,
      altitude: plan.productLaunchMonths.altitude - delta,
    },
    monthlyDemandOverrides: shiftMonthlyDemandOverrides(plan.monthlyDemandOverrides, -delta),
  });
}

export function calendarMonthForPlanMonth(plan: OperatingPlan, planMonth: number) {
  const month = addCalendarMonths(plan.horizonStart, Math.round(planMonth) - 1);
  const [yearText, monthText] = month.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 1));
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export function operatingPlanHorizonLabel(plan: OperatingPlan) {
  return `${calendarMonthForPlanMonth(plan, 1)} – ${calendarMonthForPlanMonth(plan, 36)}`;
}

export function relativePlanMonthLabel(month: number) {
  if (month > 0) return `M${month}`;
  if (month === 0) return "Prior month";
  return `${Math.abs(month)} mo prior`;
}

export function planningRisks(plan: OperatingPlan): PlanningRisk[] {
  const risks: PlanningRisk[] = [];
  const m = plan.milestoneMonths;
  if (m.engineeringBaseline > 0 && m.engineeringBaseline < 2)
    risks.push({ severity: "high", code: "ENGINEERING-COMPRESSION", message: "Engineering baseline is compressed into the first month." });
  if (m.prototypeValidation > 0 && m.engineeringBaseline > 0 && m.prototypeValidation - m.engineeringBaseline < 3)
    risks.push({ severity: "high", code: "VALIDATION-COMPRESSION", message: "Less than three months separate engineering baseline and prototype validation." });
  if (m.toolingPilot > 0 && m.prototypeValidation > 0 && m.toolingPilot - m.prototypeValidation < 2)
    risks.push({ severity: "high", code: "TOOLING-COMPRESSION", message: "Tooling/pilot starts less than two months after validation." });
  if (m.commercialLaunch > 0 && m.toolingPilot > 0 && m.commercialLaunch - m.toolingPilot < 3)
    risks.push({ severity: "high", code: "LAUNCH-COMPRESSION", message: "Commercial launch has less than three months of pilot and launch-readiness time." });
  if (m.commercialLaunch > 0 && Object.values(plan.productLaunchMonths).some((month) => month > 0 && month < m.commercialLaunch))
    risks.push({ severity: "high", code: "PRODUCT-BEFORE-LAUNCH", message: "A product launch is scheduled before the commercial launch gate." });
  if (plan.demandScale > 1.5)
    risks.push({ severity: "medium", code: "DEMAND-ACCELERATION", message: "Demand is more than 50% above baseline; check supply and production capacity." });
  if (plan.fundingTimingOffsetMonths > 0)
    risks.push({ severity: "medium", code: "FUNDING-DELAY", message: `Funding is delayed by ${plan.fundingTimingOffsetMonths} month(s) relative to milestone need.` });
  if (plan.fundingTimingOffsetMonths < 0)
    risks.push({ severity: "low", code: "FUNDING-EARLY", message: `Funding is planned ${Math.abs(plan.fundingTimingOffsetMonths)} month(s) earlier than milestone need.` });
  return risks;
}
