export type VentureId = "consolidated" | "carbon" | "aluminium";
export type ManagementRole = "founder" | "finance" | "operations" | "investor";
export type DecisionStatus = "proposed" | "approved" | "rejected";

export type Forecast = { venture: VentureId; revenueInr: number; grossMarginInr: number; cashInr: number; runwayMonths: number; confidence: "base" | "upside" | "downside" };
export type GovernanceItem = { id: string; area: string; owner: string; status: "ready" | "attention" | "blocked"; due: string };
export type Decision = { id: string; title: string; owner: string; impactInr: number; status: DecisionStatus };

export const PHASE5_FORECASTS: Forecast[] = [
 { venture: "consolidated", revenueInr: 48250000, grossMarginInr: 16140000, cashInr: 12400000, runwayMonths: 9.4, confidence: "base" },
 { venture: "carbon", revenueInr: 32850000, grossMarginInr: 11820000, cashInr: 9100000, runwayMonths: 8.7, confidence: "base" },
 { venture: "aluminium", revenueInr: 15400000, grossMarginInr: 4320000, cashInr: 3300000, runwayMonths: 6.9, confidence: "base" },
];
export const PHASE5_GOVERNANCE: GovernanceItem[] = [
 { id: "G-01", area: "Financial close & controls", owner: "Finance", status: "ready", due: "Monthly" },
 { id: "G-02", area: "Inventory / serial traceability", owner: "Operations", status: "ready", due: "Continuous" },
 { id: "G-03", area: "Venture separation", owner: "Founder", status: "ready", due: "Continuous" },
 { id: "G-04", area: "Investor reporting pack", owner: "Finance", status: "attention", due: "Quarterly" },
 { id: "G-05", area: "Approval & audit history", owner: "Founder", status: "attention", due: "Phase 5 backend" },
];
export const PHASE5_DECISIONS: Decision[] = [
 { id: "D-01", title: "Fund carbon frame replenishment", owner: "Operations", impactInr: 504000, status: "proposed" },
 { id: "D-02", title: "Protect minimum cash reserve", owner: "Finance", impactInr: 2500000, status: "proposed" },
 { id: "D-03", title: "Approve aluminium production envelope", owner: "Founder", impactInr: 900000, status: "proposed" },
];
export function getForecast(venture: VentureId, confidence: Forecast["confidence"] = "base") {
 const base = PHASE5_FORECASTS.find(x => x.venture === venture)!;
 const factor = confidence === "upside" ? 1.15 : confidence === "downside" ? 0.8 : 1;
 return { ...base, confidence, revenueInr: Math.round(base.revenueInr * factor), grossMarginInr: Math.round(base.grossMarginInr * factor) };
}
export function governanceScore(items = PHASE5_GOVERNANCE) { return Math.round(items.filter(x => x.status === "ready").length / items.length * 100); }
export function approvedDecisionImpact(items: Decision[]) { return items.filter(x => x.status === "approved").reduce((n, x) => n + x.impactInr, 0); }
