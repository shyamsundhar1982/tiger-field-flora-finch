import { createFileRoute, redirect } from "@tanstack/react-router";

/** Compatibility route: legacy Ops is consolidated into canonical Supply & Production. */
export const Route = createFileRoute("/command/ops")({
  beforeLoad: () => {
    throw redirect({ to: "/command/operations" });
  },
  component: () => null,
});
