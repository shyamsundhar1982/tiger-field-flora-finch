import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Boxes,
  ChevronDown,
  ClipboardCheck,
  DraftingCompass,
  Factory,
  LineChart,
  LogOut,
  Presentation,
  Scale,
  Settings2,
  Wallet,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getCommandRole, lockCommand } from "@/lib/command-access";
import { canAccessPage, canAccessRoute, type CommandRole } from "@/lib/page-access";
import {
  navigationGroups,
  type PageDomain,
  type PageMode,
  type RouteMeta,
} from "@/lib/page-metadata";
import { cn } from "@/lib/utils";

const MASTER_PLAN_ROUTE = "/command/planning";
const FINANCE_HOME_ROUTE = "/command/financial-cockpit";
const SUPPLY_HOME_ROUTE = "/command/operations";
const COMMERCIAL_HOME_ROUTE = "/command/sales";
const ENGINEERING_HOME_ROUTE = "/command/engineering";
const GOVERNANCE_HOME_ROUTE = "/command/governance";

const FINANCE_TABS = [
  { to: FINANCE_HOME_ROUTE, label: "Overview" },
  { to: "/command/finance-assumptions", label: "Plan" },
  { to: "/command/cash", label: "Cash" },
  { to: "/command/payables", label: "Payables" },
  { to: "/command/receivables", label: "Receivables" },
  { to: "/command/balance-sheet", label: "Balance Sheet" },
  { to: "/command/ca-audit", label: "CA Audit" },
] as const;

const SUPPLY_TABS = [
  { to: SUPPLY_HOME_ROUTE, label: "Overview" },
  { to: "/command/procurement-planning", label: "Plan" },
  { to: "/command/purchase-execution", label: "Buy" },
  { to: "/command/receiving", label: "Receive" },
  { to: "/command/inventory", label: "Inventory" },
  { to: "/command/production", label: "Production" },
  { to: "/command/quality", label: "Quality" },
] as const;

const PLAN_SALES_TABS = [
  { to: MASTER_PLAN_ROUTE, label: "Plan" },
  { to: COMMERCIAL_HOME_ROUTE, label: "Demand & Orders" },
  { to: "/command/gtm", label: "GTM" },
  { to: "/command/market-survey", label: "Market" },
  { to: "/command/scenarios", label: "Scenarios" },
] as const;

const ENGINEERING_TABS = [
  { to: ENGINEERING_HOME_ROUTE, label: "Overview" },
  { to: "/command/product", label: "Product & Validation" },
  { to: "/command/bom", label: "BOM" },
  { to: "/command/bom-control", label: "BOM Control" },
] as const;

const GOVERNANCE_TABS = [
  { to: GOVERNANCE_HOME_ROUTE, label: "Approvals" },
  { to: "/command/risk", label: "Risk" },
  { to: "/command/legal", label: "Legal & IP" },
  { to: "/command/qa-verification", label: "QA Verification" },
  { to: "/command/actions", label: "Audit & Actions" },
] as const;

const ADMIN_TABS = [
  { to: "/command/users", label: "Users & Roles" },
  { to: "/command/master-data", label: "Master Data" },
] as const;

const FINANCE_CONTEXT = new Set<string>([
  ...FINANCE_TABS.map((tab) => tab.to),
  "/command/finance",
  "/command/finance-control",
  "/command/master-finance",
  "/command/aluminium-finance",
  "/command/funding",
  "/command/actuals",
]);
const SUPPLY_CONTEXT = new Set<string>([
  ...SUPPLY_TABS.map((tab) => tab.to),
  "/command/procurement",
  "/command/manufacturing",
  "/command/inventory-truth",
  "/command/inventory-ledgers",
  "/command/inventory-master",
  "/command/inventory-openings",
  "/command/inventory-control-audit",
  "/command/component-control",
  "/command/inventory-legacy",
  "/command/bom-inventory-mapping",
]);
const PLAN_SALES_CONTEXT = new Set<string>([...PLAN_SALES_TABS.map((tab) => tab.to)]);
const ENGINEERING_CONTEXT = new Set<string>([...ENGINEERING_TABS.map((tab) => tab.to)]);
const GOVERNANCE_CONTEXT = new Set<string>([...GOVERNANCE_TABS.map((tab) => tab.to)]);
const PEOPLE_CONTEXT = new Set<string>(["/command/people-office"]);
const ADMIN_CONTEXT = new Set<string>([...ADMIN_TABS.map((tab) => tab.to)]);
const COMMAND_CONTEXT = new Set<string>([
  "/command",
  "/command/control-tower",
  "/command/decision-inbox",
  "/command/management-intelligence",
  "/command/founder-command",
  "/command/founder-control",
  "/command/decision-engine",
  "/command/ibpe-operating-workspace",
]);

const FINANCE_GOVERNANCE_CONTEXT = new Set<string>([
  ...FINANCE_CONTEXT,
  ...GOVERNANCE_CONTEXT,
]);

const WORKSPACES = [
  { to: "/command", label: "Command", icon: Activity, context: COMMAND_CONTEXT },
  { to: MASTER_PLAN_ROUTE, label: "Plan & Sales", icon: LineChart, context: PLAN_SALES_CONTEXT },
  { to: ENGINEERING_HOME_ROUTE, label: "Product & Engineering", icon: DraftingCompass, context: ENGINEERING_CONTEXT },
  { to: SUPPLY_HOME_ROUTE, label: "Operations", icon: Factory, context: SUPPLY_CONTEXT },
  { to: "/command/people-office", label: "People & Office", icon: UsersRound, context: PEOPLE_CONTEXT },
  { to: FINANCE_HOME_ROUTE, label: "Finance & Governance", icon: Wallet, context: FINANCE_GOVERNANCE_CONTEXT },
  { to: "/command/users", label: "Admin", icon: Settings2, context: ADMIN_CONTEXT, adminOnly: true },
] as const;

const WORKSPACE_ROUTES = new Set<string>(WORKSPACES.map((item) => item.to));
const TAB_ROUTES = new Set<string>([
  ...FINANCE_TABS.map((item) => item.to),
  ...SUPPLY_TABS.map((item) => item.to),
  ...PLAN_SALES_TABS.map((item) => item.to),
  ...ENGINEERING_TABS.map((item) => item.to),
  ...GOVERNANCE_TABS.map((item) => item.to),
  ...ADMIN_TABS.map((item) => item.to),
]);
const LEGACY_ROUTES = new Set<string>([
  "/command/phase-4",
  "/command/phase-5",
  "/command/phase-6",
  "/command/phase-6a",
  "/command/management-intelligence",
  "/command/production-jobcards",
  "/command/ops",
]);

const ICONS: Record<PageDomain, typeof Activity> = {
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

const MODE_LABEL: Record<PageMode, string> = {
  understand: "Reference",
  observe: "Monitor",
  operate: "Specialist",
  showcase: "Showcase",
};

function isAccessible(role: CommandRole | null, route: string) {
  return canAccessRoute(role, route);
}

function ClientLink({
  to,
  className,
  children,
  onNavigate,
  active,
}: {
  to: string;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
  active?: boolean;
}) {
  return (
    <Link
      to={to as never}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={className}
    >
      {children}
    </Link>
  );
}

function WorkspaceNavigation({ role, onNavigate }: { role: CommandRole | null; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const secondary = useMemo(
    () =>
      Object.values(navigationGroups)
        .flat()
        .filter((page, index, all) => all.findIndex((candidate) => candidate.route === page.route) === index)
        .filter((page) => !page.navHidden)
        .filter((page) => !WORKSPACE_ROUTES.has(page.route) && !TAB_ROUTES.has(page.route) && !LEGACY_ROUTES.has(page.route))
        .filter((page) => canAccessPage(role, page)),
    [role],
  );

  return (
    <>
      <section className="rounded-xl border border-border bg-surface/30 p-2">
        <div className="flex items-center gap-2 px-2 pb-2 pt-1">
          <Activity className="size-3.5 text-accent" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg">Core workspaces</span>
          <span className="ml-auto text-[9px] text-muted">7 workflow areas</span>
        </div>
        <div className="space-y-0.5">
          {WORKSPACES.filter((item) => (!(item as { adminOnly?: boolean }).adminOnly || role === "admin") && isAccessible(role, item.to)).map((item) => {
            const Icon = item.icon;
            const active = item.context.has(pathname);
            return (
              <ClientLink
                key={item.to}
                to={item.to}
                active={active}
                onNavigate={onNavigate}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-bg hover:text-fg",
                  active && "bg-bg text-fg shadow-sm",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active && "text-accent")} />
                {item.label}
              </ClientLink>
            );
          })}
          {[
            ["/command/decision-inbox", "Action Inbox"],
            ["/command/control-tower", "ERP Reports"],
            ["/command/ibpe-operating-workspace", "VIBPE Workspace"],
          ].filter(([to]) => isAccessible(role, to)).map(([to, label]) => (
            <ClientLink
              key={to}
              to={to}
              onNavigate={onNavigate}
              active={pathname === to}
              className="ml-9 block rounded-md px-2 py-1.5 text-xs text-subtle hover:bg-bg hover:text-fg aria-[current=page]:text-accent"
            >
              {label}
            </ClientLink>
          ))}
        </div>
      </section>

      {secondary.length ? (
        <details className="mt-3 rounded-xl border border-border bg-surface/20">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
            <Settings2 className="size-4 text-accent" />
            <span className="flex-1">More functions</span>
            <ChevronDown className="size-4" />
          </summary>
          <div className="space-y-3 border-t border-border p-2">
            {(["understand", "observe", "operate", "showcase"] as PageMode[]).map((mode) => {
              const pages = secondary.filter((page) => page.mode === mode);
              if (!pages.length) return null;
              return (
                <section key={mode}>
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-subtle">{MODE_LABEL[mode]}</p>
                  <div className="space-y-0.5">
                    {pages.map((page: RouteMeta) => {
                      const Icon = ICONS[page.domain] ?? Activity;
                      return (
                        <ClientLink
                          key={page.route}
                          to={page.route}
                          onNavigate={onNavigate}
                          active={pathname === page.route || pathname.startsWith(`${page.route}/`)}
                          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted hover:bg-bg hover:text-fg aria-[current=page]:text-accent"
                        >
                          <Icon className="size-4 shrink-0" />
                          {page.label}
                        </ClientLink>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </details>
      ) : null}
    </>
  );
}

function WorkspaceTabs({
  routes,
  context,
  role,
  label,
}: {
  routes: readonly { to: string; label: string }[];
  context: Set<string>;
  role: CommandRole | null;
  label: string;
}) {
  const { pathname } = useLocation();
  if (!context.has(pathname)) return null;
  const accessible = routes.filter((route) => isAccessible(role, route.to));
  if (accessible.length < 2) return null;
  return (
    <nav className="mb-6 overflow-x-auto rounded-xl border border-border bg-surface/50 p-1 [scrollbar-width:thin]" aria-label={label}>
      <div className="flex min-w-max gap-1">
        {accessible.map((tab) => (
          <ClientLink
            key={tab.to}
            to={tab.to}
            active={pathname === tab.to}
            className="rounded-lg border border-transparent px-4 py-2 text-xs font-semibold text-muted transition-colors hover:bg-bg/60 hover:text-fg aria-[current=page]:border-accent/35 aria-[current=page]:bg-accent/10 aria-[current=page]:text-accent"
          >
            {tab.label}
          </ClientLink>
        ))}
      </div>
    </nav>
  );
}

const WORKFLOW_STEPS = [
  { label: "Demand", to: "/command/sales", routes: ["/command/sales"] },
  { label: "Engineering / BOM", to: "/command/bom-control", routes: ["/command/engineering", "/command/product", "/command/bom", "/command/bom-control"] },
  { label: "Material Check", to: "/command/inventory", routes: ["/command/inventory"] },
  { label: "Procurement", to: "/command/purchase-execution", routes: ["/command/procurement-planning", "/command/purchase-execution"] },
  { label: "Receiving", to: "/command/receiving", routes: ["/command/receiving"] },
  { label: "Job Card", to: "/command/production", routes: [] },
  { label: "Traveller", to: "/command/production", routes: [] },
  { label: "Production", to: "/command/production", routes: ["/command/production"] },
  { label: "Quality", to: "/command/quality", routes: ["/command/quality"] },
  { label: "Invoice / Collection", to: "/command/receivables", routes: ["/command/receivables"] },
] as const;

const WORKFLOW_CONTEXT = new Set<string>(WORKFLOW_STEPS.flatMap((step) => [...step.routes, step.to]));

function WorkflowRail({ role }: { role: CommandRole | null }) {
  const { pathname } = useLocation();
  if (!WORKFLOW_CONTEXT.has(pathname)) return null;
  const steps = WORKFLOW_STEPS.filter((step) => isAccessible(role, step.to));
  return (
    <nav aria-label="End-to-end operating workflow" className="mb-4 overflow-x-auto rounded-xl border border-border bg-surface/30 px-2 py-2 [scrollbar-width:thin]">
      <div className="flex min-w-max items-center gap-1">
        {steps.map((step, index) => {
          const active = step.routes.includes(pathname as never);
          return (
            <div key={step.label} className="flex items-center gap-1">
              {index ? <span className="px-1 text-subtle">→</span> : null}
              <ClientLink
                to={step.to}
                active={active}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-muted hover:bg-bg hover:text-fg",
                  active && "bg-accent/10 text-accent",
                )}
              >
                {step.label}
              </ClientLink>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function MobileNavigation({
  role,
  logout,
  loggingOut,
  logoutError,
}: {
  role: CommandRole | null;
  logout: () => void;
  loggingOut: boolean;
  logoutError: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border px-3 py-2 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="w-full rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted hover:bg-surface hover:text-fg"
      >
        {open ? "Close workspace menu" : "Open workspace menu"}
      </button>
      {open ? (
        <nav className="mt-2 max-h-[65dvh] overflow-y-auto pb-1">
          <WorkspaceNavigation role={role} onNavigate={() => setOpen(false)} />
        </nav>
      ) : null}
      {open ? (
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="mt-2 w-full rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg disabled:opacity-50"
        >
          {loggingOut ? "Logging out…" : "Log out"}
        </button>
      ) : null}
      {logoutError ? <p className="mt-2 text-xs text-danger">{logoutError}</p> : null}
    </div>
  );
}

export function CommandShell() {
  const navigate = useNavigate();
  const { user: individualUser } = useCurrentUserState();
  const [role, setRole] = useState<CommandRole | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    getCommandRole().then(setRole).catch(() => setRole(null));
  }, []);

  const viewer = role === "viewer";

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      // Always clear the compatibility session if it exists. A missing legacy
      // password/session must not block canonical individual sign-out.
      await lockCommand().catch(() => undefined);
      setRole(null);

      if (individualUser && !individualUser.isDevFallback) {
        // The prewired helper clears the Better Auth server session and the
        // transported preview bearer. Do not replace this with authClient.signOut().
        await signOut("/login");
        return;
      }

      // Legacy-only viewers have no Better Auth session to terminate.
      await navigate({ to: "/login" });
    } catch (cause) {
      setLogoutError(cause instanceof Error ? cause.message : "Unable to confirm sign out. Retry.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader showNavigation={false} brandHref="/command" />
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-72 shrink-0 flex-col border-r border-border py-6 lg:flex">
          <p className="px-5 pb-3 text-[10px] uppercase tracking-[0.2em] text-subtle">VINDY 2.0 · Operating System</p>
          <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pr-1 [scrollbar-width:thin]">
            <WorkspaceNavigation role={role} />
          </nav>
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted hover:bg-surface hover:text-fg disabled:opacity-50"
            >
              <LogOut className="size-4" />
              {loggingOut ? "Logging out…" : `Log out${viewer ? " · User" : role === "admin" ? " · Admin" : ""}`}
            </button>
            {logoutError ? <p className="mt-2 text-xs leading-5 text-danger">{logoutError}</p> : null}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <MobileNavigation role={role} logout={logout} loggingOut={loggingOut} logoutError={logoutError} />
          <div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
            <WorkflowRail role={role} />
            <WorkspaceTabs role={role} routes={FINANCE_TABS} context={FINANCE_CONTEXT} label="Finance workspace" />
            <WorkspaceTabs role={role} routes={SUPPLY_TABS} context={SUPPLY_CONTEXT} label="Operations workspace" />
            <WorkspaceTabs role={role} routes={PLAN_SALES_TABS} context={PLAN_SALES_CONTEXT} label="Plan and Sales workspace" />
            <WorkspaceTabs role={role} routes={ENGINEERING_TABS} context={ENGINEERING_CONTEXT} label="Product and Engineering workspace" />
            <WorkspaceTabs role={role} routes={GOVERNANCE_TABS} context={GOVERNANCE_CONTEXT} label="Governance workspace" />
            <WorkspaceTabs role={role} routes={ADMIN_TABS} context={ADMIN_CONTEXT} label="Administration workspace" />
            <fieldset disabled={viewer} className="m-0 min-w-0 border-0 p-0">
              <Outlet />
            </fieldset>
          </div>
        </div>
      </div>
    </div>
  );
}
