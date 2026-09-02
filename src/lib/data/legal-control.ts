export type LegalStatus = "planned" | "pending" | "verify" | "complete" | "blocked";

export type LegalOwner = "Founder" | "CA" | "CS" | "IP Counsel" | "OEM Counsel";

export type LegalControl = {
  id: string;
  title: string;
  domain: "IP" | "Corporate" | "Commercial" | "CA/GST" | "Insurance";
  status: LegalStatus;
  requirement: string;
  evidence: string;
  owner: LegalOwner;
  stage: string;
  dependency?: string;
  note?: string;
};

export const LEGAL_CONTROLS: LegalControl[] = [
  { id: "L-01", title: "Founder IP assignment", domain: "IP", status: "pending", requirement: "Assign relevant founder-created geometry, CAD, process and documentation IP to Vāyú Shastr Private Limited.", evidence: "Executed IP assignment deed + IP schedule", owner: "Founder", stage: "M1", note: "CA/CS/IP counsel to confirm stamping, execution and filing requirements." },
  { id: "L-02", title: "Co-director / contributor IP assignment", domain: "IP", status: "pending", requirement: "Obtain equivalent assignment and confidentiality undertakings from every co-founder or contributor creating company IP.", evidence: "Signed assignment + confidentiality agreement", owner: "Founder", stage: "M1", dependency: "L-01" },
  { id: "L-03", title: "Contractor / FEA / designer IP", domain: "IP", status: "pending", requirement: "All external engineering, FEA, CAD and design work must have written confidentiality and present/future IP ownership terms before access.", evidence: "Executed contractor SOW + IP/confidentiality clauses", owner: "Founder", stage: "M2" },
  { id: "L-04", title: "OEM NDA and staged disclosure", domain: "IP", status: "pending", requirement: "Use NDA before RFQ and release only the minimum technical package needed at each supplier gate.", evidence: "Executed NDA + disclosure register", owner: "OEM Counsel", stage: "Before RFQ" },
  { id: "L-05", title: "OEM IP non-use / non-replication", domain: "IP", status: "planned", requirement: "Manufacturing agreement must prohibit unauthorised use, replication, disclosure or manufacture outside approved purchase orders.", evidence: "Signed OEM manufacturing agreement", owner: "OEM Counsel", stage: "Before PO", dependency: "L-04" },
  { id: "L-06", title: "Tooling ownership and custody", domain: "Commercial", status: "planned", requirement: "Document buyer ownership, custody, maintenance, retrieval and non-use of moulds, jigs and tooling.", evidence: "Tooling ownership schedule + custody acknowledgement", owner: "OEM Counsel", stage: "Tooling PO" },
  { id: "L-07", title: "Trademark clearance", domain: "IP", status: "verify", requirement: "Clear and decide filing strategy for Vāyú Shastr, VéLOXIS and frozen product marks before public commercial use.", evidence: "Trademark search report + counsel opinion + filing receipt where applicable", owner: "IP Counsel", stage: "M1–M3" },
  { id: "L-08", title: "Patent / design filing sequence", domain: "IP", status: "planned", requirement: "Lock the filing sequence around CAD/FEA evidence and disclosure timing; avoid public disclosure before counsel confirms the strategy.", evidence: "Filing plan + application receipts", owner: "IP Counsel", stage: "M3–M4", note: "Do not treat planning costs or patentability as legal conclusions." },
  { id: "L-09", title: "Para 58 development record", domain: "Corporate", status: "planned", requirement: "Maintain a controlled board/management record for M3 CAD lock and FEA viability before development expenditure is treated as capitalised.", evidence: "Signed board/management minute + engineering gate evidence", owner: "CS", stage: "M3", note: "Accounting treatment remains subject to CA review and applicable standards." },
  { id: "L-10", title: "SHA / reserved matters", domain: "Corporate", status: "planned", requirement: "Before external capital, document governance, reserved matters, transfer rights, drag/tag and other negotiated investor protections.", evidence: "Executed SHA / term sheet package", owner: "IP Counsel", stage: "Before external capital" },
  { id: "L-11", title: "ESOP governance", domain: "Corporate", status: "planned", requirement: "Document the proposed 10% ESOP pool, approvals, vesting and grant mechanics with CS counsel.", evidence: "Board/shareholder approvals + ESOP plan", owner: "CS", stage: "M1–M3" },
  { id: "L-12", title: "Dealer / distributor agreement", domain: "Commercial", status: "planned", requirement: "Set territory, pricing, payment, warranty handling, returns, brand use and termination controls before channel onboarding.", evidence: "Executed dealer agreement", owner: "IP Counsel", stage: "M11" },
  { id: "L-13", title: "Customer terms + warranty + privacy", domain: "Commercial", status: "planned", requirement: "Publish controlled customer terms, warranty policy, privacy notice and website legal disclosures before launch.", evidence: "Approved website legal pack + version record", owner: "IP Counsel", stage: "M11" },
  { id: "L-14", title: "Product liability insurance", domain: "Insurance", status: "planned", requirement: "Obtain appropriate product liability and relevant business insurance before first customer delivery.", evidence: "Policy schedule + certificate", owner: "Founder", stage: "Pre-launch" },
  { id: "L-15", title: "HSN / GST / CA classification", domain: "CA/GST", status: "verify", requirement: "Confirm product, component and service classifications, GST treatment, invoicing and input-credit treatment with the CA before commercial billing.", evidence: "Written CA tax memo + configured accounting/tax master", owner: "CA", stage: "M1–M11" },
  { id: "L-16", title: "MCA / statutory filing register", domain: "Corporate", status: "planned", requirement: "Maintain a dated checklist for incorporation, PAN/TAN, GST where applicable, books, TDS, ROC and annual statutory filings.", evidence: "Compliance calendar + filing acknowledgements", owner: "CS", stage: "M1 onward" },
  { id: "L-17", title: "Founder remuneration / related-party controls", domain: "CA/GST", status: "planned", requirement: "Document founder payments, reimbursements, related-party transactions and approvals with accounting support.", evidence: "Board approvals + vouchers + CA review", owner: "CA", stage: "M1 onward" },
  { id: "L-18", title: "Evidence and legal change log", domain: "Corporate", status: "planned", requirement: "Every legal/IP control must carry evidence, owner, review date and supersession history; no 'complete' claim without evidence.", evidence: "Controlled legal register + evidence links", owner: "Founder", stage: "M1 onward" },
];

export const LEGAL_STATUS_LABELS: Record<LegalStatus, string> = {
  planned: "Planned",
  pending: "Pending evidence",
  verify: "Verify with adviser",
  complete: "Complete",
  blocked: "Blocked",
};

export const LEGAL_GATES = [
  { gate: "G1", when: "M1", title: "Corporate foundation", controls: ["L-01", "L-02", "L-11", "L-16"] },
  { gate: "G2", when: "M1–M3", title: "IP protection before disclosure", controls: ["L-03", "L-04", "L-07", "L-08"] },
  { gate: "G3", when: "M3", title: "Controlled development record", controls: ["L-09"] },
  { gate: "G4", when: "Before PO", title: "OEM and tooling protection", controls: ["L-05", "L-06"] },
  { gate: "G5", when: "Before external capital", title: "Investor governance", controls: ["L-10"] },
  { gate: "G6", when: "Pre-launch", title: "Commercial and risk release", controls: ["L-12", "L-13", "L-14", "L-15"] },
];
