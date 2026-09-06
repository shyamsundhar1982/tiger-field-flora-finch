import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Compatibility route. Financial Cockpit is the single consolidated portfolio
 * financial view; keeping this route prevents stale bookmarks from breaking.
 */
export const Route = createFileRoute("/command/master-finance")({
  beforeLoad: () => {
    throw redirect({ to: "/command/financial-cockpit" });
  },
  component: () => null,
});
