export type WorkspaceId =
  | "command"
  | "plan-sales"
  | "engineering"
  | "operations"
  | "people-office"
  | "finance"
  | "governance"
  | "admin"
  /** @deprecated Prefer "finance" | "governance". */
  | "finance-governance";

export type WorkspaceLink = { to: string; label: string };
export type WorkflowStage = {
  id: string;
  label: string;
  shortLabel: string;
  to: string;
  routes: readonly string[];
  owner: WorkspaceId;
};

export const COMMAND_HOME = "/command";
export const PLAN_HOME = "/command/planning";
export const SALES_HOME = "/command/sales";
export const ENGINEERING_HOME = "/command/engineering";
export const OPERATIONS_HOME = "/command/operations";
export const PEOPLE_HOME = "/command/people-office";
export const FINANCE_HOME = "/command/financial-cockpit";
export const GOVERNANCE_HOME = "/command/governance";
export const ADMIN_HOME = "/command/users";
export const STORY_HOME = "/story";

/** Cross-cutting Command tools — not transaction workspaces. */
export const COMMAND_SHORTCUTS: readonly WorkspaceLink[] = [
  { to: "/command/decision-inbox", label: "Action Inbox" },
  { to: "/command/control-tower", label: "Control Tower" },
  { to: "/command/ibpe-operating-workspace", label: "VIBPE Workspace" },
  { to: "/command/ibpe-operating-workspace/assurance", label: "VIBPE Assurance" },
];

/** Plan & Commercial — demand, horizon planning, scenarios. */
export const PLAN_SALES_TABS: readonly WorkspaceLink[] = [
  { to: PLAN_HOME, label: "Plan" },
  { to: SALES_HOME, label: "Demand & Orders" },
  { to: "/command/scenarios", label: "Scenarios" },
  { to: "/command/gtm", label: "GTM" },
];

/** Product & Engineering — product identity, baselines, BOM. */
export const ENGINEERING_TABS: readonly WorkspaceLink[] = [
  { to: ENGINEERING_HOME, label: "Engineering" },
  { to: "/command/product", label: "Product" },
  { to: "/command/bom-control", label: "BOM Control" },
  { to: "/command/bom", label: "BOM Cost" },
];

/**
 * Supply & Operations — material → build → fulfilment.
 * Overview is the Operations/dispatch visibility surface (canonical writer remains Operations-owned).
 */
export const OPERATIONS_TABS: readonly WorkspaceLink[] = [
  { to: OPERATIONS_HOME, label: "Overview & Dispatch" },
  { to: "/command/inventory", label: "Inventory" },
  { to: "/command/procurement-planning", label: "Requirements" },
  { to: "/command/purchase-execution", label: "Purchase" },
  { to: "/command/receiving", label: "Receiving" },
  { to: "/command/production", label: "Build" },
  { to: "/command/quality", label: "Quality" },
];

/** Finance — money movement only (cash, AP, AR, position). */
export const FINANCE_TABS: readonly WorkspaceLink[] = [
  { to: FINANCE_HOME, label: "Overview" },
  { to: "/command/cash", label: "Cash" },
  { to: "/command/payables", label: "Payables" },
  { to: "/command/receivables", label: "Receivables" },
  { to: "/command/balance-sheet", label: "Balance Sheet" },
];

/** Governance & Assurance — control, evidence, risk, legal. */
export const GOVERNANCE_TABS: readonly WorkspaceLink[] = [
  { to: GOVERNANCE_HOME, label: "Approvals" },
  { to: "/command/risk", label: "Risk" },
  { to: "/command/legal", label: "Legal & IP" },
  { to: "/command/actions", label: "Audit & Actions" },
  { to: "/command/ca-audit", label: "CA Audit" },
];

export const ADMIN_TABS: readonly WorkspaceLink[] = [
  { to: ADMIN_HOME, label: "Users & Roles" },
  { to: "/command/master-data", label: "Master Data" },
];

/** @deprecated Prefer FINANCE_TABS + GOVERNANCE_TABS. */
export const FINANCE_GOVERNANCE_TABS: readonly WorkspaceLink[] = [
  ...FINANCE_TABS,
  ...GOVERNANCE_TABS,
];

export const WORKFLOW_STAGES: readonly WorkflowStage[] = [
  { id: "plan", label: "Plan", shortLabel: "Plan", to: PLAN_HOME, routes: [PLAN_HOME, "/command/scenarios"], owner: "plan-sales" },
  { id: "demand", label: "Demand / Order", shortLabel: "Demand", to: SALES_HOME, routes: [SALES_HOME], owner: "plan-sales" },
  {
    id: "engineering",
    label: "Engineering / BOM",
    shortLabel: "BOM",
    to: "/command/bom-control",
    routes: [ENGINEERING_HOME, "/command/product", "/command/bom-control", "/command/bom"],
    owner: "engineering",
  },
  {
    id: "material",
    label: "Material Check",
    shortLabel: "Material",
    to: "/command/inventory",
    routes: ["/command/inventory"],
    owner: "operations",
  },
  {
    id: "procurement",
    label: "Procurement",
    shortLabel: "Procure",
    to: "/command/purchase-execution",
    routes: ["/command/procurement-planning", "/command/purchase-execution"],
    owner: "operations",
  },
  { id: "receiving", label: "Receiving", shortLabel: "Receive", to: "/command/receiving", routes: ["/command/receiving"], owner: "operations" },
  { id: "job-card", label: "Job Card", shortLabel: "Job Card", to: "/command/production", routes: [], owner: "operations" },
  { id: "traveller", label: "Traveller", shortLabel: "Traveller", to: "/command/production", routes: [], owner: "operations" },
  { id: "production", label: "Production", shortLabel: "Build", to: "/command/production", routes: ["/command/production"], owner: "operations" },
  { id: "quality", label: "Quality", shortLabel: "Quality", to: "/command/quality", routes: ["/command/quality"], owner: "operations" },
  {
    id: "dispatch",
    label: "Dispatch",
    shortLabel: "Ship",
    to: OPERATIONS_HOME,
    routes: [OPERATIONS_HOME],
    owner: "operations",
  },
  { id: "invoice", label: "Invoice", shortLabel: "Invoice", to: "/command/receivables", routes: [], owner: "finance" },
  { id: "collection", label: "Collection", shortLabel: "Collect", to: "/command/receivables", routes: ["/command/receivables"], owner: "finance" },
];

/** Operator Command only — no founder/investor narrative pages. */
export const COMMAND_CONTEXT = new Set<string>([
  COMMAND_HOME,
  "/command/control-tower",
  "/command/decision-inbox",
  "/command/ibpe-operating-workspace",
  "/command/ibpe-operating-workspace/assurance",
]);

export const PLAN_SALES_CONTEXT = new Set<string>([
  ...PLAN_SALES_TABS.map((tab) => tab.to),
  "/command/market-survey",
  "/command/finance-assumptions",
]);

export const ENGINEERING_CONTEXT = new Set<string>([
  ...ENGINEERING_TABS.map((tab) => tab.to),
  "/command/bom-inventory-mapping",
]);

export const OPERATIONS_CONTEXT = new Set<string>([
  ...OPERATIONS_TABS.map((tab) => tab.to),
  "/command/procurement",
  "/command/manufacturing",
  "/command/inventory-truth",
  "/command/inventory-ledgers",
  "/command/inventory-master",
  "/command/inventory-openings",
  "/command/inventory-control-audit",
  "/command/component-control",
  "/command/inventory-legacy",
  "/command/production-jobcards",
  "/command/ops",
]);

export const PEOPLE_CONTEXT = new Set<string>([PEOPLE_HOME]);

export const FINANCE_CONTEXT = new Set<string>([
  ...FINANCE_TABS.map((tab) => tab.to),
  "/command/finance",
  "/command/finance-control",
  "/command/master-finance",
  "/command/aluminium-finance",
  "/command/actuals",
]);

export const GOVERNANCE_CONTEXT = new Set<string>([
  ...GOVERNANCE_TABS.map((tab) => tab.to),
  "/command/qa-verification",
  "/command/legal-control",
  "/command/epr-live",
  "/command/ibpe-operating-workspace/assurance",
]);

/** @deprecated Prefer FINANCE_CONTEXT or GOVERNANCE_CONTEXT. */
export const FINANCE_GOVERNANCE_CONTEXT = new Set<string>([
  ...FINANCE_CONTEXT,
  ...GOVERNANCE_CONTEXT,
]);

export const ADMIN_CONTEXT = new Set<string>([...ADMIN_TABS.map((tab) => tab.to)]);

/**
 * Narrative / investor / reference — audience is not the day-to-day operator.
 * Prefer StoryShell (/story) over Command sidebar for these.
 * Paths remain under /command/* until explicit redirects are added.
 */
export const STORY_ROUTES = new Set<string>([
  "/command/founder-command",
  "/command/founder-control",
  "/command/decision-engine",
  "/command/management-intelligence",
  "/command/investor-pitch",
  "/command/investor-pitch-external",
  "/command/investor-board",
  "/command/stakeholder-portal",
  "/command/demo-company",
  "/command/platform-walkthrough",
  "/command/knowledge",
  "/command/technical",
  "/command/design-philosophy",
  "/command/ai-knowledge",
  "/command/deployment-readiness",
  "/command/funding",
  STORY_HOME,
]);

export const LEGACY_ROUTES = new Set<string>([
  "/command/phase-4",
  "/command/phase-5",
  "/command/phase-6",
  "/command/phase-6a",
  "/command/management-intelligence",
  "/command/production-jobcards",
  "/command/ops",
  ...STORY_ROUTES,
]);

export const WORKFLOW_VISIBLE_ROUTES = new Set<string>([
  PLAN_HOME,
  SALES_HOME,
  ENGINEERING_HOME,
  "/command/product",
  "/command/bom",
  "/command/bom-control",
  OPERATIONS_HOME,
  "/command/procurement-planning",
  "/command/purchase-execution",
  "/command/receiving",
  "/command/inventory",
  "/command/production",
  "/command/quality",
  "/command/receivables",
]);

export function activeWorkflowStage(pathname: string): string | null {
  for (const stage of WORKFLOW_STAGES) {
    if (stage.routes.includes(pathname)) return stage.id;
  }
  return null;
}

export function workspaceForRoute(pathname: string): WorkspaceId | null {
  if (COMMAND_CONTEXT.has(pathname)) return "command";
  if (PLAN_SALES_CONTEXT.has(pathname)) return "plan-sales";
  if (ENGINEERING_CONTEXT.has(pathname)) return "engineering";
  if (OPERATIONS_CONTEXT.has(pathname)) return "operations";
  if (PEOPLE_CONTEXT.has(pathname)) return "people-office";
  if (FINANCE_CONTEXT.has(pathname)) return "finance";
  if (GOVERNANCE_CONTEXT.has(pathname)) return "governance";
  if (ADMIN_CONTEXT.has(pathname)) return "admin";
  return null;
}

export function isStoryRoute(pathname: string): boolean {
  return STORY_ROUTES.has(pathname) || pathname.startsWith(`${STORY_HOME}/`);
}
