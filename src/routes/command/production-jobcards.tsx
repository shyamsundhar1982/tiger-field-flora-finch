import { createFileRoute, redirect } from "@tanstack/react-router";

/** Compatibility route: Production Job Cards are consolidated into the canonical Production workspace. */
export const Route = createFileRoute("/command/production-jobcards")({
  beforeLoad: () => {
    throw redirect({ to: "/command/production" });
  },
  component: () => null,
});
