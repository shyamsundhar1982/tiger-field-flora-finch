import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Activity, AlertTriangle, BookOpen, ChevronDown, ClipboardCheck, Factory, Lightbulb, LogOut, Presentation, UserRound, Wallet, DraftingCompass, Radar, Network, Scale, Settings2, Boxes, LineChart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";
import { getCommandRole, lockCommand } from "@/lib/command-access";
import { canAccessPage, type CommandRole } from "@/lib/page-access";
import { getRouteMeta, navigationGroups, type PageDomain, type PageMode, type RouteMeta } from "@/lib/page-metadata";
import { ERP_FLOW, getErpFlowStep } from "@/lib/erp-flow";

type NavigationView = "classified" | "all";
const ICONS: Record<string, typeof Activity> = { command: Activity, finance: Wallet, manufacturing: Factory, inventory: Boxes, procurement: Boxes, engineering: DraftingCompass, epr: ClipboardCheck, knowledge: BookOpen, sales: LineChart, market: LineChart, legal: Scale, risk: AlertTriangle, leadership: Presentation };
const DOMAIN_LABELS: Record<PageDomain, string> = { command: "Command", finance: "Finance", manufacturing: "Manufacturing", inventory: "Inventory", procurement: "Procurement", engineering: "Engineering", epr: "EPR", knowledge: "Knowledge", sales: "Sales", market: "Market", legal: "Legal", risk: "Risk", leadership: "Executive", admin: "Admin" };
const DOMAIN_ORDER: PageDomain[] = ["finance", "procurement", "inventory", "manufacturing", "engineering", "epr", "knowledge", "sales", "market", "legal", "risk", "leadership"];
const MODE_LABELS: Record<PageMode, string> = { understand: "UNDERSTAND", observe: "OBSERVE", operate: "OPERATE", showcase: "SHOWCASE" };
const MODE_DESCRIPTIONS: Record<PageMode, string> = { understand: "Knowledge and context", observe: "Truth and status", operate: "Execution and control", showcase: "External presentation" };

function PageLink({ page, role, compact = false }: { page: RouteMeta; role: CommandRole | null; compact?: boolean }) {
  if (!canAccessPage(role, page)) return null;
  const flow = getErpFlowStep(page.route);
  return <Link key={page.route} to={page.route as never} title={flow ? `${flow.step.label}: ${flow.step.purpose}\nInputs: ${flow.step.inputs}\nOutputs: ${flow.step.outputs}` : page.label} className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-muted transition-colors hover:bg-surface hover:text-fg", compact ? "text-xs" : "text-sm")} activeProps={{ className: "bg-surface text-fg" }}><Activity className="size-4 shrink-0" />{page.label}</Link>;
}

function DomainGroup({ domain, mode, role }: { domain: PageDomain; mode: PageMode; role: CommandRole | null }) {
  const location = useLocation();
  const group = mode === "showcase" ? "Showcase" : mode === "observe" ? "Observe" : mode === "operate" ? "Operate" : "Understand";
  const pages = navigationGroups[group].filter((p) => p.domain === domain && canAccessPage(role, p));
  if (!pages.length) return null;
  const Icon = ICONS[domain] ?? Activity;
  const active = pages.some((p) => location.pathname === p.route || location.pathname.startsWith(`${p.route}/`));
  return <details open={active} className="group/domain"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle hover:bg-surface hover:text-fg [&::-webkit-details-marker]:hidden"><Icon className="size-3.5 shrink-0" /><span className="flex-1">{DOMAIN_LABELS[domain]}</span><span className="mr-1 text-[9px] font-normal tracking-normal text-muted">{pages.length}</span><ChevronDown className="size-3" /></summary><div className="ml-2 mt-1 space-y-0.5 border-l border-border pl-2">{pages.map((page) => <PageLink key={page.route} page={page} role={role} />)}</div></details>;
}

function ClassifiedMode({ mode, role }: { mode: PageMode; role: CommandRole | null }) {
  const location = useLocation();
  const group = mode === "showcase" ? "Showcase" : mode === "observe" ? "Observe" : mode === "operate" ? "Operate" : "Understand";
  const pages = navigationGroups[group].filter((p) => canAccessPage(role, p));
  if (!pages.length) return null;
  const active = pages.some((p) => location.pathname === p.route || location.pathname.startsWith(`${p.route}/`));
  return <details open={active || mode !== "showcase"} className="group/mode"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-fg hover:bg-surface [&::-webkit-details-marker]:hidden"><span className="flex-1">{MODE_LABELS[mode]}</span><span className="mr-1 text-[9px] font-normal tracking-normal text-muted">{MODE_DESCRIPTIONS[mode]}</span><ChevronDown className="size-3" /></summary><div className="ml-2 mt-1 space-y-1 border-l border-border pl-2">{DOMAIN_ORDER.map((domain) => <DomainGroup key={domain} domain={domain} mode={mode} role={role} />)}</div></details>;
}

const COMMAND_ITEMS = [
  { to: "/command", label: "Board", icon: Activity, exact: true },
  { to: "/command/control-tower", label: "Command Tower", icon: Radar },
  { to: "/command/management-intelligence", label: "Management Intelligence", icon: Lightbulb },
  { to: "/command/founder-command", label: "Founder Command", icon: UserRound },
  { to: "/command/decision-engine", label: "Decision Engine", icon: Network },
  { to: "/command/classification", label: "Classification Register", icon: Settings2 },
];

function CommandGroup({ role }: { role: CommandRole | null }) {
  const items = COMMAND_ITEMS.filter((item) => canAccessPage(role, getRouteMeta(item.to)));
  return <details open className="group/command"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-fg hover:bg-surface [&::-webkit-details-marker]:hidden"><Activity className="size-3.5" /><span className="flex-1">COMMAND</span><span className="text-[9px] font-normal tracking-normal text-muted">Executive decisions</span><ChevronDown className="size-3" /></summary><div className="ml-2 mt-1 space-y-0.5 border-l border-border pl-2">{items.map((item) => <Link key={item.to} to={item.to as never} activeOptions={item.exact ? { exact: true } : undefined} title={item.label} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted hover:bg-surface hover:text-fg" activeProps={{ className: "bg-surface text-fg" }}><item.icon className="size-4" />{item.label}</Link>)}</div></details>;
}

function PlanningGroup({ role }: { role: CommandRole | null }) {
  const location = useLocation();
  const pages = navigationGroups.Planning.filter((p) => canAccessPage(role, p));
  if (!pages.length) return null;
  const active = pages.some((p) => location.pathname === p.route || location.pathname.startsWith(`${p.route}/`));
  return <details open={active} className="group/planning"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-fg hover:bg-surface [&::-webkit-details-marker]:hidden"><LineChart className="size-3.5" /><span className="flex-1">PLANNING</span><span className="text-[9px] font-normal tracking-normal text-muted">Scenarios, assumptions & plans</span><ChevronDown className="size-3" /></summary><div className="ml-2 mt-1 space-y-0.5 border-l border-border pl-2">{pages.map((page) => <PageLink key={page.route} page={page} role={role} />)}</div></details>;
}

function FlowGuide({ role }: { role: CommandRole | null }) {
  const location = useLocation();
  const match = getErpFlowStep(location.pathname);
  if (!match) return null;
  const previous = match.index > 0 ? ERP_FLOW[match.index - 1] : null;
  const next = match.index < ERP_FLOW.length - 1 ? ERP_FLOW[match.index + 1] : null;
  const firstAccessible = (routes: string[]) => routes.find((route) => canAccessPage(role, getRouteMeta(route)));
  return <section className="mb-6 rounded-lg border border-border bg-surface/30 p-3" aria-label="ERP business flow"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle">ERP FLOW · {match.index + 1} / {ERP_FLOW.length}</p><p className="mt-1 text-sm font-medium text-fg">{match.step.label}</p></div><span className="hidden text-[10px] text-muted sm:block">Hover a step to understand its role</span></div><div className="mt-3 grid grid-cols-3 gap-1 sm:grid-cols-5">{ERP_FLOW.map((step, index) => <div key={step.id} className="group relative"><div title={`${step.label}: ${step.purpose}\nInputs: ${step.inputs}\nOutputs: ${step.outputs}`} className={cn("h-1.5 rounded-full", index === match.index ? "bg-fg" : index < match.index ? "bg-fg/50" : "bg-border")} /><div className="pointer-events-none absolute left-1/2 top-3 z-20 hidden w-64 -translate-x-1/2 rounded-md border border-border bg-bg p-3 text-left text-[10px] leading-4 shadow-lg group-hover:block"><p className="font-semibold text-fg">{step.label}</p><p className="mt-1 text-muted">{step.purpose}</p><p className="mt-2 text-subtle">Input: {step.inputs}</p><p className="text-subtle">Output: {step.outputs}</p></div></div>)}</div><div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">{previous && firstAccessible(previous.routes) ? <Link to={firstAccessible(previous.routes)! as never} className="rounded-md border border-border px-3 py-2 text-muted hover:bg-bg hover:text-fg">← {previous.label}<span className="ml-2 text-[10px] text-subtle">previous</span></Link> : <span />}{next && firstAccessible(next.routes) ? <Link to={firstAccessible(next.routes)! as never} className="rounded-md border border-border px-3 py-2 text-right text-muted hover:bg-bg hover:text-fg">{next.label} →<span className="ml-2 text-[10px] text-subtle">next</span></Link> : <span />}</div></section>;
}

function ContextBack() {
  const location = useLocation();
  const isCommand = location.pathname.startsWith("/command");
  if (!isCommand || location.pathname === "/command") return null;
  return <button type="button" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign("/command")} className="mb-4 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-muted transition-colors hover:bg-bg hover:text-fg" aria-label="Return to the previous command page">← Back</button>;
}

function MobileNavigation({ view, role, allPages, setView, logout, loggingOut }: { view: NavigationView; role: CommandRole | null; allPages: RouteMeta[]; setView: (view: NavigationView) => void; logout: () => void; loggingOut: boolean }) {
  return <div className="border-b border-border px-3 py-2 lg:hidden"><div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-surface/40 p-0.5"><button type="button" onClick={() => setView("classified")} className={cn("rounded px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]", view === "classified" ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg")}>VINDY 2.0</button><button type="button" onClick={() => setView("all")} className={cn("rounded px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]", view === "all" ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg")}>All Pages</button></div><nav className="mt-2 max-h-[55dvh] space-y-2 overflow-y-auto pb-1">{view === "classified" ? <><CommandGroup role={role} /><PlanningGroup role={role} /><ClassifiedMode mode="understand" role={role} /><ClassifiedMode mode="observe" role={role} /><ClassifiedMode mode="operate" role={role} /><ClassifiedMode mode="showcase" role={role} /></> : <details open><summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle"><Settings2 className="size-3.5" /><span className="flex-1">All Classified Pages</span><span className="text-[9px] text-muted">{allPages.length}</span></summary><div className="mt-2 space-y-1">{allPages.filter((p) => canAccessPage(role, p)).map((page) => <PageLink key={page.route} page={page} role={role} />)}</div></details>}</nav><button type="button" onClick={logout} disabled={loggingOut} className="mt-2 w-full rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">{loggingOut ? "Logging out…" : "Log out"}</button></div>;
}

export function CommandShell() {
  const navigate = useNavigate();
  const [role, setRole] = useState<CommandRole | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [view, setView] = useState<NavigationView>("classified");
  useEffect(() => { getCommandRole().then(setRole).catch(() => setRole(null)); }, []);
  const viewer = role === "viewer";
  const allPages = useMemo<RouteMeta[]>(() => Object.values(navigationGroups).flat(), []);
  async function logout() { if (loggingOut) return; setLoggingOut(true); try { await lockCommand(); setRole(null); await navigate({ to: "/command-login" }); } finally { setLoggingOut(false); } }
  return <div className="min-h-dvh bg-bg"><SiteHeader /><div className="mx-auto flex max-w-7xl"><aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-72 shrink-0 flex-col border-r border-border py-6 lg:flex"><p className="px-5 pb-3 text-[10px] uppercase tracking-[0.2em] text-subtle">VINDY 2.0 · Command</p><div className="px-3 pb-3"><div className="grid grid-cols-2 rounded-md border border-border bg-surface/40 p-0.5"><button type="button" onClick={() => setView("classified")} className={cn("rounded px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]", view === "classified" ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg")}>VINDY 2.0</button><button type="button" onClick={() => setView("all")} className={cn("rounded px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]", view === "all" ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg")}>All Pages</button></div></div><nav className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-4 pr-1 [scrollbar-width:thin]">{view === "classified" ? <><CommandGroup role={role} /><PlanningGroup role={role} /><ClassifiedMode mode="understand" role={role} /><ClassifiedMode mode="observe" role={role} /><ClassifiedMode mode="operate" role={role} /><ClassifiedMode mode="showcase" role={role} /></> : <details open><summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle"><Settings2 className="size-3.5" /><span className="flex-1">All Classified Pages</span><span className="text-[9px] text-muted">{allPages.length}</span></summary><div className="mt-2 space-y-1">{allPages.filter((p) => canAccessPage(role, p)).map((page) => <PageLink key={page.route} page={page} role={role} />)}</div></details>}</nav><div className="px-3 pt-3"><button type="button" onClick={logout} disabled={loggingOut} className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted hover:bg-surface hover:text-fg disabled:opacity-50"><LogOut className="size-4" />{loggingOut ? "Logging out…" : `Log out${viewer ? " · User" : role === "admin" ? " · Admin" : ""}`}</button></div></aside><div className="min-w-0 flex-1"><MobileNavigation view={view} role={role} allPages={allPages} setView={setView} logout={logout} loggingOut={loggingOut} /><div className="px-4 py-6 sm:px-6 lg:px-8"><ContextBack /><FlowGuide role={role} /><div className={cn(viewer && "pointer-events-none select-none opacity-95")}><fieldset disabled={viewer} className="m-0 min-w-0 border-0 p-0"><Outlet /></fieldset></div></div></div></div></div>;
}
