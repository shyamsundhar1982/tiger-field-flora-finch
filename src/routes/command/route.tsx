import { createFileRoute, redirect } from "@tanstack/react-router";
import { CommandShell } from "@/components/command-shell";
import { IbpeCopilot } from "@/components/ibpe-copilot";
import { IbpeWorkspaceProjection } from "@/components/ibpe-workspace-projection";
import { getCommandAccess, getCommandRole } from "@/lib/command-access";
import { canAccessRoute } from "@/lib/page-access";
import { getRouteMeta } from "@/lib/page-metadata";
import { useOperatingPlanSync } from "@/lib/operating-plan-sync";

export const Route = createFileRoute("/command")({
  beforeLoad: async ({ location }) => {
    const access = await getCommandAccess();
    // Individual Better Auth identity is the canonical VYNDI login. The legacy
    // Command-password gate remains available only as an explicit compatibility
    // path at /command-login and must not be the default redirect.
    if (!access) throw redirect({ to: "/login" });
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
  return <><IbpeWorkspaceProjection /><CommandShell /><IbpeCopilot /></>;
}
