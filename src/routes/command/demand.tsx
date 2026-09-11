import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Compatibility route for historical Demand links.
 * Commercial demand and order truth is canonical at /command/sales; keep one
 * source of truth and redirect before rendering so stale links do not flash and
 * disappear after client hydration.
 */
export const Route = createFileRoute("/command/demand")({
  beforeLoad: () => {
    throw redirect({ to: "/command/sales", replace: true });
  },
});
