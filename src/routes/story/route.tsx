import { createFileRoute, redirect } from "@tanstack/react-router";
import { StoryShell } from "@/components/story-shell";
import { getCommandAccess } from "@/lib/command-access";

export const Route = createFileRoute("/story")({
  beforeLoad: async ({ location }) => {
    const access = await getCommandAccess();
    if (!access) {
      throw redirect({
        to: "/login",
        search: { returnTo: location.pathname },
      });
    }
  },
  component: StoryRoot,
});

function StoryRoot() {
  return <StoryShell />;
}
