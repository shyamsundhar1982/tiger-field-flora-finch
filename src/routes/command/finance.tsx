import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Compatibility route. The Financial Cockpit is the canonical Finance overview;
 * this preserves old bookmarks without maintaining a second dashboard.
 */
export const Route = createFileRoute("/command/finance")({
  beforeLoad: () => {
    throw redirect({ to: "/command/financial-cockpit" });
  },
  component: () => null,
});
