import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  DraftingCompass,
  Factory,
  LineChart,
  LogOut,
  Search,
  Settings2,
  ShieldCheck,
  UsersRound,
  Wallet,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { BrandLockup, VayuMark } from "@/components/brand-lockup";
import { authEnabled, signOut } from "@/lib/auth/client";
import {
  ADMIN_CONTEXT,
  ADMIN_HOME,
  ADMIN_TABS,
  COMMAND_CONTEXT,
  COMMAND_HOME,
  ENGINEERING_CONTEXT,
  ENGINEERING_HOME,
  ENGINEERING_TABS,
  FINANCE_CONTEXT,
  FINANCE_HOME,
  FINANCE_TABS,
  GOVERNANCE_CONTEXT,
  GOVERNANCE_HOME,
  GOVERNANCE_TABS,
  OPERATIONS_CONTEXT,
  OPERATIONS_HOME,
  OPERATIONS_TABS,
  PEOPLE_CONTEXT,
  PEOPLE_HOME,
  PLAN_HOME,
  PLAN_SALES_CONTEXT,
  PLAN_SALES_TABS,
  WORKSPACE_NAVIGATION,
  workspaceForRoute,
} from "@/lib/operating-workflow";
import { canAccessRoute, type CommandRole } from "@/lib/page-access";
import { cn } from "@/lib/utils";

const WORKSPACES = [
  { to: COMMAND_HOME, label: "Command", icon: Activity, context: COMMAND_CONTEXT, id: "command" as const },
  { to: PLAN_HOME, label: "Plan & Commercial", icon: LineChart, context: PLAN_SALES_CONTEXT, id: "plan-sales" as const },
  { to: ENGINEERING_HOME, label: "Product & Engineering", icon: DraftingCompass, context: ENGINEERING_CONTEXT, id: "engineering" as const },
  { to: OPERATIONS_HOME, label: "Supply & Operations", icon: Factory, context: OPERATIONS_CONTEXT, id: "operations" as const },
  { to: PEOPLE_HOME, label: "People & Office", icon: UsersRound, context: PEOPLE_CONTEXT, id: "people-office" as const },
  { to: FINANCE_HOME, label: "Finance", icon: Wallet, context: FINANCE_CONTEXT, id: "finance" as const },
  { to: GOVERNANCE_HOME, label: "Governance & Assurance", icon: ShieldCheck, context: GOVERNANCE_CONTEXT, id: "governance" as const },
  { to: ADMIN_HOME, label: "Admin", icon: Settings2, context: ADMIN_CONTEXT, id: "admin" as const, adminOnly: true },
] as const;

type WorkspaceId = (typeof WORKSPACES)[number]["id"];
type SearchEntry = {
  to: string;
  label: string;
  workspaceId: WorkspaceId;
  workspaceLabel: string;
  section: string;
  kind: "workspace" | "page";
};

const SEARCH_ENTRIES: readonly SearchEntry[] = (() => {
  const byRoute = new Map<string, SearchEntry>();
  for (const workspace of WORKSPACES) {
    byRoute.set(workspace.to, {
      to: workspace.to,
      label: workspace.label,
      workspaceId: workspace.id,
      workspaceLabel: workspace.label,
      section: "Workspace",
      kind: "workspace",
    });
    for (const section of WORKSPACE_NAVIGATION[workspace.id]) {
      for (const item of section.items) {
        if (byRoute.has(item.to)) continue;
        byRoute.set(item.to, {
          to: item.to,
          label: item.label,
          workspaceId: workspace.id,
          workspaceLabel: workspace.label,
          section: section.label,
          kind: "page",
        });
      }
    }
  }
  return [...byRoute.values()];
})();

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

function CommandSearch({ role }: { role: CommandRole | null }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const trimmed = query.trim();

  const pageResults = useMemo(() => {
    const needle = trimmed.toLowerCase();
    if (!needle) return [];
    return SEARCH_ENTRIES.filter((entry) => isAccessible(role, entry.to))
      .filter((entry) => `${entry.label} ${entry.workspaceLabel} ${entry.section} ${entry.to}`.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [role, trimmed]);

  function clearSearch() {
    setQuery("");
    setOpen(false);
  }

  async function goToResult(to: string) {
    setQuery("");
    setOpen(false);
    await navigate({ to: to as never });
  }

  function searchGovernedRecords() {
    if (trimmed.length < 2) return;
    window.dispatchEvent(new CustomEvent("vyndi:traceability-search", { detail: { query: trimmed } }));
    setOpen(false);
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    searchGovernedRecords();
  }

  return (
    <section className="relative z-20 mb-4 rounded-xl border border-border bg-surface/45 p-3" aria-label="Global Command search">
      <form onSubmit={submitSearch} className="flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search VYNDI OS</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search orders, job cards, serials, POs, GRNs, suppliers, SKUs, quality, pages…"
            autoComplete="off"
            className="control w-full pl-9"
          />
        </label>

        <button
          type="submit"
          disabled={trimmed.length < 2}
          className="rounded-md border border-accent/35 bg-accent/10 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/15 disabled:cursor-default disabled:opacity-40"
        >
          Search records
        </button>
        <button
          type="button"
          onClick={clearSearch}
          disabled={!trimmed}
          className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted hover:bg-bg hover:text-fg disabled:cursor-default disabled:opacity-40"
        >
          Clear
        </button>
      </form>

      <p className="mt-2 text-[10px] text-subtle">
        Enter searches RBAC-filtered governed records and traceability. Matching pages remain quick navigation shortcuts.
      </p>

      {open && trimmed ? (
        <div className="absolute left-3 right-3 top-[calc(100%-0.25rem)] max-h-[380px] overflow-y-auto rounded-xl border border-border bg-bg p-2 shadow-xl">
          {trimmed.length >= 2 ? (
            <button
              type="button"
              onClick={searchGovernedRecords}
              className="mb-2 flex w-full items-start justify-between gap-3 rounded-lg border border-accent/25 bg-accent/5 px-3 py-2.5 text-left hover:bg-accent/10"
              aria-label={`Search governed records for ${trimmed}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-accent">Search governed records for “{trimmed}”</span>
                <span className="block text-[11px] text-muted">Orders · job cards · travellers/serials · POs · GRNs · quality · dispatch · invoices · collections · SKUs · suppliers · models</span>
              </span>
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-subtle">Enter</span>
            </button>
          ) : null}

          {pageResults.length ? (
            <div className="space-y-1" role="listbox" aria-label="Matching pages and workspaces">
              <p className="px-3 pb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-subtle">Pages & workspaces</p>
              {pageResults.map((entry) => (
                <button
                  key={entry.to}
                  type="button"
                  onClick={() => void goToResult(entry.to)}
                  className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface"
                  role="option"
                  aria-label={`Open ${entry.label}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-fg">{entry.label}</span>
                    <span className="block truncate text-[11px] text-muted">{entry.workspaceLabel} · {entry.section}</span>
                  </span>
                  <span className="max-w-[42%] truncate text-[10px] text-subtle">{entry.to}</span>
                </button>
              ))}
            </div>
          ) : trimmed.length >= 2 ? (
            <p className="px-3 py-2 text-xs text-muted" role="status">No page shortcut matched. Press Enter to search governed business records.</p>
          ) : (
            <p className="px-3 py-2 text-xs text-muted" role="status">Type at least two characters to search governed records.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function WorkspaceNavigation({ role, onNavigate }: { role: CommandRole | null; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const activeOwner = workspaceForRoute(pathname);

  return (
    <section className="rounded-xl border border-border bg-surface/30 p-2">
      <div className="flex items-center gap-2 px-2 pb-2 pt-1">
        <Activity className="size-3.5 text-accent" />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg">Operating workspaces</span>
        <span className="ml-auto text-[9px] text-muted">7 + admin</span>
      </div>
      <div className="space-y-1">
        {WORKSPACES.filter((item) => (!(item as { adminOnly?: boolean }).adminOnly || role === "admin") && isAccessible(role, item.to)).map((item) => {
          const Icon = item.icon;
          const active = activeOwner === item.id || (activeOwner === null && item.context.has(pathname));
          const sections = WORKSPACE_NAVIGATION[item.id];
          const activeChildRoute = sections
            .flatMap((section) => section.items)
            .filter((child) => pathname === child.to || pathname.startsWith(`${child.to}/`))
            .sort((left, right) => right.to.length - left.to.length)[0]?.to;
          return (
            <div key={item.to} className={cn("rounded-lg", active && "bg-bg/45")}>
              <ClientLink
                to={item.to}
                active={active}
                onNavigate={onNavigate}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-bg hover:text-fg",
                  active && "bg-bg text-fg shadow-sm",
                )}
              >
                <Icon className={cn("size-4 shrink-0 text-muted", active && "text-accent")} />
                <span className={cn(active ? "text-fg" : "text-muted")}>{item.label}</span>
              </ClientLink>

              {active ? (
                <div className="ml-5 border-l border-border/80 pb-2 pl-2 pt-1">
                  {sections.map((section) => {
                    const links = section.items.filter((child) => isAccessible(role, child.to));
                    if (!links.length) return null;
                    return (
                      <section key={section.label} className="mt-1 first:mt-0">
                        <p className="px-2 pb-1 pt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-subtle">
                          {section.label}
                        </p>
                        <div className="space-y-0.5">
                          {links.map((child) => {
                            const childActive = activeChildRoute === child.to;
                            return (
                              <ClientLink
                                key={child.to}
                                to={child.to}
                                active={childActive}
                                onNavigate={onNavigate}
                                className={cn(
                                  "block rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-surface hover:text-fg",
                                  childActive && "bg-surface text-accent",
                                )}
                              >
                                {child.label}
                              </ClientLink>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WorkspaceTabs({
  routes,
  role,
  label,
}: {
  routes: readonly { to: string; label: string }[];
  role: CommandRole | null;
  label: string;
}) {
  const { pathname } = useLocation();
  const tabPaths = useMemo(() => new Set(routes.map((r) => r.to)), [routes]);
  if (!tabPaths.has(pathname)) return null;
  const accessible = routes.filter((route) => isAccessible(role, route.to));
  if (accessible.length < 2) return null;
  return (
    <nav
      className="mb-4 overflow-x-auto rounded-xl border border-border bg-surface/50 p-1 [scrollbar-width:thin]"
      aria-label={label}
    >
      <div className="flex min-w-max gap-1">
        {accessible.map((tab) => {
          const active = pathname === tab.to;
          return (
            <ClientLink
              key={tab.to}
              to={tab.to}
              active={active}
              className={cn(
                "rounded-lg border border-transparent px-4 py-2 text-xs font-semibold transition-colors",
                active
                  ? "border-accent/35 bg-accent/10 text-accent"
                  : "text-muted hover:bg-bg/60 hover:text-fg",
              )}
            >
              {tab.label}
            </ClientLink>
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
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-surface/30 px-3 py-2">
        <VayuMark decorative className="size-8" />
        <span className="min-w-0">
          <span className="block truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">VĀYÚ SHASTR PVT. LTD.</span>
          <span className="block truncate text-xs font-bold text-accent">VYNDI OS · VIBPE Co-Pilot 2.0 → VYNDI</span>
        </span>
      </div>
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

export function CommandShell({ initialRole }: { initialRole: CommandRole }) {
  const navigate = useNavigate();
  const [role, setRole] = useState<CommandRole | null>(initialRole);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const viewer = role === "viewer";

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      setRole(null);

      if (authEnabled) {
        await signOut("/login");
        return;
      }

      await navigate({ to: "/login" });
    } catch (cause) {
      setLogoutError(cause instanceof Error ? cause.message : "Unable to confirm sign out. Retry.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r border-border py-6 lg:flex">
          <div className="mx-3 mb-4 rounded-xl border border-border bg-surface/30 p-3">
            <BrandLockup compact />
          </div>
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
            <CommandSearch role={role} />
            <WorkspaceTabs role={role} routes={PLAN_SALES_TABS} label="Plan and Commercial workspace" />
            <WorkspaceTabs role={role} routes={ENGINEERING_TABS} label="Product and Engineering workspace" />
            <WorkspaceTabs role={role} routes={OPERATIONS_TABS} label="Supply and Operations workspace" />
            <WorkspaceTabs role={role} routes={FINANCE_TABS} label="Finance workspace" />
            <WorkspaceTabs role={role} routes={GOVERNANCE_TABS} label="Governance and Assurance workspace" />
            <WorkspaceTabs role={role} routes={ADMIN_TABS} label="Administration workspace" />
            <fieldset disabled={viewer} className="m-0 min-w-0 border-0 p-0">
              <Outlet />
            </fieldset>
          </div>
        </div>
      </div>
    </div>
  );
}
