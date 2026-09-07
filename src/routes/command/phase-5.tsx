import { createFileRoute, redirect } from "@tanstack/react-router";

/** Compatibility route: Phase 5 is consolidated into the Engineering workspace. */
export const Route = createFileRoute("/command/phase-5")({
  beforeLoad: () => {
    throw redirect({ to: "/command/engineering" });
  },
  component: () => null,
});
