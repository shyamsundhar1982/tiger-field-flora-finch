import { redirect, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/inventory")({
  beforeLoad: () => {
    throw redirect({ to: "/command/inventory" });
  },
});
