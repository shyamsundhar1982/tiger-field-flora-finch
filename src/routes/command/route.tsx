import { createFileRoute, redirect } from "@tanstack/react-router";
import { CommandShell } from "@/components/command-shell";
import { IbpeCopilot } from "@/components/ibpe-copilot";
import { IbpeWorkspaceProjection } from "@/components/ibpe-workspace-projection";
import { ProtectedNavigationBridge } from "@/components/protected-navigation-bridge";
import { getCommandAccess, getCommandRole } from "@/lib/command-access";
import { canAccessRoute } from "@/lib/page-access";
import { getRouteMeta } from "@/lib/page-metadata";
import { useOperatingPlanSync } from "@/lib/operating-plan-sync";

function normalizeCommandPath(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

export const Route = createFileRoute("/command")({
  beforeLoad: async ({ location }) => {
    // Keep the production route guard on the scalar server-function contracts
    // that are already used throughout the application. A failed/undefined
    // composite payload must never be dereferenced at the routing boundary.
    const access = await getCommandAccess();
    if (!access) {
      throw redirect({
        to: "/login",
        search: { returnTo: location.pathname },
      });
    }

    const routePath = normalizeCommandPath(location.pathname);
    // Command Centre is the authenticated fail-safe landing page. Never redirect
    // /command to itself, even if role metadata is unavailable or inconsistent.
    if (routePath === "/command") return;

    const role = await getCommandRole();
    if (!canAccessRoute(role, routePath)) {
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
