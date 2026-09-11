import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/story/")({
  component: StoryIndex,
});

const LINKS: { to: string; label: string; blurb: string }[] = [
  { to: "/command/investor-pitch", label: "Investor pitch", blurb: "Demo narrative for external review" },
  { to: "/command/stakeholder-portal", label: "Business story", blurb: "Stakeholder-facing overview" },
  { to: "/command/founder-command", label: "Founder command", blurb: "Leadership decision surface" },
  { to: "/command/knowledge", label: "Knowledge base", blurb: "Reference material" },
  { to: "/command/technical", label: "Technical", blurb: "Engineering reference" },
  { to: "/command/design-philosophy", label: "Design philosophy", blurb: "Product principles" },
  { to: "/command/platform-walkthrough", label: "Platform walkthrough", blurb: "Product tour" },
  { to: "/command/deployment-readiness", label: "Deployment readiness", blurb: "Go-live checklist" },
  { to: "/command/funding", label: "Funding", blurb: "Funding narrative" },
];

function StoryIndex() {
  return (
    <main className="space-y-6">
      <header className="border-b border-border pb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-green">Story</p>
        <h1 className="mt-2 font-display text-4xl text-accent">Investor & reference</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Narrative and reference material lives here so the Command operator sidebar stays
          transactional. Same theme tokens as the operating system; different audience and cadence.
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {LINKS.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to as never}
              className="block rounded-xl border border-border bg-surface/35 p-4 transition-colors hover:border-accent/40"
            >
              <p className="font-display text-lg text-accent">{item.label}</p>
              <p className="mt-1 text-xs text-muted">{item.blurb}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
