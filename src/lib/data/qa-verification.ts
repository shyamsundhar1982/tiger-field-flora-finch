export type QAStatus = "pass" | "pending" | "blocked" | "unknown";
export type QAPriority = "critical" | "high" | "normal";

export interface QACheck {
  id: string;
  domain: "knowledge" | "engineering" | "finance" | "funding" | "legal" | "manufacturing" | "investor" | "application";
  title: string;
  priority: QAPriority;
  status: QAStatus;
  requirement: string;
  evidence: string;
  nextAction: string;
}

export const QA_CHECKS: QACheck[] = [
  { id: "QA-01", domain: "knowledge", title: "45-point knowledge package is represented", priority: "critical", status: "pass", requirement: "All controlled execution points must exist in the Knowledge Register / execution package.", evidence: "Knowledge Register + execution-package.ts", nextAction: "Keep IDs stable through future edits." },
  { id: "QA-02", domain: "knowledge", title: "Evidence status is explicit", priority: "critical", status: "pass", requirement: "Confirmed, planned, pending, conflict and superseded information must remain distinguishable.", evidence: "KnowledgeStatus model and domain registers", nextAction: "Do not convert planning data to confirmed without evidence." },
  { id: "QA-03", domain: "engineering", title: "700×40 clearance remains a release gate", priority: "critical", status: "blocked", requirement: "Front and rear inflated 700×40mm tyre clearance must be physically/engineering verified before design freeze.", evidence: "TC-04 / TC-05 / FC-03", nextAction: "Complete controlled geometry and clearance verification." },
  { id: "QA-04", domain: "engineering", title: "T47i shell width is controlled", priority: "critical", status: "pass", requirement: "85.5mm T47i is the current baseline; legacy 68mm assumption must not silently return.", evidence: "TC-03 + knowledge point 18", nextAction: "Reconcile against the master engineering reference before freeze." },
  { id: "QA-05", domain: "engineering", title: "Fork A-C is not falsely locked", priority: "critical", status: "pass", requirement: "Approx. 378mm is a candidate correction, not a final locked value.", evidence: "TC-05", nextAction: "Lock only after complete front tyre/crown analysis." },
  { id: "QA-06", domain: "engineering", title: "Validation cannot be claimed early", priority: "critical", status: "pass", requirement: "FEA, NDT and ISO 4210 must remain planned until evidence exists.", evidence: "TC-11 through TC-15", nextAction: "Attach reports/results as gates are completed." },
  { id: "QA-07", domain: "finance", title: "Financial model is labelled as planning", priority: "high", status: "pass", requirement: "ASP, COGS, breakeven and monthly cash figures are planning assumptions until CA validation.", evidence: "Finance Control + 24-month plan", nextAction: "Reconcile with CA-certified projections before funding submissions." },
  { id: "QA-08", domain: "funding", title: "Funding opportunities are status-controlled", priority: "high", status: "pass", requirement: "Active, application-ready, verify, closed and assumption states must not be conflated.", evidence: "Funding Control register", nextAction: "Verify live scheme terms before each application." },
  { id: "QA-09", domain: "legal", title: "Legal completion requires evidence", priority: "critical", status: "pass", requirement: "No legal control is complete without executed documents, filing receipts, adviser confirmation or policy evidence.", evidence: "Legal Control release rule", nextAction: "Attach evidence to each completed legal gate." },
  { id: "QA-10", domain: "manufacturing", title: "Tooling follows design freeze", priority: "critical", status: "pass", requirement: "Production tooling must not be released before design freeze and validation gates.", evidence: "M-05 / M-12 / M-16 and Technical gates", nextAction: "Keep supplier release blocked until prerequisites pass." },
  { id: "QA-11", domain: "manufacturing", title: "Traceability is release-critical", priority: "high", status: "pass", requirement: "Material, layup, cure, NDT and serial traceability must be captured for pilot release.", evidence: "M-07 through M-12", nextAction: "Define supplier record templates before pilot." },
  { id: "QA-12", domain: "investor", title: "Investor claims match controlled evidence", priority: "critical", status: "pass", requirement: "Pending validation and unverified funding must never be presented as completed/awarded.", evidence: "Investor / Board control + AI governance rules", nextAction: "Run this check before every investor pack." },
  { id: "QA-13", domain: "application", title: "Navigation surfaces are registered", priority: "high", status: "pending", requirement: "New command routes must be generated and validated by the application's route/build tooling.", evidence: "Source routes + TanStack generated route tree", nextAction: "Confirm route generation during the next successful build/deployment." },
  { id: "QA-14", domain: "application", title: "Sensitive controls have a real access boundary", priority: "critical", status: "blocked", requirement: "Founder-only technical/legal/commercial records must not rely solely on UI hiding.", evidence: "AI / Knowledge boundary notes; current command shell has no visible auth guard", nextAction: "Implement/verify server-side authentication and authorization before exposing sensitive records in production." },
  { id: "QA-15", domain: "application", title: "Repository verification limitations are explicit", priority: "high", status: "pass", requirement: "No local build/typecheck/test result may be claimed without actually executing it.", evidence: "Verification record for this stage", nextAction: "Use Vercel status for deployment state and run repository checks when an execution environment is available." },
];

export const QA_RELEASE_RULES = [
  "A critical BLOCKED check means the workspace is not release-ready.",
  "Pending evidence must remain pending; never infer completion from planned controls.",
  "Engineering values marked conflict or pending require controlled reconciliation before freeze.",
  "Investor-facing claims must use the same status and evidence discipline as the command workspace.",
  "Deployment success does not mean product, engineering, legal, funding or manufacturing validation is complete.",
];

export const QA_SUMMARY = {
  total: QA_CHECKS.length,
  pass: QA_CHECKS.filter((check) => check.status === "pass").length,
  pending: QA_CHECKS.filter((check) => check.status === "pending").length,
  blocked: QA_CHECKS.filter((check) => check.status === "blocked").length,
  unknown: QA_CHECKS.filter((check) => check.status === "unknown").length,
  releaseReady: QA_CHECKS.every((check) => check.status !== "blocked"),
};
