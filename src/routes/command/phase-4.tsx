import { createFileRoute, redirect } from "@tanstack/react-router";

/** Compatibility route: Phase 4 is consolidated into the Commercial workspace. */
export const Route = createFileRoute("/command/phase-4")({
  beforeLoad: () => {
    throw redirect({ to: "/command/sales" });
  },
  component: () => null,
});
