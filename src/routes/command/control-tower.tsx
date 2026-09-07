import { createFileRoute, redirect } from "@tanstack/react-router";

/** Compatibility route: the executive Control Tower is consolidated into Command Centre. */
export const Route = createFileRoute("/command/control-tower")({
  beforeLoad: () => {
    throw redirect({ to: "/command" });
  },
  component: () => null,
});
