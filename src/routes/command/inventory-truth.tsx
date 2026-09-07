import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy inventory read-model route. Master Inventory is the only ordinary
 * operational stock truth; keep this URL only as a compatibility redirect.
 */
export const Route = createFileRoute("/command/inventory-truth")({
  beforeLoad: () => {
    throw redirect({ to: "/command/inventory" });
  },
});
