import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";

const INVESTOR_PITCH_URL = "https://business-review-anal-pcay.bolt.host/";

export const Route = createFileRoute("/command/investor-pitch-external")({
  component: InvestorPitchExternal,
});

function InvestorPitchExternal() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">
          Investor relations · External pitch
        </p>
        <h1 className="mt-1 font-display text-4xl">Investor Pitch</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          The dedicated investor presentation is hosted at the approved pitch
          destination below. This route keeps the pitch accessible from the
          repository application without duplicating or altering its source.
        </p>
      </header>

      <Panel
        title="Investor presentation"
        kicker="External presentation · opens independently if embedding is restricted"
      >
        <div className="flex flex-wrap gap-3">
          <a
            href={INVESTOR_PITCH_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-md border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10"
          >
            Open investor pitch ↗
          </a>
          <Link
            to="/command/investor-pitch"
            className="inline-flex rounded-md border border-border px-4 py-2 text-sm text-muted hover:bg-surface hover:text-fg"
          >
            Back to investor controls
          </Link>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-bg">
          <iframe
            title="Investor pitch"
            src={INVESTOR_PITCH_URL}
            className="h-[78vh] min-h-[640px] w-full border-0"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>

        <p className="mt-3 text-xs text-muted">
          If the host prevents iframe embedding, use “Open investor pitch ↗”
          above. The external presentation remains the source of truth for
          this pitch.
        </p>
      </Panel>
    </div>
  );
}
