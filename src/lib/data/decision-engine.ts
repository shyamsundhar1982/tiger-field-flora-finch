export type DecisionPriority = "critical" | "high" | "normal";
export type DecisionState = "ready" | "blocked" | "approval" | "watch";

export type DecisionPacket = {
  id: string;
  priority: DecisionPriority;
  state: DecisionState;
  title: string;
  trigger: string;
  owner: string;
  decision: string;
  evidence: string;
  approval: string;
  financialImpact: string;
  operationalImpact: string;
  nextAction: string;
  source: string;
};

export const DECISION_PACKETS: DecisionPacket[] = [
  {
    id: "K-01", priority: "critical", state: "ready", title: "Foundation execution", trigger: "FC-01 is the next founder action",
    owner: "Founder", decision: "Authorize incorporation + operating-bank execution", evidence: "Founder action FC-01", approval: "Founder decision",
    financialImpact: "Enables controlled banking and funding receipts", operationalImpact: "Removes foundation dependency", nextAction: "Complete incorporation and banking evidence", source: "/command/founder-command",
  },
  {
    id: "K-02", priority: "critical", state: "blocked", title: "Engineering baseline", trigger: "FC-02 / FC-03 are blocked",
    owner: "Founder + Engineering", decision: "Resolve VEDM master reconciliation and 700×40 clearance evidence before design freeze",
    evidence: "VEDM-301 Rev 5.3.8 + TC-04 / TC-05 / TC-06", approval: "Engineering / QA gate",
    financialImpact: "Protects prototype and tooling spend from premature release", operationalImpact: "Unlocks supplier RFQs and validation path",
    nextAction: "Produce controlled geometry reconciliation + measured clearance evidence", source: "/command/engineering",
  },
  {
    id: "K-03", priority: "high", state: "approval", title: "Funding evidence room", trigger: "FC-06 is active",
    owner: "Founder", decision: "Approve the funding-readiness evidence pack for grant/investor diligence",
    evidence: "Funding Control + stakeholder disclosure discipline", approval: "Founder / CA as applicable",
    financialImpact: "Supports next capital tranche readiness", operationalImpact: "Creates a single controlled diligence trail",
    nextAction: "Close missing evidence and record approval", source: "/command/funding",
  },
  {
    id: "K-04", priority: "high", state: "watch", title: "Supplier release", trigger: "FC-07 waits on engineering baseline",
    owner: "Founder + OEM", decision: "Hold controlled OEM RFQs until NDA and engineering baseline are released",
    evidence: "FC-07 dependency: L-04 + engineering baseline", approval: "Founder release gate",
    financialImpact: "Avoids incomparable quotations and premature supplier commitment", operationalImpact: "Preserves supplier comparison integrity",
    nextAction: "Release RFQ pack immediately after baseline lock", source: "/command/operations",
  },
  {
    id: "K-05", priority: "high", state: "approval", title: "Validation release", trigger: "FC-08 is waiting on prototype gate",
    owner: "OEM + QA", decision: "Approve prototype → NDT → structural validation sequence only after design freeze",
    evidence: "TC-12 / TC-13 / TC-14", approval: "QA / Engineering gate",
    financialImpact: "Controls validation spend against an approved baseline", operationalImpact: "Creates the evidence chain for production release",
    nextAction: "Complete prototype and record each validation result", source: "/command/qa-verification",
  },
  {
    id: "K-06", priority: "normal", state: "watch", title: "Monthly capital control", trigger: "FC-10 is active",
    owner: "Founder", decision: "Review cash floor, runway and next funding gate before discretionary commitments",
    evidence: "Financial Cockpit + Finance Control", approval: "Founder monthly gate",
    financialImpact: "Protects cash-floor discipline", operationalImpact: "Keeps production and launch timing tied to funded milestones",
    nextAction: "Run monthly cash/funding review and record decision", source: "/command/financial-cockpit",
  },
];

export const DECISION_STATE_LABELS: Record<DecisionState, string> = {
  ready: "Ready for decision",
  blocked: "Blocked",
  approval: "Approval required",
  watch: "Watch / monitor",
};

export const decisionPriorityRank: Record<DecisionPriority, number> = { critical: 0, high: 1, normal: 2 };
