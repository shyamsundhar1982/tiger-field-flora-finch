import { createFileRoute, redirect } from "@tanstack/react-router";
import { CommandShell } from "@/components/command-shell";
import { IbpeWorkspaceProjection } from "@/components/ibpe-workspace-projection";
import { getCommandAccess, getCommandRole } from "@/lib/command-access";
import { canAccessRoute } from "@/lib/page-access";
import { getRouteMeta } from "@/lib/page-metadata";
import { useOperatingPlanSync } from "@/lib/operating-plan-sync";

export const Route = createFileRoute("/command")({
  beforeLoad: async ({ location }) => {
    const access = await getCommandAccess();
    if (!access) throw redirect({ to: "/command-login" });
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
  return <><IbpeWorkspaceProjection /><CommandShell /></>;
}
