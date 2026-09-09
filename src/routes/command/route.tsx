import { createFileRoute, redirect } from "@tanstack/react-router";
import { CommandShell } from "@/components/command-shell";
import { IbpeCopilot } from "@/components/ibpe-copilot";
import { IbpeWorkspaceProjection } from "@/components/ibpe-workspace-projection";
import { ProtectedNavigationBridge } from "@/components/protected-navigation-bridge";
import { getCommandAuthorization } from "@/lib/command-access";
import { canAccessRoute } from "@/lib/page-access";
import { getRouteMeta } from "@/lib/page-metadata";
import { useOperatingPlanSync } from "@/lib/operating-plan-sync";

function normalizeCommandPath(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

export const Route = createFileRoute("/command")({
  beforeLoad: async ({ location }) => {
    const authorization = await getCommandAuthorization();
    // Individual Better Auth identity is the canonical VYNDI login. Preserve
    // the requested workspace so a successful sign-in returns the user to the
    // page they actually selected rather than collapsing every flow to Command.
    if (!authorization.access) {
      throw redirect({
        to: "/login",
        search: { returnTo: location.pathname },
      });
    }

    const routePath = normalizeCommandPath(location.pathname);
    // Command Centre is the authenticated fail-safe landing page for every
    // valid Command identity. Never send /command back to itself because a
    // transient role/metadata disagreement would otherwise create an infinite
    // redirect loop instead of rendering a recoverable landing page.
    if (routePath === "/command") return;

    if (!canAccessRoute(authorization.role, routePath)) {
      const page = getRouteMeta(routePath);
      const preferredTarget =
        page?.adminOnly && page.domain === "inventory" ? "/command/inventory" : "/command";
      throw redirect({
        to: normalizeCommandPath(preferredTarget) === routePath ? "/command" : preferredTarget,
      });
    }
  },
  component: CommandRoot,
});

function CommandRoot() {
  useOperatingPlanSync();
  return <><ProtectedNavigationBridge /><IbpeWorkspaceProjection /><CommandShell /><IbpeCopilot /></>;
}
