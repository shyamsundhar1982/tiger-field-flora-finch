import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy compatibility route. Finance has one canonical operating surface at
 * /command/financial-cockpit; keeping a second Plan/Forecast/Cash model here
 * would reintroduce duplicate launch and cash-floor truth.
 */
export const Route = createFileRoute("/command/finance-control")({
  beforeLoad: () => {
    throw redirect({ to: "/command/financial-cockpit" });
  },
  component: () => null,
});
