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
  activeWorkflowStage,
  COMMAND_CONTEXT,
  COMMAND_HOME,
  COMMAND_SHORTCUTS,
  ENGINEERING_CONTEXT,
  ENGINEERING_HOME,
  ENGINEERING_TABS,
  FINANCE_GOVERNANCE_CONTEXT,
  FINANCE_GOVERNANCE_TABS,
  FINANCE_HOME,
  LEGACY_ROUTES,
  OPERATIONS_CONTEXT,
  OPERATIONS_HOME,
  OPERATIONS_TABS,
  PEOPLE_CONTEXT,
  PEOPLE_HOME,
  PLAN_HOME,
  PLAN_SALES_CONTEXT,
  PLAN_SALES_TABS,
  WORKFLOW_STAGES,
  WORKFLOW_VISIBLE_ROUTES,
} from "@/lib/operating-workflow";
import { canAccessPage, canAccessRoute, type CommandRole } from "@/lib/page-access";
import {
  navigationGroups,
  type PageDomain,
  type PageMode,
  type RouteMeta,
} from "@/lib/page-metadata";
import { cn } from "@/lib/utils";

const WORKSPACES = [
  { to: COMMAND_HOME, label: "Command", icon: Activity, context: COMMAND_CONTEXT },
  { to: PLAN_HOME, label: "Plan & Sales", icon: LineChart, context: PLAN_SALES_CONTEXT },
  { to: ENGINEERING_HOME, label: "Product & Engineering", icon: DraftingCompass, context: ENGINEERING_CONTEXT },
  { to: OPERATIONS_HOME, label: "Operations", icon: Factory, context: OPERATIONS_CONTEXT },
  { to: PEOPLE_HOME, label: "People & Office", icon: UsersRound, context: PEOPLE_CONTEXT },
  { to: FINANCE_HOME, label: "Finance & Governance", icon: Wallet, context: FINANCE_GOVERNANCE_CONTEXT },
  { to: ADMIN_HOME, label: "Admin", icon: Settings2, context: ADMIN_CONTEXT, adminOnly: true },
] as const;

const WORKSPACE_ROUTES = new Set<string>(WORKSPACES.map((item) => item.to));
const TAB_ROUTES = new Set<string>([
  ...PLAN_SALES_TABS.map((item) => item.to),
  ...ENGINEERING_TABS.map((item) => item.to),
  ...OPERATIONS_TABS.map((item) => item.to),
  ...FINANCE_GOVERNANCE_TABS.map((item) => item.to),
  ...ADMIN_TABS.map((item) => item.to),
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
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg">Operating workspaces</span>
          <span className="ml-auto text-[9px] text-muted">7 owners</span>
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
        </div>

        <div className="mt-2 border-t border-border pt-2">
          <p className="px-3 pb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-subtle">Command tools</p>
          {COMMAND_SHORTCUTS.filter((item) => isAccessible(role, item.to)).map((item) => (
            <ClientLink
              key={item.to}
              to={item.to}
              onNavigate={onNavigate}
              active={pathname === item.to}
              className="ml-5 block rounded-md px-2 py-1.5 text-xs text-subtle hover:bg-bg hover:text-fg aria-[current=page]:text-accent"
            >
              {item.label}
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
    <nav className="mb-4 overflow-x-auto rounded-xl border border-border bg-surface/50 p-1 [scrollbar-width:thin]" aria-label={label}>
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

function WorkflowRail({ role }: { role: CommandRole | null }) {
  const { pathname } = useLocation();
  if (!WORKFLOW_VISIBLE_ROUTES.has(pathname)) return null;
  const active = activeWorkflowStage(pathname);
  const steps = WORKFLOW_STAGES.filter((step) => isAccessible(role, step.to));
  return (
    <nav aria-label="End-to-end operating workflow" className="mb-4 rounded-xl border border-border bg-surface/25 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-green">Operating flow</p>
        <p className="text-[10px] text-subtle">Follow the business object · write only in the owning workspace</p>
      </div>
      <div className="overflow-x-auto [scrollbar-width:thin]">
        <div className="flex min-w-max items-center gap-1 pb-1">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-1">
              {index ? <span className="px-1 text-subtle">→</span> : null}
              <ClientLink
                to={step.to}
                active={active === step.id}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-muted hover:bg-bg hover:text-fg",
                  active === step.id && "bg-accent/10 text-accent ring-1 ring-accent/25",
                )}
              >
                <span title={step.label}>{step.shortLabel}</span>
              </ClientLink>
            </div>
          ))}
        </div>
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
            <WorkflowRail role={role} />
            <WorkspaceTabs role={role} routes={PLAN_SALES_TABS} context={PLAN_SALES_CONTEXT} label="Plan and Sales workspace" />
            <WorkspaceTabs role={role} routes={ENGINEERING_TABS} context={ENGINEERING_CONTEXT} label="Product and Engineering workspace" />
            <WorkspaceTabs role={role} routes={OPERATIONS_TABS} context={OPERATIONS_CONTEXT} label="Operations workspace" />
            <WorkspaceTabs role={role} routes={FINANCE_GOVERNANCE_TABS} context={FINANCE_GOVERNANCE_CONTEXT} label="Finance and Governance workspace" />
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
