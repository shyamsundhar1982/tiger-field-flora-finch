import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  DraftingCompass,
  Factory,
  LineChart,
  LogOut,
  Settings2,
  ShieldCheck,
  UsersRound,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getCommandRole, lockCommand } from "@/lib/command-access";
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
                            const childActive = pathname === child.to || pathname.startsWith(`${child.to}/`);
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
      await lockCommand().catch(() => undefined);
      setRole(null);

      if (individualUser && !individualUser.isDevFallback) {
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
