import { createFileRoute, redirect } from "@tanstack/react-router";
import { CommandShell } from "@/components/command-shell";
import { ControlledDocumentToolbar } from "@/components/controlled-document-toolbar";
import { IbpeCopilot } from "@/components/ibpe-copilot";
import { IbpeWorkspaceProjection } from "@/components/ibpe-workspace-projection";
import { ProtectedNavigationBridge } from "@/components/protected-navigation-bridge";
import { TraceabilityDocumentCentreV2 } from "@/components/traceability-document-centre-v2";
import { getCommandRole } from "@/lib/command-access";
import { canAccessRoute } from "@/lib/page-access";
import { getRouteMeta } from "@/lib/page-metadata";
import { useOperatingPlanSync } from "@/lib/operating-plan-sync";

function normalizeCommandPath(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

export const Route = createFileRoute("/command")({
  beforeLoad: async ({ location }) => {
    // One scalar role lookup proves both authenticated Command access and RBAC.
    // This avoids resolving the same Better Auth identity + persisted role two
    // or three times during every protected navigation.
    const role = await getCommandRole();
    if (!role) {
      throw redirect({
        to: "/login",
        search: { returnTo: location.pathname },
      });
    }

    const routePath = normalizeCommandPath(location.pathname);
    if (routePath !== "/command" && !canAccessRoute(role, routePath)) {
      const page = getRouteMeta(routePath);
      const preferredTarget =
        page?.adminOnly && page.domain === "inventory" ? "/command/inventory" : "/command";
      throw redirect({
        to: normalizeCommandPath(preferredTarget) === routePath ? "/command" : preferredTarget,
      });
    }

    return { commandRole: role };
  },
  component: CommandRoot,
});

function CommandRoot() {
  const { commandRole } = Route.useRouteContext();
  useOperatingPlanSync();
  return <><ProtectedNavigationBridge /><IbpeWorkspaceProjection /><CommandShell initialRole={commandRole} /><ControlledDocumentToolbar /><TraceabilityDocumentCentreV2 /><IbpeCopilot /></>;
}
