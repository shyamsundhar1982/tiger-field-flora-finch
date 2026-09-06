import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/command/component-control")({
  beforeLoad: () => {
    throw redirect({ to: "/inventory" });
  },
});
