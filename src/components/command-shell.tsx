import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  ClipboardCheck,
  DraftingCompass,
  Factory,
  LineChart,
  LogOut,
  Settings2,
  Wallet,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";
import { getCommandRole, lockCommand } from "@/lib/command-access";
import { canAccessPage, type CommandRole } from "@/lib/page-access";
import { getRouteMeta } from "@/lib/page-metadata";

type WorkspaceItem = {
  to: string;
  label: string;
  icon: typeof Activity;
  context: Set<string>;
};

const MASTER_PLAN_ROUTE = "/command/planning";
const FINANCE_HOME_ROUTE = "/command/financial-cockpit";
const SUPPLY_HOME_ROUTE = "/command/operations";
const COMMERCIAL_HOME_ROUTE = "/command/sales";
const ENGINEERING_HOME_ROUTE = "/command/engineering";
const GOVERNANCE_HOME_ROUTE = "/command/governance";

const EXECUTIVE_CONTEXT_ROUTES = new Set<string>([
  "/command",
  "/command/decision-inbox",
  "/command/management-intelligence",
  "/command/founder-command",
  "/command/founder-control",
  "/command/decision-engine",
]);

const FINANCE_TABS = [
  { to: FINANCE_HOME_ROUTE, label: "Overview" },
  { to: "/command/finance-assumptions", label: "Plan" },
  { to: "/command/cash", label: "Cash" },
  { to: "/command/payables", label: "Payables" },
  { to: "/command/receivables", label: "Receivables" },
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
  "/command/actuals",
]);

const SUPPLY_TABS = [
  { to: SUPPLY_HOME_ROUTE, label: "Overview" },
  { to: "/command/procurement-planning", label: "Plan" },
  { to: "/command/purchase-execution", label: "Buy" },
  { to: "/command/receiving", label: "Receive" },
  { to: "/command/inventory", label: "Inventory" },
  { to: "/command/production-jobcards", label: "Release" },
  { to: "/command/production", label: "Production" },
  { to: "/command/quality", label: "Quality" },
] as const;
const SUPPLY_CONTEXT_ROUTES = new Set<string>([
  ...SUPPLY_TABS.map((tab) => tab.to),
  "/command/procurement",
  "/command/manufacturing",
  "/command/ops",
  "/command/actuals",
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

const COMMERCIAL_TABS = [
  { to: COMMERCIAL_HOME_ROUTE, label: "Demand & Orders" },
  { to: "/command/gtm", label: "GTM" },
  { to: "/command/market-survey", label: "Market" },
] as const;
const COMMERCIAL_CONTEXT_ROUTES = new Set<string>([
  ...COMMERCIAL_TABS.map((tab) => tab.to),
  "/command/phase-4",
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

const GOVERNANCE_TABS = [
  { to: GOVERNANCE_HOME_ROUTE, label: "Approvals" },
  { to: "/command/risk", label: "Risk" },
  { to: "/command/legal", label: "Legal & IP" },
  { to: "/command/qa-verification", label: "QA Verification" },
  { to: "/command/actions", label: "Audit & Actions" },
  { to: "/command/master-data", label: "Master Data" },
] as const;
const GOVERNANCE_CONTEXT_ROUTES = new Set<string>([
  ...GOVERNANCE_TABS.map((tab) => tab.to),
  "/command/users",
]);

const PLAN_CONTEXT_ROUTES = new Set<string>([
  MASTER_PLAN_ROUTE,
  "/command/finance-assumptions",
  "/command/scenarios",
  "/command/procurement-planning",
  "/command/funding",
]);

const WORKSPACES: WorkspaceItem[] = [
  { to: "/command", label: "Command Centre", icon: Activity, context: EXECUTIVE_CONTEXT_ROUTES },
  { to: MASTER_PLAN_ROUTE, label: "Master Plan", icon: LineChart, context: PLAN_CONTEXT_ROUTES },
  { to: ENGINEERING_HOME_ROUTE, label: "Engineering", icon: DraftingCompass, context: ENGINEERING_CONTEXT_ROUTES },
  { to: SUPPLY_HOME_ROUTE, label: "Supply & Production", icon: Factory, context: SUPPLY_CONTEXT_ROUTES },
  { to: COMMERCIAL_HOME_ROUTE, label: "Commercial", icon: LineChart, context: COMMERCIAL_CONTEXT_ROUTES },
  { to: FINANCE_HOME_ROUTE, label: "Finance", icon: Wallet, context: FINANCE_CONTEXT_ROUTES },
  { to: GOVERNANCE_HOME_ROUTE, label: "Governance", icon: ClipboardCheck, context: GOVERNANCE_CONTEXT_ROUTES },
];

function isAccessible(role: CommandRole | null, route: string) {
  return canAccessPage(role, getRouteMeta(route));
}

function CanonicalAnchor({
  to,
  label,
  active = false,
  className,
  children,
}: {
  to: string;
  label: string;
  active?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <a href={to} title={label} aria-current={active ? "page" : undefined} className={className}>
      {children ?? label}
    </a>
  );
}

function WorkspaceNavigation({ role, onNavigate }: { role: CommandRole | null; onNavigate?: () => void }) {
  const location = useLocation();
  const items = WORKSPACES.filter((item) => isAccessible(role, item.to));
  const inboxAccessible = isAccessible(role, "/command/decision-inbox");
  return (
    <section className="rounded-xl border border-border bg-surface/30 p-2">
      <div className="flex items-center gap-2 px-2 pb-2 pt-1">
        <Activity className="size-3.5 text-accent" />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg">Core workspaces</span>
        <span className="ml-auto text-[9px] text-muted">7 operating surfaces</span>
      </div>
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.context.has(location.pathname);
          return (
            <div key={item.to}>
              <CanonicalAnchor
                to={item.to}
                label={item.label}
                active={active}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-bg hover:text-fg",
                  active && "bg-bg text-fg shadow-sm",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active && "text-accent")} />
                {item.label}
              </CanonicalAnchor>
              {item.to === "/command" && inboxAccessible ? (
                <a
                  href="/command/decision-inbox"
                  onClick={onNavigate}
                  className={cn(
                    "ml-9 block rounded-md px-2 py-1.5 text-xs text-subtle hover:bg-bg hover:text-fg",
                    location.pathname === "/command/decision-inbox" && "text-accent",
                  )}
                >
                  Action Inbox
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
      {role === "admin" ? (
        <div className="mt-2 border-t border-border pt-2">
          <a
            href="/command/users"
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-bg hover:text-fg",
              location.pathname === "/command/users" && "bg-bg text-fg shadow-sm",
            )}
          >
            <Settings2 className="size-4 shrink-0 text-accent" />
            User Creation & Access
          </a>
        </div>
      ) : null}
    </section>
  );
}

function WorkspaceTabs({
  routes,
  context,
  label,
  role,
}: {
  routes: readonly { to: string; label: string }[];
  context: Set<string>;
  label: string;
  role: CommandRole | null;
}) {
  const location = useLocation();
  if (!context.has(location.pathname)) return null;
  const accessibleRoutes = routes.filter((tab) => isAccessible(role, tab.to));
  if (accessibleRoutes.length < 2) return null;
  return (
    <nav className="mb-6 overflow-x-auto rounded-xl border border-border bg-surface/50 p-1 [scrollbar-width:thin]" aria-label={label}>
      <div className="flex min-w-max gap-1">
        {accessibleRoutes.map((tab) => {
          const active = location.pathname === tab.to;
          return (
            <a
              key={tab.to}
              href={tab.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-lg px-4 py-2 text-xs font-semibold transition-colors",
                active
                  ? "border border-accent/35 bg-accent/10 text-accent"
                  : "border border-transparent text-muted hover:bg-bg/60 hover:text-fg",
              )}
            >
              {tab.label}
            </a>
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
}: {
  role: CommandRole | null;
  logout: () => void;
  loggingOut: boolean;
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
        <nav className="mt-2 max-h-[58dvh] overflow-y-auto pb-1">
          <WorkspaceNavigation role={role} onNavigate={() => setOpen(false)} />
        </nav>
      ) : null}
      {open ? (
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="mt-2 w-full rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg"
        >
          {loggingOut ? "Logging out…" : "Log out"}
        </button>
      ) : null}
    </div>
  );
}

export function CommandShell() {
  const navigate = useNavigate();
  const [role, setRole] = useState<CommandRole | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    getCommandRole().then(setRole).catch(() => setRole(null));
  }, []);

  const viewer = role === "viewer";

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await lockCommand();
      setRole(null);
      await navigate({ to: "/command-login" });
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
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <MobileNavigation role={role} logout={logout} loggingOut={loggingOut} />
          <div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
            <WorkspaceTabs role={role} routes={FINANCE_TABS} context={FINANCE_CONTEXT_ROUTES} label="Finance workspace" />
            <WorkspaceTabs role={role} routes={SUPPLY_TABS} context={SUPPLY_CONTEXT_ROUTES} label="Supply and Production workspace" />
            <WorkspaceTabs role={role} routes={COMMERCIAL_TABS} context={COMMERCIAL_CONTEXT_ROUTES} label="Commercial workspace" />
            <WorkspaceTabs role={role} routes={ENGINEERING_TABS} context={ENGINEERING_CONTEXT_ROUTES} label="Engineering workspace" />
            <WorkspaceTabs role={role} routes={GOVERNANCE_TABS} context={GOVERNANCE_CONTEXT_ROUTES} label="Governance workspace" />
            <fieldset disabled={viewer} className="m-0 min-w-0 border-0 p-0"><Outlet /></fieldset>
          </div>
        </div>
      </div>
    </div>
  );
}
