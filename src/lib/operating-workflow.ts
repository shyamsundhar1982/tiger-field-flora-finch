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

export type CanonicalWorkspaceId = Exclude<WorkspaceId, "finance-governance">;
export type WorkspaceLink = { to: string; label: string };
export type WorkspaceNavigationSection = {
  label: string;
  items: readonly WorkspaceLink[];
};
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

/** Cross-cutting Command tools — owned by Command, not transaction workspaces. */
export const COMMAND_SHORTCUTS: readonly WorkspaceLink[] = [
  { to: "/command/decision-inbox", label: "Action Inbox" },
  { to: "/command/control-tower", label: "Control Tower" },
  { to: "/command/ibpe-operating-workspace", label: "VIBPE Workspace" },
  { to: "/command/ibpe-operating-workspace/optimizer", label: "VIBPE Optimizer" },
  { to: "/command/ibpe-operating-workspace/assurance", label: "VIBPE Assurance" },
];

/** Plan & Commercial — demand, horizon planning, scenarios and route-to-market. */
export const PLAN_SALES_TABS: readonly WorkspaceLink[] = [
  { to: PLAN_HOME, label: "Plan" },
  { to: SALES_HOME, label: "Demand & Orders" },
  { to: "/command/scenarios", label: "Scenarios" },
  { to: "/command/gtm", label: "GTM" },
];

/** Product & Engineering — product identity → engineering baseline → controlled BOM. */
export const ENGINEERING_TABS: readonly WorkspaceLink[] = [
  { to: "/command/product", label: "Product" },
  { to: ENGINEERING_HOME, label: "Engineering" },
  { to: "/command/bom-control", label: "BOM Control" },
  { to: "/command/bom", label: "BOM Cost" },
];

/** Supply & Operations — inventory → requirements → purchase → receive → build → quality. */
export const OPERATIONS_TABS: readonly WorkspaceLink[] = [
  { to: OPERATIONS_HOME, label: "Overview" },
  { to: "/command/inventory", label: "Inventory" },
  { to: "/command/procurement-planning", label: "Requirements" },
  { to: "/command/purchase-execution", label: "Purchase" },
  { to: "/command/receiving", label: "Receiving" },
  { to: "/command/production", label: "Build" },
  { to: "/command/quality", label: "Quality" },
];

/** Finance — cash → AP/AR → financial position. */
export const FINANCE_TABS: readonly WorkspaceLink[] = [
  { to: FINANCE_HOME, label: "Overview" },
  { to: "/command/cash", label: "Cash" },
  { to: "/command/payables", label: "Payables" },
  { to: "/command/receivables", label: "Receivables" },
  { to: "/command/balance-sheet", label: "Balance Sheet" },
];

/** Governance & Assurance — approvals, risk, legal, audit. */
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

/**
 * Canonical navigation ownership.
 *
 * This is the user-facing information architecture. PageMode/domain metadata
 * still classifies behaviour and permissions, but it must not determine where
 * a page appears in navigation.
 */
export const WORKSPACE_NAVIGATION: Record<CanonicalWorkspaceId, readonly WorkspaceNavigationSection[]> = {
  command: [
    {
      label: "Command",
      items: [
        { to: COMMAND_HOME, label: "Command Centre" },
        { to: "/command/decision-inbox", label: "Action Inbox" },
        { to: "/command/control-tower", label: "Control Tower" },
      ],
    },
    {
      label: "VIBPE",
      items: [
        { to: "/command/ibpe-operating-workspace", label: "VIBPE Workspace" },
        { to: "/command/ibpe-operating-workspace/optimizer", label: "Optimizer" },
        { to: "/command/ibpe-operating-workspace/assurance", label: "VIBPE Assurance" },
      ],
    },
  ],
  "plan-sales": [
    {
      label: "Commercial flow",
      items: [...PLAN_SALES_TABS, { to: "/command/market-survey", label: "Market Survey" }],
    },
  ],
  engineering: [
    {
      label: "Product flow",
      items: ENGINEERING_TABS,
    },
  ],
  operations: [
    {
      label: "Execution flow",
      items: OPERATIONS_TABS,
    },
    {
      label: "Controls",
      items: [
        { to: "/command/procurement", label: "Procurement Control" },
        { to: "/command/manufacturing", label: "Manufacturing Controls" },
        { to: "/command/actuals", label: "Operational Actuals" },
      ],
    },
  ],
  "people-office": [
    {
      label: "Administration",
      items: [{ to: PEOPLE_HOME, label: "People & Office" }],
    },
  ],
  finance: [
    {
      label: "Finance flow",
      items: [...FINANCE_TABS, { to: "/command/finance-assumptions", label: "Financial Planning" }],
    },
    {
      label: "Controls & analysis",
      items: [
        { to: "/command/finance-control", label: "Finance Control" },
        { to: "/command/finance", label: "Finance Analysis" },
        { to: "/command/master-finance", label: "Consolidated Finance" },
        { to: "/command/aluminium-finance", label: "Aluminium Vertical" },
      ],
    },
  ],
  governance: [
    {
      label: "Governance",
      items: [
        { to: GOVERNANCE_HOME, label: "Approvals" },
        { to: "/command/risk", label: "Risk" },
        { to: "/command/legal", label: "Legal & IP" },
      ],
    },
    {
      label: "Compliance / EPR",
      items: [
        { to: "/command/epr-workflow", label: "EPR Workflow" },
        { to: "/command/epr-execution", label: "EPR Execution" },
        { to: "/command/epr-live", label: "EPR Live" },
        { to: "/command/qa-verification", label: "QA Verification" },
        { to: "/command/legal-control", label: "Legal Control" },
      ],
    },
    {
      label: "Audit",
      items: [
        { to: "/command/actions", label: "Audit & Actions" },
        { to: "/command/ca-audit", label: "CA Audit" },
      ],
    },
  ],
  admin: [
    {
      label: "Administration",
      items: [...ADMIN_TABS, { to: "/command/classification", label: "Classification" }],
    },
  ],
};

const workspaceRoutes = (id: CanonicalWorkspaceId) =>
  WORKSPACE_NAVIGATION[id].flatMap((section) => section.items.map((item) => item.to));

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

export const COMMAND_CONTEXT = new Set<string>(workspaceRoutes("command"));

export const PLAN_SALES_CONTEXT = new Set<string>(workspaceRoutes("plan-sales"));

export const ENGINEERING_CONTEXT = new Set<string>([
  ...workspaceRoutes("engineering"),
  "/command/bom-inventory-mapping",
]);

export const OPERATIONS_CONTEXT = new Set<string>([
  ...workspaceRoutes("operations"),
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

export const PEOPLE_CONTEXT = new Set<string>(workspaceRoutes("people-office"));

export const FINANCE_CONTEXT = new Set<string>(workspaceRoutes("finance"));

/** Governance tabs plus compliance/EPR/QA routes. Assurance stays under Command/VIBPE. */
export const GOVERNANCE_CONTEXT = new Set<string>(workspaceRoutes("governance"));

/** @deprecated Prefer FINANCE_CONTEXT or GOVERNANCE_CONTEXT. */
export const FINANCE_GOVERNANCE_CONTEXT = new Set<string>([
  ...FINANCE_CONTEXT,
  ...GOVERNANCE_CONTEXT,
]);

export const ADMIN_CONTEXT = new Set<string>(workspaceRoutes("admin"));

export const LEGACY_ROUTES = new Set<string>([
  "/command/phase-4",
  "/command/phase-5",
  "/command/phase-6",
  "/command/phase-6a",
  "/command/management-intelligence",
  "/command/production-jobcards",
  "/command/ops",
  "/command/founder-command",
  "/command/founder-control",
  "/command/decision-engine",
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

function matchesContext(context: ReadonlySet<string>, pathname: string) {
  if (context.has(pathname)) return true;
  return [...context].some((route) => route !== COMMAND_HOME && pathname.startsWith(`${route}/`));
}

export function workspaceForRoute(pathname: string): CanonicalWorkspaceId | null {
  if (matchesContext(COMMAND_CONTEXT, pathname)) return "command";
  if (matchesContext(PLAN_SALES_CONTEXT, pathname)) return "plan-sales";
  if (matchesContext(ENGINEERING_CONTEXT, pathname)) return "engineering";
  if (matchesContext(OPERATIONS_CONTEXT, pathname)) return "operations";
  if (matchesContext(PEOPLE_CONTEXT, pathname)) return "people-office";
  if (matchesContext(FINANCE_CONTEXT, pathname)) return "finance";
  if (matchesContext(GOVERNANCE_CONTEXT, pathname)) return "governance";
  if (matchesContext(ADMIN_CONTEXT, pathname)) return "admin";
  return null;
}
