import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Compatibility route. The canonical Finance overview is the Financial Cockpit;
 * this legacy drill-down now lands on detailed plan-vs-forecast-vs-actual control.
 */
export const Route = createFileRoute("/command/master-finance")({
  beforeLoad: () => {
    throw redirect({ to: "/command/finance-control" });
  },
  component: () => null,
});
