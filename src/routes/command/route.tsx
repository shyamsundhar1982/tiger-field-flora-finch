import { createFileRoute, redirect } from "@tanstack/react-router";
import { CommandShell } from "@/components/command-shell";
import { getCommandAccess, getCommandRole } from "@/lib/command-access";
import { canAccessRoute } from "@/lib/page-access";

export const Route = createFileRoute("/command")({
  beforeLoad: async ({ location }) => {
    const access = await getCommandAccess();
    if (!access) {
      throw redirect({ to: "/command-login" });
    }
    const role = await getCommandRole();
    if (!canAccessRoute(role, location.pathname)) {
      throw redirect({ to: "/command" });
    }
  },
  component: CommandShell,
});
