export type ReadinessStatus = "ready" | "conditional" | "blocked" | "external";
export type ReadinessPriority = "critical" | "high" | "normal";

export interface ReadinessGate {
  id: string;
  title: string;
  priority: ReadinessPriority;
  status: ReadinessStatus;
  requirement: string;
  evidence: string;
  releaseCondition: string;
}

export const DEPLOYMENT_GATES: ReadinessGate[] = [
  { id: "DR-01", title: "Application source integrated", priority: "critical", status: "ready", requirement: "Stages 1–11 must be represented in the repository without destructive replacement of existing work.", evidence: "Knowledge, Technical, Finance, Funding, Legal, Manufacturing, Founder, Investor, AI and QA modules/routes", releaseCondition: "Keep the integrated source as the release candidate." },
  { id: "DR-02", title: "Evidence governance", priority: "critical", status: "ready", requirement: "Controlled data must distinguish confirmed, planned, pending, conflict and superseded states.", evidence: "Knowledge + QA registers", releaseCondition: "No unsupported completion claims." },
  { id: "DR-03", title: "Engineering baseline lock", priority: "critical", status: "blocked", requirement: "VEDM-301 Rev 5.3.8, complete geometry, T47i 85.5mm and 700×40 envelope must be reconciled before design freeze.", evidence: "TC-01 through TC-06 / QA-03 to QA-05", releaseCondition: "Resolve conflicts and attach controlled engineering evidence." },
  { id: "DR-04", title: "Validation evidence", priority: "critical", status: "blocked", requirement: "FEA, prototype inspection, NDT and ISO 4210 validation require actual results before product validation is claimed.", evidence: "TC-11 through TC-14", releaseCondition: "Store reports/results and update gate statuses." },
  { id: "DR-05", title: "Legal/IP release", priority: "critical", status: "conditional", requirement: "Founder/contributor IP, trademark, OEM NDA/IP non-use, tooling ownership and customer/legal pack require evidence.", evidence: "Legal Control L-01 through L-18", releaseCondition: "Executed documents, receipts, adviser confirmation or policy evidence." },
  { id: "DR-06", title: "Supplier/tooling release", priority: "critical", status: "conditional", requirement: "OEM qualification, RFQ, NDA, tooling custody, pilot QC and traceability must precede controlled production release.", evidence: "Manufacturing M-01 through M-18", releaseCondition: "Pass supplier, tooling, pilot and quality gates." },
  { id: "DR-07", title: "Finance/funding readiness", priority: "high", status: "conditional", requirement: "Planning model and funding ladder must be reconciled with CA advice and live programme terms before submission.", evidence: "Finance Control + Funding Control", releaseCondition: "CA-reviewed projections and current scheme evidence." },
  { id: "DR-08", title: "Investor/board evidence", priority: "high", status: "conditional", requirement: "Investor claims, tranche asks and board decisions must match the controlled evidence state.", evidence: "Investor / Board Control", releaseCondition: "Diligence room complete for the relevant tranche." },
  { id: "DR-09", title: "Application runtime verification", priority: "critical", status: "external", requirement: "Build, typecheck, tests and generated route validation must be executed in a supported runtime.", evidence: "Repository scripts: build, typecheck, test, check:auth, lint", releaseCondition: "Fresh successful execution of the applicable checks." },
  { id: "DR-10", title: "Production authentication boundary", priority: "critical", status: "blocked", requirement: "Founder-only/sensitive records require server-side authentication and authorization, not UI-only hiding.", evidence: "QA-14 / AI Knowledge boundary", releaseCondition: "Verify enforced access control before sensitive production use." },
  { id: "DR-11", title: "Deployment provider status", priority: "critical", status: "external", requirement: "Vercel must report success for the final release commit before deployment is called successful.", evidence: "Vercel commit status", releaseCondition: "Fresh Vercel status = success." },
];

export const HANDOVER_CHECKLIST = [
  "Freeze the release candidate commit after successful runtime verification.",
  "Record Vercel success against the exact release commit.",
  "Attach engineering evidence before calling the product validated or design frozen.",
  "Attach legal/IP evidence before calling controls complete.",
  "Verify current grant/funding terms immediately before submission.",
  "Keep investor materials synchronized with the controlled evidence state.",
  "Do not expose founder-only engineering/legal/commercial records without enforced authorization.",
  "Use the QA matrix as the recurring pre-release checklist for every material change.",
];

export const UNRESOLVED_BLOCKERS = [
  { id: "B-01", title: "700×40 front/rear clearance verification", owner: "Founder / Engineering", severity: "critical" },
  { id: "B-02", title: "VEDM + geometry reconciliation", owner: "Founder / Engineering", severity: "critical" },
  { id: "B-03", title: "FEA / prototype / NDT / ISO 4210 evidence", owner: "Engineering / Lab", severity: "critical" },
  { id: "B-04", title: "Production authentication/authorization boundary", owner: "Application", severity: "critical" },
];

export const RELEASE_SUMMARY = {
  gates: DEPLOYMENT_GATES.length,
  ready: DEPLOYMENT_GATES.filter((gate) => gate.status === "ready").length,
  conditional: DEPLOYMENT_GATES.filter((gate) => gate.status === "conditional").length,
  blocked: DEPLOYMENT_GATES.filter((gate) => gate.status === "blocked").length,
  external: DEPLOYMENT_GATES.filter((gate) => gate.status === "external").length,
  releaseReady: DEPLOYMENT_GATES.every((gate) => !["blocked", "external"].includes(gate.status)),
};
