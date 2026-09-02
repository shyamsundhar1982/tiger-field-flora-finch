export type InvestorReadinessStatus = "not-ready" | "evidence-building" | "investor-ready" | "fundraise-active";
export type BoardDecisionStatus = "proposed" | "decision-needed" | "approved" | "blocked" | "deferred";

export type InvestorMilestone = {
  id: string;
  tranche: string;
  timing: string;
  quantumLakh: number;
  purpose: string;
  requiredEvidence: string;
  decisionGate: string;
  status: "planned" | "evidence-building" | "ready" | "blocked";
};

export type BoardDecision = {
  id: string;
  title: string;
  decision: string;
  status: BoardDecisionStatus;
  owner: string;
  evidence: string;
  reservedMatter: boolean;
};

export type DiligenceItem = {
  id: string;
  domain: string;
  item: string;
  evidence: string;
  status: "ready" | "in-progress" | "blocked";
};

export const INVESTOR_BOARD_STATUS = {
  readiness: "evidence-building" as InvestorReadinessStatus,
  headline: "Build evidence before asking for capital.",
  currentAskLakh: 15,
  totalLadderLakh: 200,
  strategy: "Grants first; equity last; each tranche unlocked by evidence and milestone delivery.",
};

export const INVESTOR_MILESTONES: InvestorMilestone[] = [
  { id: "I-01", tranche: "T1 · Foundation", timing: "M1", quantumLakh: 15, purpose: "Incorporation, banking, initial operating setup and grant readiness", requiredEvidence: "Incorporation/banking evidence, founder profile, initial budget and funding applications", decisionGate: "Foundation controls active", status: "evidence-building" },
  { id: "I-02", tranche: "T2 · Engineering", timing: "M3", quantumLakh: 50, purpose: "CAD/FEA lock, IP work and prototype readiness", requiredEvidence: "Controlled technical package, VEDM reference, geometry reconciliation, FEA record and IP evidence", decisionGate: "Engineering baseline accepted", status: "blocked" },
  { id: "I-03", tranche: "T3 · Validation", timing: "M6", quantumLakh: 85, purpose: "Prototype, NDT and structural validation", requiredEvidence: "Prototype inspection, NDT records, structural/ISO 4210 validation plan and test evidence", decisionGate: "Validation gate passed", status: "blocked" },
  { id: "I-04", tranche: "T4 · Pilot", timing: "M10", quantumLakh: 135, purpose: "Production tooling, pilot batch and supplier release", requiredEvidence: "OEM qualification, controlled RFQ, tooling ownership, pilot QC and release records", decisionGate: "Pilot production released", status: "blocked" },
  { id: "I-05", tranche: "T5 · Launch", timing: "M12+", quantumLakh: 200, purpose: "Launch working capital, inventory, customer delivery and controlled scale", requiredEvidence: "Validated product, launch legal pack, working-capital model, demand evidence and supplier capacity", decisionGate: "Commercial release approved", status: "planned" },
];

export const BOARD_DECISIONS: BoardDecision[] = [
  { id: "B-01", title: "Corporate foundation", decision: "Approve incorporation, banking and baseline governance setup", status: "decision-needed", owner: "Founder / Board", evidence: "Legal Control L-16; Founder Command FC-01", reservedMatter: true },
  { id: "B-02", title: "Engineering baseline", decision: "Approve controlled technical baseline only after VEDM and geometry reconciliation", status: "blocked", owner: "Founder / Technical", evidence: "Technical TC-01 to TC-06", reservedMatter: true },
  { id: "B-03", title: "Founder and contributor IP", decision: "Approve assignment and protection of relevant company IP", status: "decision-needed", owner: "Founder / Legal", evidence: "Legal Control L-01 to L-03", reservedMatter: true },
  { id: "B-04", title: "OEM and tooling strategy", decision: "Approve qualified OEM shortlist, NDA gates and buyer-owned tooling controls", status: "blocked", owner: "Founder / Operations", evidence: "Manufacturing M-01 to M-05", reservedMatter: true },
  { id: "B-05", title: "Validation release", decision: "Approve product progression only when dimensional, NDT and structural evidence is complete", status: "blocked", owner: "Founder / Quality", evidence: "Technical TC-12 to TC-15", reservedMatter: true },
  { id: "B-06", title: "Launch budget", decision: "Approve launch and working-capital envelope against the current finance scenario", status: "proposed", owner: "Founder / Board", evidence: "Finance Control F1-F6 and 24-month plan", reservedMatter: true },
];

export const DILIGENCE_ITEMS: DiligenceItem[] = [
  { id: "D-01", domain: "Corporate", item: "Company, directors, shareholding and statutory register", evidence: "MCA/COI pack and statutory filing register", status: "in-progress" },
  { id: "D-02", domain: "Founder", item: "Founder credentials and execution ownership", evidence: "Founder profile and role record", status: "ready" },
  { id: "D-03", domain: "IP", item: "IP ownership, assignment, trademark and filing position", evidence: "Legal Control L-01 to L-08", status: "in-progress" },
  { id: "D-04", domain: "Technical", item: "Engineering baseline, design controls and validation status", evidence: "Technical Control register and controlled evidence room", status: "blocked" },
  { id: "D-05", domain: "Manufacturing", item: "OEM capability, tooling, traceability and QC controls", evidence: "Manufacturing Control register, RFQs and supplier evidence", status: "in-progress" },
  { id: "D-06", domain: "Financial", item: "24-month model, cash runway, use of proceeds and assumptions", evidence: "Finance Control and monthly cash plan", status: "ready" },
  { id: "D-07", domain: "Funding", item: "Grant/debt/equity pipeline and application readiness", evidence: "Funding Control pipeline and document checklist", status: "in-progress" },
  { id: "D-08", domain: "GTM", item: "Customer, channel and launch assumptions", evidence: "GTM plan and first-100 customer pathway", status: "in-progress" },
  { id: "D-09", domain: "Legal", item: "Contracts, warranty, privacy, insurance and product liability readiness", evidence: "Legal Control L-11 to L-18", status: "in-progress" },
];

export const INVESTOR_PROOF_POINTS = [
  "IP-led, asset-light operating model with production controlled through qualified contract OEMs.",
  "India retains design, brand, customer relationship and relevant IP rather than owning a heavy assembly footprint.",
  "Engineering, finance, funding, legal and manufacturing controls are being managed as evidence-linked registers.",
  "Capital is staged against measurable gates rather than treating the full ₹2Cr ladder as an immediate requirement.",
  "Product claims remain explicitly planned/pending until supporting validation evidence exists.",
];

export const USE_OF_PROCEEDS = [
  { tranche: "T1", allocation: "Foundation + applications", note: "Corporate setup, banking, documentation and grant readiness" },
  { tranche: "T2", allocation: "Engineering + IP", note: "CAD/FEA, technical controls, prototype preparation and IP protection" },
  { tranche: "T3", allocation: "Prototype + validation", note: "Prototype builds, inspection, NDT and structural validation" },
  { tranche: "T4", allocation: "Tooling + pilot", note: "Controlled tooling, pilot production and supplier qualification" },
  { tranche: "T5", allocation: "Launch + working capital", note: "Inventory, customer delivery, marketing and controlled scale" },
];

export const INVESTOR_NEXT_ACTIONS = [
  "Close foundation evidence and activate the first funding applications.",
  "Resolve the VEDM/geometry/700×40 engineering blockers before presenting validation as complete.",
  "Build a clean investor evidence room from the Knowledge, Finance, Funding, Legal and Manufacturing registers.",
  "Prepare the board decision pack with only current, source-linked claims and clearly labelled assumptions.",
  "Use tranche-specific asks; do not present the full ₹2Cr ladder as committed capital need without updated evidence.",
];
