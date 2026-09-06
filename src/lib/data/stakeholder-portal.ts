export type StakeholderStatus = "ready" | "in-progress" | "blocked";

export const STAKEHOLDER_PORTAL_STATUS = {
  headline: "A controlled external view of the VINDY opportunity.",
  currentTrancheLakh: 15,
  totalLadderLakh: 225,
  disclosureRule: "External claims must be traceable to approved Finance, Engineering, Manufacturing, Legal, EPR or Governance evidence.",
} as const;

export const STAKEHOLDER_SECTIONS = [
  { id: "thesis", title: "Investment thesis", summary: "Indigenous carbon bicycle platform focused on Indian body geometry, controlled engineering and asset-light execution.", status: "ready" as StakeholderStatus, route: "/command/investor-pitch" },
  { id: "product", title: "Product & engineering", summary: "VAEA design language, controlled VEDM baseline, T700/T800 architecture and validation pathway.", status: "in-progress" as StakeholderStatus, route: "/command/engineering" },
  { id: "commercial", title: "Commercial model", summary: "Product tiers, launch sequence, unit economics and demand assumptions linked to the financial model.", status: "in-progress" as StakeholderStatus, route: "/command/sales" },
  { id: "manufacturing", title: "Manufacturing", summary: "Controlled OEM qualification, pilot production, QC and evidence-led release gates.", status: "in-progress" as StakeholderStatus, route: "/command/phase-6" },
  { id: "finance", title: "Capital & financial controls", summary: "36-month model, cash guardrails, funding ladder and use-of-proceeds controls.", status: "ready" as StakeholderStatus, route: "/command/financial-cockpit" },
  { id: "governance", title: "Governance & diligence", summary: "Decision gates, audit evidence, ownership controls and diligence readiness.", status: "in-progress" as StakeholderStatus, route: "/command/investor-board" },
] as const;

export const STAKEHOLDER_DISCLOSURES = [
  { id: "D-01", title: "What is verified", detail: "Approved or evidenced facts from the controlled operating registers." },
  { id: "D-02", title: "What is modeled", detail: "Scenario-dependent financial, demand and production assumptions." },
  { id: "D-03", title: "What is pending", detail: "Items awaiting prototype, test, legal, supplier or management evidence." },
  { id: "D-04", title: "What requires approval", detail: "Capital, governance, engineering release and other reserved decisions." },
] as const;
