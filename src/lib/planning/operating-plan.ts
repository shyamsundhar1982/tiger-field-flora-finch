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
  fundingTimingOffsetMonths: 0,
  cashFloorLakh: 15,
  note: "Initial approved rolling operating plan. Baseline commercial launch is Month 14.",
};

export const MILESTONE_DEFINITIONS: Record<
  OperatingPlanMilestoneId,
  {
    phase: string;
    owner: string;
    dependency: string;
    evidence: string;
    route: string;
    actionIds: readonly string[];
  }
> = {
  foundation: {
    phase: "Foundation",
    owner: "Founder",
    dependency: "Incorporation + banking",
    evidence: "Foundation execution",
    route: "/command/founder-command",
    actionIds: ["FC-01", "FC-04", "FC-05"],
  },
  engineeringBaseline: {
    phase: "Engineering baseline",
    owner: "Engineering",
    dependency: "VEDM reconciliation + controlled BOM",
    evidence: "Controlled engineering baseline",
    route: "/command/engineering",
    actionIds: ["FC-02", "FC-03"],
  },
  prototypeValidation: {
    phase: "Prototype & validation",
    owner: "Engineering + QA",
    dependency: "Design freeze",
    evidence: "Prototype / NDT / ISO evidence",
    route: "/command/qa-verification",
    actionIds: ["FC-08"],
  },
  toolingPilot: {
    phase: "Tooling & pilot",
    owner: "Operations",
    dependency: "Validation release",
    evidence: "Tooling + pilot release",
    route: "/command/manufacturing",
    actionIds: ["FC-07"],
  },
  commercialLaunch: {
    phase: "Commercial launch",
    owner: "Founder + Commercial",
    dependency: "Inventory + working capital + release gates",
    evidence: "Customer shipment readiness",
    route: "/command/sales",
    actionIds: ["FC-09"],
  },
};

const BASE_DEMAND_RAMP = [
  3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 10, 10, 12, 12, 14, 14, 16, 16, 18, 18, 20, 20, 22, 22,
  24, 24, 26, 26, 28, 28, 30, 30, 32, 32, 34, 34,
] as const;

const SCENARIO_DELAY: Record<PlanningScenarioId, number> = {
  base: 0,
  delayed: 3,
  stress: 6,
};

const SCENARIO_DEMAND_FACTOR: Record<PlanningScenarioId, number> = {
  base: 1,
  delayed: 0.8,
  stress: 0.45,
};

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const clampMonth = (value: number) => Math.max(1, Math.min(36, Math.round(value)));

export function normalizeOperatingPlan(plan: OperatingPlan): OperatingPlan {
  return {
    ...plan,
    schemaVersion: 1,
    horizonMonths: 36,
    horizonStart: MONTH_PATTERN.test(plan.horizonStart)
      ? plan.horizonStart
      : DEFAULT_APPROVED_OPERATING_PLAN.horizonStart,
    milestoneMonths: {
      foundation: clampMonth(plan.milestoneMonths.foundation),
      engineeringBaseline: clampMonth(plan.milestoneMonths.engineeringBaseline),
      prototypeValidation: clampMonth(plan.milestoneMonths.prototypeValidation),
      toolingPilot: clampMonth(plan.milestoneMonths.toolingPilot),
      commercialLaunch: clampMonth(plan.milestoneMonths.commercialLaunch),
    },
    productLaunchMonths: {
      longitude: clampMonth(plan.productLaunchMonths.longitude),
      latitude: clampMonth(plan.productLaunchMonths.latitude),
      altitude: clampMonth(plan.productLaunchMonths.altitude),
    },
    demandScale: Math.max(0, Math.min(5, Number(plan.demandScale) || 0)),
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
  if (milestone === "foundation") return 1;
  return clampMonth(plan.milestoneMonths[milestone] + scenarioDelayMonths(scenario));
}

export function effectiveProductLaunchMonth(
  plan: OperatingPlan,
  product: OperatingPlanProductId,
  scenario: PlanningScenarioId = "base",
) {
  return clampMonth(plan.productLaunchMonths[product] + scenarioDelayMonths(scenario));
}

export function unitsForPlanMonth(
  plan: OperatingPlan,
  month: number,
  scenario: PlanningScenarioId = "base",
) {
  const launchMonth = effectiveMilestoneMonth(plan, "commercialLaunch", scenario);
  const index = month - launchMonth;
  if (index < 0) return 0;
  const base = BASE_DEMAND_RAMP[Math.min(index, BASE_DEMAND_RAMP.length - 1)] ?? 0;
  return Math.max(0, Math.round(base * plan.demandScale * SCENARIO_DEMAND_FACTOR[scenario]));
}

export function fundingGateMonth(
  plan: OperatingPlan,
  gateId: string,
  scenario: PlanningScenarioId = "base",
) {
  if (gateId === "T1") return 1;
  const launch = effectiveMilestoneMonth(plan, "commercialLaunch", scenario);
  const offsets: Record<string, number> = {
    T2: -11,
    T3: -8,
    STBY: -5,
    T4: -4,
    T5: 0,
  };
  const relative = offsets[gateId] ?? 0;
  return clampMonth(launch + relative + plan.fundingTimingOffsetMonths);
}

export function shiftOperatingPlan(plan: OperatingPlan, deltaMonths: number): OperatingPlan {
  const delta = Math.max(-12, Math.min(24, Math.round(deltaMonths)));
  return normalizeOperatingPlan({
    ...plan,
    milestoneMonths: {
      foundation: 1,
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
  });
}

function addCalendarMonths(month: string, delta: number) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const date = new Date(Date.UTC(year, monthIndex + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function rollOperatingPlan(plan: OperatingPlan, months = 1): OperatingPlan {
  const delta = Math.max(1, Math.min(12, Math.round(months)));
  return normalizeOperatingPlan({
    ...plan,
    horizonStart: addCalendarMonths(plan.horizonStart, delta),
    milestoneMonths: {
      foundation: 1,
      engineeringBaseline: Math.max(1, plan.milestoneMonths.engineeringBaseline - delta),
      prototypeValidation: Math.max(1, plan.milestoneMonths.prototypeValidation - delta),
      toolingPilot: Math.max(1, plan.milestoneMonths.toolingPilot - delta),
      commercialLaunch: Math.max(1, plan.milestoneMonths.commercialLaunch - delta),
    },
    productLaunchMonths: {
      longitude: Math.max(1, plan.productLaunchMonths.longitude - delta),
      latitude: Math.max(1, plan.productLaunchMonths.latitude - delta),
      altitude: Math.max(1, plan.productLaunchMonths.altitude - delta),
    },
  });
}

export function calendarMonthForPlanMonth(plan: OperatingPlan, planMonth: number) {
  const month = addCalendarMonths(plan.horizonStart, clampMonth(planMonth) - 1);
  const [yearText, monthText] = month.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 1));
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export function operatingPlanHorizonLabel(plan: OperatingPlan) {
  return `${calendarMonthForPlanMonth(plan, 1)} – ${calendarMonthForPlanMonth(plan, 36)}`;
}

export function planningRisks(plan: OperatingPlan): PlanningRisk[] {
  const risks: PlanningRisk[] = [];
  const m = plan.milestoneMonths;

  if (m.engineeringBaseline < 2) {
    risks.push({ severity: "high", code: "ENGINEERING-COMPRESSION", message: "Engineering baseline is compressed into the first month." });
  }
  if (m.prototypeValidation - m.engineeringBaseline < 3) {
    risks.push({ severity: "high", code: "VALIDATION-COMPRESSION", message: "Less than three months separate engineering baseline and prototype validation." });
  }
  if (m.toolingPilot - m.prototypeValidation < 2) {
    risks.push({ severity: "high", code: "TOOLING-COMPRESSION", message: "Tooling/pilot starts less than two months after validation." });
  }
  if (m.commercialLaunch - m.toolingPilot < 3) {
    risks.push({ severity: "high", code: "LAUNCH-COMPRESSION", message: "Commercial launch has less than three months of pilot and launch-readiness time." });
  }
  if (Object.values(plan.productLaunchMonths).some((month) => month < m.commercialLaunch)) {
    risks.push({ severity: "high", code: "PRODUCT-BEFORE-LAUNCH", message: "A product launch is scheduled before the commercial launch gate." });
  }
  if (plan.demandScale > 1.5) {
    risks.push({ severity: "medium", code: "DEMAND-ACCELERATION", message: "Demand is more than 50% above the approved baseline and should be checked against capacity and supply lead times." });
  }
  if (plan.fundingTimingOffsetMonths > 0) {
    risks.push({ severity: "medium", code: "FUNDING-DELAY", message: `Funding receipts are delayed by ${plan.fundingTimingOffsetMonths} month(s) relative to milestone need.` });
  }
  if (plan.fundingTimingOffsetMonths < 0) {
    risks.push({ severity: "low", code: "FUNDING-EARLY", message: `Funding receipts are planned ${Math.abs(plan.fundingTimingOffsetMonths)} month(s) earlier than milestone need.` });
  }

  return risks;
}
