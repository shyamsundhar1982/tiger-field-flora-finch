import { createFileRoute, redirect } from "@tanstack/react-router";

/** Compatibility route: management intelligence is now surfaced in Command Centre. */
export const Route = createFileRoute("/command/management-intelligence")({
  beforeLoad: () => {
    throw redirect({ to: "/command" });
  },
  component: () => null,
});
