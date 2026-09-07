import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Activity, AlertTriangle, BookOpen, ChevronDown, ClipboardCheck, Factory, LogOut, Presentation, Wallet, DraftingCompass, Radar, Scale, Settings2, Boxes, LineChart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";
import { getCommandRole, lockCommand } from "@/lib/command-access";
import { canAccessPage, type CommandRole } from "@/lib/page-access";
import { getRouteMeta, navigationGroups, type PageDomain, type PageMode, type RouteMeta } from "@/lib/page-metadata";
import { ERP_FLOW, getErpFlowStep } from "@/lib/erp-flow";

type NavigationView = "classified" | "all";
const MASTER_PLAN_ROUTE = "/command/planning";
const FINANCE_HOME_ROUTE = "/command/financial-cockpit";
const SUPPLY_HOME_ROUTE = "/command/operations";
const EXECUTIVE_SUPPORT_ROUTES = new Set([
  "/command/control-tower",
  "/command/management-intelligence",
  "/command/founder-command",
  "/command/founder-control",
  "/command/decision-engine",
]);
const FINANCE_SUPPORT_ROUTES = new Set([
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
const FINANCE_CONTEXT_ROUTES = new Set([
  ...FINANCE_TABS.map((tab) => tab.to),
  "/command/finance",
  "/command/finance-control",
  "/command/master-finance",
  "/command/aluminium-finance",
  "/command/funding",
]);
const SUPPLY_SUPPORT_ROUTES = new Set([
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
const SUPPLY_CONTEXT_ROUTES = new Set([
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
]);
const ICONS: Record<string, typeof Activity> = { command: Activity, finance: Wallet, manufacturing: Factory, inventory: Boxes, procurement: Boxes, engineering: DraftingCompass, epr: ClipboardCheck, knowledge: BookOpen, sales: LineChart, market: LineChart, legal: Scale, risk: AlertTriangle, leadership: Presentation };
const DOMAIN_LABELS: Record<PageDomain, string> = { command: "Command", finance: "Finance", manufacturing: "Manufacturing", inventory: "Inventory", procurement: "Procurement", engineering: "Engineering", epr: "EPR", knowledge: "Knowledge", sales: "Sales", market: "Market", legal: "Legal", risk: "Risk", leadership: "Executive", admin: "Admin" };
const DOMAIN_ORDER: PageDomain[] = ["command", "finance", "procurement", "inventory", "manufacturing", "engineering", "epr", "knowledge", "sales", "market", "legal", "risk", "leadership", "admin"];
const MODE_LABELS: Record<PageMode, string> = { understand: "UNDERSTAND", observe: "OBSERVE", operate: "OPERATE", showcase: "SHOWCASE" };
const MODE_DESCRIPTIONS: Record<PageMode, string> = { understand: "Knowledge and context", observe: "Truth and status", operate: "Execution and control", showcase: "External presentation" };

function isPrimaryNavigationPage(page: RouteMeta) {
  return !EXECUTIVE_SUPPORT_ROUTES.has(page.route) && !FINANCE_SUPPORT_ROUTES.has(page.route) && !SUPPLY_SUPPORT_ROUTES.has(page.route);
}

function PageLink({ page, role, compact = false }: { page: RouteMeta; role: CommandRole | null; compact?: boolean }) {
  if (!canAccessPage(role, page)) return null;
  const location = useLocation();
  const flow = getErpFlowStep(page.route);
  const supplyActive = page.route === SUPPLY_HOME_ROUTE && SUPPLY_CONTEXT_ROUTES.has(location.pathname);
  const label = page.route === FINANCE_HOME_ROUTE ? "Finance" : page.route === SUPPLY_HOME_ROUTE ? "Supply & Production" : page.label;
  return <Link key={page.route} to={page.route as never} title={flow ? `${flow.step.label}: ${flow.step.purpose}\nInputs: ${flow.step.inputs}\nOutputs: ${flow.step.outputs}` : page.label} className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-muted transition-colors hover:bg-surface hover:text-fg", compact ? "text-xs" : "text-sm", supplyActive && "bg-surface text-fg")} activeProps={{ className: "bg-surface text-fg" }}><Activity className="size-4 shrink-0" />{label}</Link>;
}

function DomainGroup({ domain, mode, role }: { domain: PageDomain; mode: PageMode; role: CommandRole | null }) {
  const location = useLocation();
  const group = mode === "showcase" ? "Showcase" : mode === "observe" ? "Observe" : mode === "operate" ? "Operate" : "Understand";
  const pages = navigationGroups[group].filter((p) => p.domain === domain && isPrimaryNavigationPage(p) && canAccessPage(role, p));
  if (!pages.length) return null;
  const Icon = ICONS[domain] ?? Activity;
  const active = pages.some((p) => location.pathname === p.route || location.pathname.startsWith(`${p.route}/`) || (p.route === SUPPLY_HOME_ROUTE && SUPPLY_CONTEXT_ROUTES.has(location.pathname)));
  return <details open={active} className="group/domain"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle hover:bg-surface hover:text-fg [&::-webkit-details-marker]:hidden"><Icon className="size-3.5 shrink-0" /><span className="flex-1">{DOMAIN_LABELS[domain]}</span><span className="mr-1 text-[9px] font-normal tracking-normal text-muted">{pages.length}</span><ChevronDown className="size-3" /></summary><div className="ml-2 mt-1 space-y-0.5 border-l border-border pl-2">{pages.map((page) => <PageLink key={page.route} page={page} role={role} />)}</div></details>;
}

function ClassifiedMode({ mode, role }: { mode: PageMode; role: CommandRole | null }) {
  const location = useLocation();
  const group = mode === "showcase" ? "Showcase" : mode === "observe" ? "Observe" : mode === "operate" ? "Operate" : "Understand";
  const pages = navigationGroups[group].filter((p) => isPrimaryNavigationPage(p) && canAccessPage(role, p));
  if (!pages.length) return null;
  const active = pages.some((p) => location.pathname === p.route || location.pathname.startsWith(`${p.route}/`) || (p.route === SUPPLY_HOME_ROUTE && SUPPLY_CONTEXT_ROUTES.has(location.pathname)));
  return <details open={active || mode !== "showcase"} className="group/mode"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-fg hover:bg-surface [&::-webkit-details-marker]:hidden"><span className="flex-1">{MODE_LABELS[mode]}</span><span className="mr-1 text-[9px] font-normal tracking-normal text-muted">{MODE_DESCRIPTIONS[mode]}</span><ChevronDown className="size-3" /></summary><div className="ml-2 mt-1 space-y-1 border-l border-border pl-2">{DOMAIN_ORDER.map((domain) => <DomainGroup key={domain} domain={domain} mode={mode} role={role} />)}</div></details>;
}

const COMMAND_ITEMS = [
  { to: "/command", label: "Command Centre", icon: Activity, exact: true },
  { to: "/command/governance", label: "Governance", icon: ClipboardCheck },
];

function CommandGroup({ role }: { role: CommandRole | null }) {
  const items = COMMAND_ITEMS.filter((item) => canAccessPage(role, getRouteMeta(item.to)));
  return <details open className="group/command"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-fg hover:bg-surface [&::-webkit-details-marker]:hidden"><Activity className="size-3.5" /><span className="flex-1">COMMAND</span><span className="text-[9px] font-normal tracking-normal text-muted">Decide & govern</span><ChevronDown className="size-3" /></summary><div className="ml-2 mt-1 space-y-0.5 border-l border-border pl-2">{items.map((item) => <Link key={item.to} to={item.to as never} activeOptions={item.exact ? { exact: true } : undefined} title={item.label} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted hover:bg-surface hover:text-fg" activeProps={{ className: "bg-surface text-fg" }}><item.icon className="size-4" />{item.label}</Link>)}</div></details>;
}

function PlanningGroup({ role }: { role: CommandRole | null }) {
  const location = useLocation();
  const planningPages = navigationGroups.Planning.filter((p) => canAccessPage(role, p));
  const masterPlan = planningPages.find((p) => p.route === MASTER_PLAN_ROUTE);
  if (!masterPlan) return null;
  const active = planningPages.some((p) => location.pathname === p.route || location.pathname.startsWith(`${p.route}/`));
  return <details open={active} className="group/planning"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-fg hover:bg-surface [&::-webkit-details-marker]:hidden"><LineChart className="size-3.5" /><span className="flex-1">PLANNING</span><span className="text-[9px] font-normal tracking-normal text-muted">36-month integrated plan</span><ChevronDown className="size-3" /></summary><div className="ml-2 mt-1 space-y-0.5 border-l border-border pl-2"><Link to={MASTER_PLAN_ROUTE as never} title="Master Plan" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-fg" activeProps={{ className: "bg-surface text-fg" }}><LineChart className="size-4 shrink-0" />Master Plan</Link></div></details>;
}

function FinanceWorkspaceTabs() {
  const location = useLocation();
  if (!FINANCE_CONTEXT_ROUTES.has(location.pathname)) return null;
  return <nav className="mb-6 overflow-x-auto rounded-xl border border-border bg-surface/50 p-1" aria-label="Finance workspace"><div className="flex min-w-max gap-1">{FINANCE_TABS.map((tab) => <Link key={tab.to} to={tab.to as never} className={cn("rounded-lg px-4 py-2 text-xs font-semibold transition-colors", location.pathname === tab.to ? "bg-bg text-accent shadow-sm" : "text-muted hover:bg-bg/60 hover:text-fg")}>{tab.label}</Link>)}</div></nav>;
}

function SupplyWorkspaceTabs() {
  const location = useLocation();
  if (!SUPPLY_CONTEXT_ROUTES.has(location.pathname)) return null;
  return <nav className="mb-6 overflow-x-auto rounded-xl border border-border bg-surface/50 p-1" aria-label="Supply and Production workspace"><div className="flex min-w-max gap-1">{SUPPLY_TABS.map((tab) => <Link key={tab.to} to={tab.to as never} className={cn("rounded-lg px-4 py-2 text-xs font-semibold transition-colors", location.pathname === tab.to ? "bg-bg text-accent shadow-sm" : "text-muted hover:bg-bg/60 hover:text-fg")}>{tab.label}</Link>)}</div></nav>;
}

function FlowGuide({ role }: { role: CommandRole | null }) {
  const location = useLocation();
  const match = getErpFlowStep(location.pathname);
  if (!match) return null;
  const previous = match.index > 0 ? ERP_FLOW[match.index - 1] : null;
  const next = match.index < ERP_FLOW.length - 1 ? ERP_FLOW[match.index + 1] : null;
  const firstAccessible = (routes: string[]) => routes.find((route) => canAccessPage(role, getRouteMeta(route)));
  const stages = [
    { label: "Engineering", range: [1, 4], detail: "Product, BOM, mapping and inventory foundation.", icon: DraftingCompass },
    { label: "Commercial", range: [5, 6], detail: "Operations, EPR, sales and go-to-market execution.", icon: LineChart },
    { label: "Finance", range: [7], detail: "Finance, cash, funding and scenario intelligence.", icon: Wallet },
    { label: "Decision", range: [8], detail: "Validated evidence for management and board decisions.", icon: Radar },
  ];
  const currentStage = stages.findIndex((stage) => match.index >= stage.range[0] && match.index <= stage.range[1]);
  return <section className="mb-6 rounded-xl border border-border bg-surface/40 p-4 backdrop-blur-sm" aria-label="ERP business flow">
    <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle">ERP FLOW · EXECUTIVE PATH</p><p className="mt-1 text-sm font-medium text-fg">{match.step.label}</p></div><span className="hidden text-[10px] text-muted sm:block">Hover a stage to see what drives it</span></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-4">{stages.map((stage, index) => { const Icon=stage.icon; const done=index<currentStage; const active=index===currentStage; const sourceSteps=ERP_FLOW.slice(stage.range[0], stage.range[1]+1); return <div key={stage.label} className="group relative">
      <div className={cn("relative rounded-xl border p-3 transition-all", active ? "border-accent bg-accent/10 shadow-sm" : done ? "border-border bg-bg/60" : "border-border/70 bg-bg/30 hover:border-accent/40")}>
        <div className="flex items-center gap-2"><Icon className={cn("size-4", active ? "text-accent" : done ? "text-fg" : "text-subtle")} /><span className="text-sm font-semibold text-fg">{stage.label}</span><span className="ml-auto text-[9px] uppercase tracking-wider text-subtle">{done ? "Complete" : active ? "Current" : "Next"}</span></div>
        <p className="mt-1.5 text-[10px] leading-4 text-muted">{stage.detail}</p>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-72 -translate-x-1/2 rounded-xl border border-border bg-bg/95 p-3 text-left shadow-xl backdrop-blur-xl group-hover:block">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">{stage.label}</p>
        <div className="mt-2 space-y-2">{sourceSteps.map(step=><div key={step.id}><p className="text-xs font-medium text-fg">{step.label}</p><p className="text-[10px] leading-4 text-muted">{step.purpose}</p></div>)}</div>
      </div>
    </div>})}</div>
    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">{previous && firstAccessible(previous.routes) ? <Link to={firstAccessible(previous.routes)! as never} className="rounded-md border border-border px-3 py-2 text-muted hover:bg-bg hover:text-fg">← {previous.label}<span className="ml-2 text-[10px] text-subtle">previous</span></Link> : <span />}{next && firstAccessible(next.routes) ? <Link to={firstAccessible(next.routes)! as never} className="rounded-md border border-border px-3 py-2 text-right text-muted hover:bg-bg hover:text-fg">{next.label} →<span className="ml-2 text-[10px] text-subtle">next</span></Link> : <span />}</div>
  </section>;
}
function ContextBack() {
  const location = useLocation();
  const isCommand = location.pathname.startsWith("/command");
  if (!isCommand || location.pathname === "/command") return null;
  return <button type="button" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign("/command")} className="mb-4 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-muted transition-colors hover:bg-bg hover:text-fg" aria-label="Return to the previous command page">← Back</button>;
}

function MobileNavigation({ view, role, allPages, setView, logout, loggingOut }: { view: NavigationView; role: CommandRole | null; allPages: RouteMeta[]; setView: (view: NavigationView) => void; logout: () => void; loggingOut: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className="border-b border-border px-3 py-2 lg:hidden">
    <div className="flex items-center gap-2">
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-1 rounded-md border border-border bg-surface/40 p-0.5">
        <button type="button" onClick={() => setView("classified")} className={cn("rounded px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]", view === "classified" ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg")}>VINDY 2.0</button>
        <button type="button" onClick={() => setView("all")} className={cn("rounded px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]", view === "all" ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg")}>All Pages</button>
      </div>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted hover:bg-surface hover:text-fg">
        {open ? "Close" : "Browse"}
      </button>
    </div>
    {open ? <nav className="mt-2 max-h-[55dvh] space-y-2 overflow-y-auto pb-1">{view === "classified" ? <><CommandGroup role={role} /><PlanningGroup role={role} /><ClassifiedMode mode="understand" role={role} /><ClassifiedMode mode="observe" role={role} /><ClassifiedMode mode="operate" role={role} /><ClassifiedMode mode="showcase" role={role} /></> : <details open><summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle"><Settings2 className="size-3.5" /><span className="flex-1">All Classified Pages</span><span className="text-[9px] text-muted">{allPages.length}</span></summary><div className="mt-2 space-y-1">{allPages.filter((p) => canAccessPage(role, p)).map((page) => <PageLink key={page.route} page={page} role={role} />)}</div></details>}</nav> : null}
    <button type="button" onClick={logout} disabled={loggingOut} className="mt-2 w-full rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">{loggingOut ? "Logging out…" : "Log out"}</button>
  </div>;
}

export function CommandShell() {
  const navigate = useNavigate();
  const [role, setRole] = useState<CommandRole | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [view, setView] = useState<NavigationView>("classified");
  useEffect(() => { getCommandRole().then(setRole).catch(() => setRole(null)); }, []);
  const viewer = role === "viewer";
  const allPages = useMemo<RouteMeta[]>(() => Object.values(navigationGroups).flat().filter((page) => (page.group !== "Planning" || page.route === MASTER_PLAN_ROUTE) && isPrimaryNavigationPage(page)), []);
  async function logout() { if (loggingOut) return; setLoggingOut(true); try { await lockCommand(); setRole(null); await navigate({ to: "/command-login" }); } finally { setLoggingOut(false); } }
  return <div className="min-h-dvh bg-bg"><SiteHeader /><div className="mx-auto flex max-w-7xl"><aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-72 shrink-0 flex-col border-r border-border py-6 lg:flex"><p className="px-5 pb-3 text-[10px] uppercase tracking-[0.2em] text-subtle">VINDY 2.0 · Command</p><div className="px-3 pb-3"><div className="grid grid-cols-2 rounded-md border border-border bg-surface/40 p-0.5"><button type="button" onClick={() => setView("classified")} className={cn("rounded px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]", view === "classified" ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg")}>VINDY 2.0</button><button type="button" onClick={() => setView("all")} className={cn("rounded px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]", view === "all" ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg")}>All Pages</button></div></div><nav className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-4 pr-1 [scrollbar-width:thin]">{view === "classified" ? <><CommandGroup role={role} /><PlanningGroup role={role} /><ClassifiedMode mode="understand" role={role} /><ClassifiedMode mode="observe" role={role} /><ClassifiedMode mode="operate" role={role} /><ClassifiedMode mode="showcase" role={role} /></> : <details open><summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle"><Settings2 className="size-3.5" /><span className="flex-1">All Classified Pages</span><span className="text-[9px] text-muted">{allPages.length}</span></summary><div className="mt-2 space-y-1">{allPages.filter((p) => canAccessPage(role, p)).map((page) => <PageLink key={page.route} page={page} role={role} />)}</div></details>}</nav><div className="px-3 pt-3"><button type="button" onClick={logout} disabled={loggingOut} className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted hover:bg-surface hover:text-fg disabled:opacity-50"><LogOut className="size-4" />{loggingOut ? "Logging out…" : `Log out${viewer ? " · User" : role === "admin" ? " · Admin" : ""}`}</button></div></aside><div className="min-w-0 flex-1"><MobileNavigation view={view} role={role} allPages={allPages} setView={setView} logout={logout} loggingOut={loggingOut} /><div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8"><ContextBack /><FlowGuide role={role} /><FinanceWorkspaceTabs /><SupplyWorkspaceTabs /><div className={cn(viewer && "pointer-events-none select-none opacity-95")}><fieldset disabled={viewer} className="m-0 min-w-0 border-0 p-0"><Outlet /></fieldset></div></div></div></div></div>;
}
