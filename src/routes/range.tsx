import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/range")({
  component: RangeLayout,
});

function RangeLayout() {
  // Layout owns /range; the index and tier routes render inside this outlet.
  return <Outlet />;
}
