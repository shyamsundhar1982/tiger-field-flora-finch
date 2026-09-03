import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/range")({
  component: RangeLayout,
});

function RangeLayout() {
  return <Outlet />;
}
