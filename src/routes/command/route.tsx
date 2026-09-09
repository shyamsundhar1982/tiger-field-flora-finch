import { createFileRoute, redirect } from "@tanstack/react-router";
import { CommandShell } from "@/components/command-shell";
import { IbpeCopilot } from "@/components/ibpe-copilot";
import { IbpeWorkspaceProjection } from "@/components/ibpe-workspace-projection";
import { ProtectedNavigationBridge } from "@/components/protected-navigation-bridge";
import { getCommandAccess, getCommandRole } from "@/lib/command-access";
import { canAccessRoute } from "@/lib/page-access";
import { getRouteMeta } from "@/lib/page-metadata";
import { useOperatingPlanSync } from "@/lib/operating-plan-sync";

export const Route = createFileRoute("/command")({
  beforeLoad: async ({ location }) => {
    const access = await getCommandAccess();
    // Individual Better Auth identity is the canonical VYNDI login. Preserve
    // the requested workspace so a successful sign-in returns the user to the
    // page they actually selected rather than collapsing every flow to Command.
    if (!access) {
      throw redirect({
        to: "/login",
        search: { returnTo: location.pathname },
      });
    }
    const role = await getCommandRole();
    if (!canAccessRoute(role, location.pathname)) {
      const page = getRouteMeta(location.pathname);
      throw redirect({
        to: page?.adminOnly && page.domain === "inventory" ? "/command/inventory" : "/command",
      });
    }
  },
  component: CommandRoot,
});

function CommandRoot() {
  useOperatingPlanSync();
  return <><ProtectedNavigationBridge /><IbpeWorkspaceProjection /><CommandShell /><IbpeCopilot /></>;
}
