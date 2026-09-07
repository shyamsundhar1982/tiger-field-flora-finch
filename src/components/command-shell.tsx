import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Activity, AlertTriangle, BookOpen, ChevronDown, ClipboardCheck, Factory, LogOut, Presentation, Wallet, DraftingCompass, Radar, Scale, Settings2, Boxes, LineChart } from "lucide-react";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";
import { getCommandRole, lockCommand } from "@/lib/command-access";
import { canAccessPage, type CommandRole } from "@/lib/page-access";
import { getRouteMeta, navigationGroups, type PageDomain, type PageMode, type RouteMeta } from "@/lib/page-metadata";
import { ERP_FLOW, getErpFlowStep } from "@/lib/erp-flow";

type NavigationView = "workspaces" | "more";
type WorkspaceItem = { to: string; label: string; icon: typeof Activity; context: Set<string>; exact?: boolean };

const MASTER_PLAN_ROUTE = "/command/planning";
const FINANCE_HOME_ROUTE = "/command/financial-cockpit";
const SUPPLY_HOME_ROUTE = "/command/operations";
const COMMERCIAL_HOME_ROUTE = "/command/sales";
const ENGINEERING_HOME_ROUTE = "/command/engineering";
const GOVERNANCE_HOME_ROUTE = "/command/governance";

const EXECUTIVE_SUPPORT_ROUTES = new Set<string>([
  "/command/control-tower",
  "/command/management-intelligence",
  "/command/founder-command",
  "/command/founder-control",
  "/command/decision-engine",
]);
const FINANCE_SUPPORT_ROUTES = new Set<string>([
  "/command/finance",
  "/command/balance-sheet",
  "/command/ca-audit",
  "/command/cash",
  "/command/finance-control",
  "/command/master-finance",
  "/command/aluminium-finance",
]);
const FINANCE_TABS = [
  { to: FINANCE_HOME_ROUTE, label: "Overview" },
  { to: "/command/finance-assumptions", label: "Plan" },
  { to: "/command/cash", label: "Cash" },
  { to: "/command/balance-sheet", label: "Balance Sheet" },
  { to: "/command/ca-audit", label: "CA Audit" },
  { to: "/command/scenarios", label: "Scenarios" },
] as const;
const FINANCE_CONTEXT_ROUTES = new Set<string>([
  ...FINANCE_TABS.map((tab) => tab.to),
  "/command/finance",
  "/command/finance-control",
  "/command/master-finance",
  "/command/aluminium-finance",
  "/command/funding",
]);

const SUPPLY_SUPPORT_ROUTES = new Set<string>([
  "/command/procurement",
  "/command/inventory",
  "/command/production",
  "/command/manufacturing",
  "/command/quality",
  "/command/ops",
  "/command/actuals",
  "/command/production-jobcards",
]);
const SUPPLY_TABS = [
  { to: SUPPLY_HOME_ROUTE, label: "Overview" },
  { to: "/command/procurement", label: "Procurement" },
  { to: "/command/inventory", label: "Inventory" },
  { to: "/command/production", label: "Production" },
  { to: "/command/manufacturing", label: "Manufacturing" },
  { to: "/command/quality", label: "Quality" },
] as const;
const SUPPLY_CONTEXT_ROUTES = new Set<string>([
  ...SUPPLY_TABS.map((tab) => tab.to),
  "/command/ops",
  "/command/actuals",
  "/command/production-jobcards",
  "/command/procurement-planning",
  "/command/inventory-truth",
  "/command/inventory-ledgers",
  "/command/inventory-master",
  "/command/inventory-openings",
  "/command/inventory-control-audit",
  "/command/component-control",
  "/command/inventory-legacy",
  "/command/bom-inventory-mapping",
  "/command/phase-6",
]);

const COMMERCIAL_SUPPORT_ROUTES = new Set<string>([
  "/command/gtm",
  "/command/market-survey",
]);
const COMMERCIAL_TABS = [
  { to: COMMERCIAL_HOME_ROUTE, label: "Demand & Orders" },
  { to: "/command/gtm", label: "GTM" },
  { to: "/command/market-survey", label: "Market" },
] as const;
const COMMERCIAL_CONTEXT_ROUTES = new Set<string>([
  ...COMMERCIAL_TABS.map((tab) => tab.to),
  "/command/phase-4",
]);

const ENGINEERING_SUPPORT_ROUTES = new Set<string>([
  "/command/product",
  "/command/bom",
  "/command/bom-control",
]);
const ENGINEERING_TABS = [
  { to: ENGINEERING_HOME_ROUTE, label: "Overview" },
  { to: "/command/product", label: "Product & Validation" },
  { to: "/command/bom", label: "BOM" },
  { to: "/command/bom-control", label: "BOM Control" },
] as const;
const ENGINEERING_CONTEXT_ROUTES = new Set<string>([
  ...ENGINEERING_TABS.map((tab) => tab.to),
  "/command/phase-5",
]);

const GOVERNANCE_SUPPORT_ROUTES = new Set<string>([
  "/command/risk",
  "/command/legal",
  "/command/qa-verification",
  "/command/actions",
]);
const GOVERNANCE_TABS = [
  { to: GOVERNANCE_HOME_ROUTE, label: "Approvals" },
  { to: "/command/risk", label: "Risk" },
  { to: "/command/legal", label: "Legal & IP" },
  { to: "/command/qa-verification", label: "QA Verification" },
  { to: "/command/actions", label: "Audit & Actions" },
] as const;
const GOVERNANCE_CONTEXT_ROUTES = new Set<string>(GOVERNANCE_TABS.map((tab) => tab.to));

const PLAN_SUPPORT_ROUTES = new Set<string>([
  "/command/finance-assumptions",
  "/command/scenarios",
  "/command/procurement-planning",
  "/command/funding",
]);
const PLAN_CONTEXT_ROUTES = new Set<string>([MASTER_PLAN_ROUTE, ...PLAN_SUPPORT_ROUTES]);
const LEGACY_ROUTES = new Set<string>([
  "/command/phase-4",
  "/command/phase-5",
  "/command/phase-6",
  "/command/phase-6a",
]);
const LEGACY_ROUTE_REDIRECTS: Record<string, string> = {
  "/command/phase-4": COMMERCIAL_HOME_ROUTE,
  "/command/phase-5": ENGINEERING_HOME_ROUTE,
  "/command/phase-6": SUPPLY_HOME_ROUTE,
  "/command/phase-6a": "/command/epr-execution",
};

const WORKSPACES: WorkspaceItem[] = [
  { to: "/command", label: "Command Centre", icon: Activity, context: new Set<string>(["/command", ...EXECUTIVE_SUPPORT_ROUTES]), exact: true },
  { to: MASTER_PLAN_ROUTE, label: "Master Plan", icon: LineChart, context: PLAN_CONTEXT_ROUTES },
  { to: ENGINEERING_HOME_ROUTE, label: "Engineering", icon: DraftingCompass, context: ENGINEERING_CONTEXT_ROUTES },
  { to: SUPPLY_HOME_ROUTE, label: "Supply & Production", icon: Factory, context: SUPPLY_CONTEXT_ROUTES },
  { to: COMMERCIAL_HOME_ROUTE, label: "Commercial", icon: LineChart, context: COMMERCIAL_CONTEXT_ROUTES },
  { to: FINANCE_HOME_ROUTE, label: "Finance", icon: Wallet, context: FINANCE_CONTEXT_ROUTES },
  { to: GOVERNANCE_HOME_ROUTE, label: "Governance", icon: ClipboardCheck, context: GOVERNANCE_CONTEXT_ROUTES },
];
const WORKSPACE_ROUTES = new Set<string>(WORKSPACES.map((item) => item.to));
const SUPPORT_ROUTES = new Set<string>([
  ...EXECUTIVE_SUPPORT_ROUTES,
  ...FINANCE_SUPPORT_ROUTES,
  ...SUPPLY_SUPPORT_ROUTES,
  ...COMMERCIAL_SUPPORT_ROUTES,
  ...ENGINEERING_SUPPORT_ROUTES,
  ...GOVERNANCE_SUPPORT_ROUTES,
  ...PLAN_SUPPORT_ROUTES,
]);

const ICONS: Record<string, typeof Activity> = {
  command: Activity,
  finance: Wallet,
  manufacturing: Factory,
  inventory: Boxes,
  procurement: Boxes,
  engineering: DraftingCompass,
  epr: ClipboardCheck,
  knowledge: BookOpen,
  sales: LineChart,
  market: LineChart,
  legal: Scale,
  risk: AlertTriangle,
  leadership: Presentation,
  admin: Settings2,
};
const DOMAIN_LABELS: Record<PageDomain, string> = {
  command: "Command",
  finance: "Finance",
  manufacturing: "Manufacturing",
  inventory: "Inventory",
  procurement: "Procurement",
  engineering: "Engineering",
  epr: "EPR",
  knowledge: "Knowledge",
  sales: "Sales",
  market: "Market",
  legal: "Legal",
  risk: "Risk",
  leadership: "Executive",
  admin: "Administration",
};
const DOMAIN_ORDER: PageDomain[] = ["knowledge", "epr", "finance", "procurement", "inventory", "manufacturing", "engineering", "sales", "market", "legal", "risk", "leadership", "command", "admin"];
const MODE_LABELS: Record<PageMode, string> = { understand: "REFERENCE", observe: "MONITOR", operate: "SPECIALIST", showcase: "SHOWCASE" };
const MODE_DESCRIPTIONS: Record<PageMode, string> = { understand: "Knowledge & context", observe: "Specialist status", operate: "Deep controls", showcase: "External presentation" };

function isSecondaryNavigationPage(page: RouteMeta) {
  return !WORKSPACE_ROUTES.has(page.route) && !SUPPORT_ROUTES.has(page.route) && !LEGACY_ROUTES.has(page.route);
}

function PageLink({ page, role }: { page: RouteMeta; role: CommandRole | null }) {
  if (!canAccessPage(role, page)) return null;
  const Icon = ICONS[page.domain] ?? Activity;
  return <Link to={page.route as never} title={page.label} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-fg" activeProps={{ className: "bg-surface text-fg" }}><Icon className="size-4 shrink-0" />{page.label}</Link>;
}

function WorkspaceNavigation({ role }: { role: CommandRole | null }) {
  const location = useLocation();
  const items = WORKSPACES.filter((item) => canAccessPage(role, getRouteMeta(item.to)));
  return <section className="rounded-xl border border-border bg-surface/30 p-2"><div className="flex items-center gap-2 px-2 pb-2 pt-1"><Activity className="size-3.5 text-accent" /><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg">Core workspaces</span><span className="ml-auto text-[9px] text-muted">7 operating surfaces</span></div><div className="space-y-0.5">{items.map((item) => { const Icon = item.icon; const active = item.context.has(location.pathname); return <Link key={item.to} to={item.to as never} activeOptions={item.exact ? { exact: true } : undefined} title={item.label} className={cn("flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-bg hover:text-fg", active && "bg-bg text-fg shadow-sm")} activeProps={{ className: "bg-bg text-fg shadow-sm" }}><Icon className={cn("size-4 shrink-0", active && "text-accent")} />{item.label}</Link>; })}</div></section>;
}

function SecondaryDomainGroup({ domain, mode, role }: { domain: PageDomain; mode: PageMode; role: CommandRole | null }) {
  const group = mode === "showcase" ? "Showcase" : mode === "observe" ? "Observe" : mode === "operate" ? "Operate" : "Understand";
  const pages = navigationGroups[group].filter((page) => page.domain === domain && isSecondaryNavigationPage(page) && canAccessPage(role, page));
  if (!pages.length) return null;
  const Icon = ICONS[domain] ?? Activity;
  return <details className="group/domain"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle hover:bg-surface hover:text-fg [&::-webkit-details-marker]:hidden"><Icon className="size-3.5" /><span className="flex-1">{DOMAIN_LABELS[domain]}</span><span className="text-[9px] font-normal tracking-normal text-muted">{pages.length}</span><ChevronDown className="size-3" /></summary><div className="ml-2 mt-1 space-y-0.5 border-l border-border pl-2">{pages.map((page) => <PageLink key={page.route} page={page} role={role} />)}</div></details>;
}

function SecondaryMode({ mode, role }: { mode: PageMode; role: CommandRole | null }) {
  const location = useLocation();
  const group = mode === "showcase" ? "Showcase" : mode === "observe" ? "Observe" : mode === "operate" ? "Operate" : "Understand";
  const pages = navigationGroups[group].filter((page) => isSecondaryNavigationPage(page) && canAccessPage(role, page));
  if (!pages.length) return null;
  const active = pages.some((page) => location.pathname === page.route || location.pathname.startsWith(`${page.route}/`));
  return <details open={active} className="group/mode"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-fg hover:bg-surface [&::-webkit-details-marker]:hidden"><span className="flex-1">{MODE_LABELS[mode]}</span><span className="mr-1 text-[9px] font-normal tracking-normal text-muted">{MODE_DESCRIPTIONS[mode]}</span><ChevronDown className="size-3" /></summary><div className="ml-2 mt-1 space-y-1 border-l border-border pl-2">{DOMAIN_ORDER.map((domain) => <SecondaryDomainGroup key={domain} domain={domain} mode={mode} role={role} />)}</div></details>;
}

function MoreNavigation({ role }: { role: CommandRole | null }) {
  return <div className="space-y-1"><div className="flex items-center gap-2 px-3 pb-2 text-[10px] uppercase tracking-[0.16em] text-subtle"><Settings2 className="size-3.5" />Reference, specialist, showcase & administration</div><SecondaryMode mode="understand" role={role} /><SecondaryMode mode="observe" role={role} /><SecondaryMode mode="operate" role={role} /><SecondaryMode mode="showcase" role={role} /></div>;
}

function WorkspaceTabs({ routes, context, label }: { routes: readonly { to: string; label: string }[]; context: Set<string>; label: string }) {
  const location = useLocation();
  if (!context.has(location.pathname)) return null;
  return <nav className="mb-6 overflow-x-auto rounded-xl border border-border bg-surface/50 p-1 [scrollbar-width:thin]" aria-label={label}><div className="flex min-w-max gap-1">{routes.map((tab) => <Link key={tab.to} to={tab.to as never} className={cn("rounded-lg px-4 py-2 text-xs font-semibold transition-colors", location.pathname === tab.to ? "border border-accent/35 bg-accent/10 text-accent" : "border border-transparent text-muted hover:bg-bg/60 hover:text-fg")}>{tab.label}</Link>)}</div></nav>;
}

function FlowGuide({ role }: { role: CommandRole | null }) {
  const location = useLocation();
  const match = getErpFlowStep(location.pathname);
  if (!match) return null;
  const previous = match.index > 0 ? ERP_FLOW[match.index - 1] : null;
  const next = match.index < ERP_FLOW.length - 1 ? ERP_FLOW[match.index + 1] : null;
  const firstAccessible = (routes: string[]) => routes.map((route) => LEGACY_ROUTE_REDIRECTS[route] ?? route).find((route) => canAccessPage(role, getRouteMeta(route)));
  const stages = [
    { label: "Engineering", range: [1, 4], icon: DraftingCompass },
    { label: "Commercial", range: [5, 6], icon: LineChart },
    { label: "Finance", range: [7], icon: Wallet },
    { label: "Decision", range: [8], icon: Radar },
  ];
  const currentStage = stages.findIndex((stage) => match.index >= stage.range[0] && match.index <= stage.range[1]);
  return (
    <section className="mb-5 rounded-xl border border-border bg-surface/35 p-3" aria-label="ERP business flow">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-subtle">ERP flow</p>
        <p className="text-xs font-medium text-fg">{match.step.label}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const done = index < currentStage;
          const active = index === currentStage;
          return (
            <div key={stage.label} className={cn("flex min-w-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[10px]", active ? "border-accent bg-accent/10 text-fg" : "border-border bg-bg/30 text-muted")}>
              <Icon className={cn("size-3.5 shrink-0", active && "text-accent")} />
              <span className="truncate font-semibold">{stage.label}</span>
              <span className="ml-auto text-[9px] text-subtle">{done ? "✓" : active ? "●" : "○"}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid gap-2 text-[10px] sm:grid-cols-2">
        {previous && firstAccessible(previous.routes) ? <Link to={firstAccessible(previous.routes)! as never} className="rounded-md border border-border px-2.5 py-1.5 text-muted hover:bg-bg hover:text-fg">← {previous.label}</Link> : <span />}
        {next && firstAccessible(next.routes) ? <Link to={firstAccessible(next.routes)! as never} className="rounded-md border border-border px-2.5 py-1.5 text-left text-muted hover:bg-bg hover:text-fg sm:text-right">{next.label} →</Link> : <span />}
      </div>
    </section>
  );
}

function workspaceForPath(pathname: string) {
  const route = LEGACY_ROUTE_REDIRECTS[pathname] ?? pathname;
  return WORKSPACES.find((workspace) => [...workspace.context].some((candidate) => route === candidate || route.startsWith(`${candidate}/`)));
}

function ContextBack() {
  const location = useLocation();
  if (!location.pathname.startsWith("/command") || location.pathname === "/command") return null;
  const workspace = workspaceForPath(location.pathname);
  const target = workspace?.to ?? "/command";
  const label = workspace?.label ?? "Command Centre";
  if (location.pathname === target) return null;
  return <Link to={target as never} className="mb-4 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:bg-bg hover:text-fg" aria-label={`Return to ${label}`}>← {label}</Link>;
}

function NavigationBody({ view, role }: { view: NavigationView; role: CommandRole | null }) {
  return view === "workspaces" ? <WorkspaceNavigation role={role} /> : <MoreNavigation role={role} />;
}

function MobileNavigation({ view, role, setView, logout, loggingOut }: { view: NavigationView; role: CommandRole | null; setView: (view: NavigationView) => void; logout: () => void; loggingOut: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className="border-b border-border px-3 py-2 lg:hidden"><div className="flex items-center gap-2"><div className="grid min-w-0 flex-1 grid-cols-2 gap-1 rounded-md border border-border bg-surface/40 p-0.5"><button type="button" onClick={() => setView("workspaces")} className={cn("rounded px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]", view === "workspaces" ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg")}>Workspaces</button><button type="button" onClick={() => setView("more")} className={cn("rounded px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]", view === "more" ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg")}>More</button></div><button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted hover:bg-surface hover:text-fg">{open ? "Close" : "Browse"}</button></div>{open ? <nav className="mt-2 max-h-[58dvh] overflow-y-auto pb-1"><NavigationBody view={view} role={role} /></nav> : null}<button type="button" onClick={logout} disabled={loggingOut} className="mt-2 w-full rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">{loggingOut ? "Logging out…" : "Log out"}</button></div>;
}

export function CommandShell() {
  const navigate = useNavigate();
  const [role, setRole] = useState<CommandRole | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [view, setView] = useState<NavigationView>("workspaces");
  useEffect(() => { getCommandRole().then(setRole).catch(() => setRole(null)); }, []);
  const viewer = role === "viewer";
  async function logout() { if (loggingOut) return; setLoggingOut(true); try { await lockCommand(); setRole(null); await navigate({ to: "/command-login" }); } finally { setLoggingOut(false); } }
  return <div className="min-h-dvh bg-bg"><SiteHeader /><div className="mx-auto flex max-w-7xl"><aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-72 shrink-0 flex-col border-r border-border py-6 lg:flex"><p className="px-5 pb-3 text-[10px] uppercase tracking-[0.2em] text-subtle">VINDY 2.0 · Operating System</p><div className="px-3 pb-3"><div className="grid grid-cols-2 rounded-md border border-border bg-surface/40 p-0.5"><button type="button" onClick={() => setView("workspaces")} className={cn("rounded px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]", view === "workspaces" ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg")}>Workspaces</button><button type="button" onClick={() => setView("more")} className={cn("rounded px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]", view === "more" ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg")}>More</button></div></div><nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pr-1 [scrollbar-width:thin]"><NavigationBody view={view} role={role} /></nav><div className="px-3 pt-3"><button type="button" onClick={logout} disabled={loggingOut} className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted hover:bg-surface hover:text-fg disabled:opacity-50"><LogOut className="size-4" />{loggingOut ? "Logging out…" : `Log out${viewer ? " · User" : role === "admin" ? " · Admin" : ""}`}</button></div></aside><div className="min-w-0 flex-1"><MobileNavigation view={view} role={role} setView={setView} logout={logout} loggingOut={loggingOut} /><div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8"><ContextBack /><FlowGuide role={role} /><WorkspaceTabs routes={FINANCE_TABS} context={FINANCE_CONTEXT_ROUTES} label="Finance workspace" /><WorkspaceTabs routes={SUPPLY_TABS} context={SUPPLY_CONTEXT_ROUTES} label="Supply and Production workspace" /><WorkspaceTabs routes={COMMERCIAL_TABS} context={COMMERCIAL_CONTEXT_ROUTES} label="Commercial workspace" /><WorkspaceTabs routes={ENGINEERING_TABS} context={ENGINEERING_CONTEXT_ROUTES} label="Engineering workspace" /><WorkspaceTabs routes={GOVERNANCE_TABS} context={GOVERNANCE_CONTEXT_ROUTES} label="Governance workspace" /><fieldset disabled={viewer} className="m-0 min-w-0 border-0 p-0"><Outlet /></fieldset></div></div></div></div>;
}
