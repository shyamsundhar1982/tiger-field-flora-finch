import { createFileRoute, redirect } from "@tanstack/react-router";
import { CommandShell } from "@/components/command-shell";
import { ControlledDocumentToolbar } from "@/components/controlled-document-toolbar";
import { IbpeCopilot } from "@/components/ibpe-copilot";
import { IbpeWorkspaceProjection } from "@/components/ibpe-workspace-projection";
import { ProtectedNavigationBridge } from "@/components/protected-navigation-bridge";
import { TraceabilityDocumentCentre } from "@/components/traceability-document-centre";
import { VibpeRuntimeObserver } from "@/components/vibpe-runtime-observer";
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
    const access = await getCommandAccess();
    if (!access) {
      throw redirect({
        to: "/login",
        search: { returnTo: location.pathname },
      });
    }

    const routePath = normalizeCommandPath(location.pathname);
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
  return <><ProtectedNavigationBridge /><VibpeRuntimeObserver /><IbpeWorkspaceProjection /><CommandShell /><ControlledDocumentToolbar /><TraceabilityDocumentCentre /><IbpeCopilot /></>;
}
