export type FounderPriority = "critical" | "high" | "normal";
export type FounderStatus = "blocked" | "next" | "active" | "waiting" | "complete";

export type FounderAction = {
  id: string;
  priority: FounderPriority;
  title: string;
  status: FounderStatus;
  stage: string;
  owner: "Founder" | "CA" | "CS" | "Counsel" | "OEM";
  outcome: string;
  dependency?: string;
};

export const FOUNDER_ACTIONS: FounderAction[] = [
  { id: "FC-01", priority: "critical", title: "Incorporation + banking", status: "next", stage: "M1", owner: "Founder", outcome: "Company legal identity and operating bank account ready" },
  { id: "FC-02", priority: "critical", title: "Lock VEDM master + geometry reconciliation", status: "blocked", stage: "M2–M3", owner: "Founder", outcome: "Single controlled engineering baseline", dependency: "VEDM-301 Rev 5.3.8 + 700×40 envelope" },
  { id: "FC-03", priority: "critical", title: "Complete 700×40 front/rear clearance verification", status: "blocked", stage: "M2–M3", owner: "Founder", outcome: "Measured clearance evidence before design freeze", dependency: "TC-04 / TC-05 / TC-06" },
  { id: "FC-04", priority: "high", title: "Execute founder/contributor IP assignments", status: "next", stage: "M1–M2", owner: "Founder", outcome: "Company ownership chain established", dependency: "L-01 / L-02 / L-03" },
  { id: "FC-05", priority: "high", title: "Run trademark clearance + filing decision", status: "next", stage: "M1–M3", owner: "Counsel", outcome: "Brand filing strategy documented", dependency: "L-07" },
  { id: "FC-06", priority: "high", title: "Prepare grant application evidence room", status: "active", stage: "M1–M3", owner: "Founder", outcome: "Funding-ready controlled evidence pack", dependency: "Funding Control" },
  { id: "FC-07", priority: "high", title: "Issue controlled OEM RFQs after NDA", status: "waiting", stage: "M4–M5", owner: "Founder", outcome: "Comparable supplier quotations and capability evidence", dependency: "L-04 + engineering baseline" },
  { id: "FC-08", priority: "high", title: "Complete prototype → NDT → structural validation", status: "waiting", stage: "M5–M9", owner: "OEM", outcome: "Validation evidence supporting design freeze", dependency: "TC-12 / TC-13 / TC-14" },
  { id: "FC-09", priority: "normal", title: "Prepare launch legal pack + insurance", status: "waiting", stage: "M11–Pre-launch", owner: "Counsel", outcome: "Customer-facing legal and risk controls released", dependency: "L-12 / L-13 / L-14" },
  { id: "FC-10", priority: "normal", title: "Review monthly cash + funding gate", status: "active", stage: "Monthly", owner: "Founder", outcome: "Runway and next capital tranche decision", dependency: "Finance Control" },
];

export const FOUNDER_GATES = [
  { gate: "C1", title: "Foundation", when: "M1", controls: ["FC-01", "FC-04", "FC-05"] },
  { gate: "C2", title: "Engineering lock", when: "M2–M3", controls: ["FC-02", "FC-03"] },
  { gate: "C3", title: "Funding + supplier readiness", when: "M1–M5", controls: ["FC-06", "FC-07"] },
  { gate: "C4", title: "Validation", when: "M5–M9", controls: ["FC-08"] },
  { gate: "C5", title: "Commercial release", when: "M11–Pre-launch", controls: ["FC-09", "FC-10"] },
] as const;

export const FOUNDER_STATUS_LABELS: Record<FounderStatus, string> = {
  blocked: "Blocked",
  next: "Next action",
  active: "Active",
  waiting: "Waiting on gate",
  complete: "Complete",
};
