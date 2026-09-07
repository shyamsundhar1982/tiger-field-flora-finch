import { createFileRoute, redirect } from "@tanstack/react-router";

/** Compatibility route: Phase 6A is consolidated into EPR Execution. */
export const Route = createFileRoute("/command/phase-6a")({
  beforeLoad: () => {
    throw redirect({ to: "/command/epr-execution" });
  },
  component: () => null,
});
