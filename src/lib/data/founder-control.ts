import { FOUNDER_ACTIONS } from "@/lib/data/founder-command";

export const FOUNDER_CONTROL_THRESHOLDS = {
  cashFloorLakh: 15,
  evidenceFreshnessDays: 30,
  criticalActionDays: 7,
} as const;

export const FOUNDER_CONTROL_LANES = [
  { id: "cash", title: "Cash protection", owner: "Founder", route: "/command/cash", rule: "Escalate when modeled closing cash falls below the management floor." },
  { id: "engineering", title: "Engineering lock", owner: "Founder", route: "/command/phase-5", rule: "Do not release the design baseline until VEDM and 700×40 clearance evidence agree." },
  { id: "funding", title: "Funding readiness", owner: "Founder", route: "/command/funding", rule: "Every capital request must map to an evidence gate and use-of-proceeds record." },
  { id: "supplier", title: "Supplier release", owner: "Founder", route: "/command/operations", rule: "RFQs advance only after NDA and controlled engineering inputs are present." },
  { id: "validation", title: "Validation release", owner: "QA", route: "/command/qa-verification", rule: "Prototype and structural claims remain pending until test evidence is recorded." },
] as const;

export const FOUNDER_CONTROL_CHECKS = [
  { id: "IC-01", title: "Cash floor", severity: "critical", source: "Financial model", action: "Review runway and funding gate", route: "/command/cash" },
  { id: "IC-02", title: "Blocked execution", severity: "critical", source: "Founder action queue", action: "Resolve dependency or record decision", route: "/command/governance" },
  { id: "IC-03", title: "Evidence freshness", severity: "high", source: "Evidence ledger", action: "Refresh or revalidate stale evidence", route: "/command/founder-command" },
  { id: "IC-04", title: "Funding evidence", severity: "high", source: "Funding register", action: "Complete evidence room before outreach", route: "/command/funding" },
  { id: "IC-05", title: "Engineering release", severity: "high", source: "VEDM / QA", action: "Reconcile geometry and clearance evidence", route: "/command/engineering" },
] as const;

export const founderActionSummary = FOUNDER_ACTIONS.map((action) => ({
  ...action,
  urgency: action.priority === "critical" ? "Immediate" : action.priority === "high" ? "This cycle" : "Planned",
  controlRoute: action.status === "blocked" ? "/command/governance" : action.owner === "Founder" ? "/command/founder-command" : "/command/actions",
}));
