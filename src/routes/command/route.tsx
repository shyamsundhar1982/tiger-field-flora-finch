import { createFileRoute, redirect } from "@tanstack/react-router";
import { CommandShell } from "@/components/command-shell";
import { getCommandAccess } from "@/lib/command-access";

export const Route = createFileRoute("/command")({
  beforeLoad: async () => {
    const access = await getCommandAccess();
    if (!access) {
      throw redirect({ to: "/command-login" });
    }
  },
  component: CommandShell,
});
