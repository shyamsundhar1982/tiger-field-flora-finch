export type AIKnowledgeMode = "workspace" | "founder-only";
export type AIKnowledgeStatus = "ready" | "pending" | "restricted";

export type KnowledgeDomain = "company" | "product" | "engineering" | "finance" | "funding" | "legal" | "manufacturing" | "quality" | "gtm";

export type AIKnowledgeRule = {
  id: string;
  title: string;
  rule: string;
  mode: AIKnowledgeMode;
  status: AIKnowledgeStatus;
};

export const AI_KNOWLEDGE_STATUS = {
  mode: "workspace" as AIKnowledgeMode,
  principle: "Answer from controlled workspace evidence; distinguish confirmed, planned, pending, conflict and superseded information.",
  sourceOfTruth: "Knowledge Register + domain control registers",
  restrictedHandling: "Founder-only engineering, legal and commercial-sensitive records are not exposed by the general workspace interface.",
};

export const AI_KNOWLEDGE_RULES: AIKnowledgeRule[] = [
  { id: "AI-01", title: "Evidence first", rule: "Prefer controlled register evidence over inferred or duplicated narrative.", mode: "workspace", status: "ready" },
  { id: "AI-02", title: "Status honesty", rule: "Never convert planned, pending or conflict records into confirmed facts.", mode: "workspace", status: "ready" },
  { id: "AI-03", title: "Engineering gate", rule: "Treat the VEDM, geometry and 700×40 clearance baseline as controlled engineering work until evidence closes the gates.", mode: "founder-only", status: "pending" },
  { id: "AI-04", title: "Financial assumptions", rule: "Present financial figures as planning assumptions unless a source register marks them otherwise.", mode: "workspace", status: "ready" },
  { id: "AI-05", title: "Funding status", rule: "Separate active, application-ready, verification-required and closed funding routes.", mode: "workspace", status: "ready" },
  { id: "AI-06", title: "Legal evidence", rule: "Do not label a legal control complete without an executed document, filing receipt, adviser confirmation or policy evidence.", mode: "workspace", status: "ready" },
  { id: "AI-07", title: "Manufacturing release", rule: "Do not treat supplier qualification, tooling or pilot production as released without the relevant control evidence.", mode: "workspace", status: "ready" },
  { id: "AI-08", title: "No invented data", rule: "If the workspace does not contain evidence, state that the item is unknown or pending rather than filling the gap with a guess.", mode: "workspace", status: "ready" },
];

export const AI_PROMPT_LIBRARY = [
  { id: "P-01", label: "Founder briefing", prompt: "Summarise the current founder-critical blockers, their dependencies, and the next actions using only controlled workspace data." },
  { id: "P-02", label: "Investor briefing", prompt: "Prepare an investor briefing using only evidence-backed company, product, finance, funding, manufacturing and GTM information; clearly label assumptions and pending validation." },
  { id: "P-03", label: "Board briefing", prompt: "List decisions required from the board, the evidence supporting each decision, and any reserved matters that remain blocked." },
  { id: "P-04", label: "Diligence gap report", prompt: "Identify diligence items that are ready, in progress or blocked, and map each gap to the responsible control register." },
  { id: "P-05", label: "Funding gate review", prompt: "Review the staged capital ladder and report which evidence gates are open, blocked or ready without assuming funding has been awarded." },
  { id: "P-06", label: "Engineering gate review", prompt: "Review engineering controls and identify unresolved conflicts or pending evidence before design freeze; do not infer validation completion." },
];

export const AI_QUERY_SUGGESTIONS = [
  "What are the five most important blockers right now?",
  "What evidence is missing before the next funding tranche?",
  "Which board decisions are currently blocked?",
  "Show all pending engineering controls.",
  "What investor diligence items are not ready?",
  "Which claims must not yet be presented as validated?",
];
