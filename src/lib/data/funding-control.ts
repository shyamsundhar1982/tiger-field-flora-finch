export type FundingStatus = "active" | "application-ready" | "verify" | "closed" | "assumption";
export type FundingType = "grant" | "recognition" | "debt-support" | "equity";

export type FundingOpportunity = {
  id: string;
  name: string;
  provider: string;
  type: FundingType;
  status: FundingStatus;
  stage: string;
  quantum: string;
  dilution: string;
  fit: "high" | "medium" | "low";
  readiness: number;
  nextAction: string;
  evidence: string;
  owner: string;
};

export const FUNDING_PIPELINE: FundingOpportunity[] = [
  {
    id: "G-01",
    name: "DPIIT Deep Tech recognition",
    provider: "DPIIT",
    type: "recognition",
    status: "application-ready",
    stage: "M1",
    quantum: "Recognition / downstream access",
    dilution: "Non-dilutive",
    fit: "high",
    readiness: 70,
    nextAction: "Prepare incorporation, technology and innovation evidence pack.",
    evidence: "Company model + technical knowledge layer + founder credentials.",
    owner: "Founder / CA-CS",
  },
  {
    id: "G-02",
    name: "NIDHI-PRAYAS 2.0",
    provider: "DST",
    type: "grant",
    status: "verify",
    stage: "Prototype",
    quantum: "Historically ₹20L / ₹40L routes; verify current call and eligibility",
    dilution: "Non-dilutive",
    fit: "high",
    readiness: 60,
    nextAction: "Verify current call, implementing agency and eligibility before submission.",
    evidence: "Prototype plan + technical milestones + founder/company eligibility.",
    owner: "Founder",
  },
  {
    id: "G-03",
    name: "TANSEED",
    provider: "Tamil Nadu ecosystem",
    type: "grant",
    status: "verify",
    stage: "Seed / prototype",
    quantum: "Verify current programme terms",
    dilution: "Programme-dependent; verify",
    fit: "high",
    readiness: 55,
    nextAction: "Check current cohort, ticket size, matching requirements and application window.",
    evidence: "Tamil Nadu startup eligibility + prototype/market case.",
    owner: "Founder",
  },
  {
    id: "G-04",
    name: "Vetri Deep-Tech Fund",
    provider: "Tamil Nadu / ecosystem route",
    type: "grant",
    status: "verify",
    stage: "Deep-tech development",
    quantum: "Verify current terms",
    dilution: "Verify",
    fit: "medium",
    readiness: 35,
    nextAction: "Verify active mandate and whether carbon bicycle engineering qualifies.",
    evidence: "Deep-tech positioning + defensible IP + validation plan.",
    owner: "Founder",
  },
  {
    id: "G-05",
    name: "Credit Guarantee for Startups / MSME debt support",
    provider: "Relevant government / lending channel",
    type: "debt-support",
    status: "verify",
    stage: "Working capital",
    quantum: "Verify current guarantee ceiling and lender route",
    dilution: "Non-equity; repayment obligation",
    fit: "medium",
    readiness: 30,
    nextAction: "Confirm company classification, lender eligibility and guarantee mechanics with CA/bank.",
    evidence: "Incorporation, banking, financial model and lender-ready records.",
    owner: "Founder / CA / Bank",
  },
  {
    id: "G-06",
    name: "CGSS",
    provider: "Startup credit guarantee route",
    type: "debt-support",
    status: "verify",
    stage: "Post-incorporation / debt",
    quantum: "Verify current ceiling and eligibility",
    dilution: "Non-equity; repayment obligation",
    fit: "medium",
    readiness: 30,
    nextAction: "Validate applicability to the planned staged funding structure.",
    evidence: "DPIIT/company status + lender assessment.",
    owner: "Founder / CA",
  },
  {
    id: "G-07",
    name: "Tamil Nadu MSME capital subsidy",
    provider: "Tamil Nadu MSME ecosystem",
    type: "grant",
    status: "verify",
    stage: "Eligible asset / investment stage",
    quantum: "Verify current scheme and qualifying expenditure",
    dilution: "Non-dilutive",
    fit: "medium",
    readiness: 25,
    nextAction: "Map qualifying capex and entity eligibility before committing expenditure.",
    evidence: "MSME registration + eligible invoices/assets + scheme rules.",
    owner: "Founder / CA",
  },
  {
    id: "G-08",
    name: "SISFS",
    provider: "Startup India",
    type: "grant",
    status: "closed",
    stage: "Seed",
    quantum: "Historical route",
    dilution: "Programme-dependent",
    fit: "low",
    readiness: 0,
    nextAction: "Do not build the funding plan around the closed programme; monitor for any successor notification.",
    evidence: "Existing workspace record identifies the route as closed.",
    owner: "Founder",
  },
  {
    id: "G-09",
    name: "MeitY TIDE 2.0",
    provider: "MeitY",
    type: "grant",
    status: "closed",
    stage: "Technology incubation",
    quantum: "Historical route",
    dilution: "Programme-dependent",
    fit: "low",
    readiness: 0,
    nextAction: "Treat as closed/concluded unless a new official call is announced.",
    evidence: "Existing workspace record identifies the route as largely concluded.",
    owner: "Founder",
  },
];

export const FUNDING_LADDER = [
  { gate: "T1", amountLakh: 15, milestone: "M1 incorporation / banking / initial setup", source: "Founder + non-dilutive first" },
  { gate: "T2", amountLakh: 50, milestone: "M3 CAD / FEA / IP / prototype readiness", source: "Grants + founder/bridge if required" },
  { gate: "T3", amountLakh: 85, milestone: "M6 prototype / NDT / validation", source: "Grant-led + controlled bridge" },
  { gate: "T4", amountLakh: 135, milestone: "M10 tooling / pilot", source: "Grant/debt/equity decision gate" },
  { gate: "T5", amountLakh: 200, milestone: "Launch / working capital / scale through M36", source: "Equity only after evidence where possible" },
] as const;

export const FUNDING_DOCUMENTS = [
  "Certificate of Incorporation / constitutional documents",
  "DPIIT / startup / MSME registrations where applicable",
  "Founder profile and defence-aviation engineering credentials",
  "Master Knowledge Register and controlled technical package",
  "VEDM / geometry / FEA / validation evidence package",
  "36-month financial model, cash plan and projected balance sheet",
  "IP filing / assignment / trademark status register",
  "OEM RFQs, quotations, tooling and manufacturing plan",
  "Prototype and ISO 4210 validation plan",
  "CA-certified projections / utilisation plan where required",
] as const;

export const FUNDING_STATUS_LABELS: Record<FundingStatus, string> = {
  active: "Active",
  "application-ready": "Application ready",
  verify: "Verify current terms",
  closed: "Closed / concluded",
  assumption: "Assumption",
};
