import { createFileRoute, redirect } from "@tanstack/react-router";

/** The former ledger index is retained only as a compatible deep link. */
export const Route = createFileRoute("/command/inventory-ledgers/")({
  beforeLoad: () => {
    throw redirect({ to: "/command/inventory" });
  },
});
