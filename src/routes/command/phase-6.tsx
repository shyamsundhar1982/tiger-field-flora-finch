import { createFileRoute, redirect } from "@tanstack/react-router";

/** Compatibility route: Phase 6 is consolidated into Supply & Production. */
export const Route = createFileRoute("/command/phase-6")({
  beforeLoad: () => {
    throw redirect({ to: "/command/operations" });
  },
  component: () => null,
});
