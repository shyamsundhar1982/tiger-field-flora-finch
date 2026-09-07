import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/command/inventory-ledgers")({
  component: Outlet,
});
