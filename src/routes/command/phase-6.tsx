import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";

export const Route = createFileRoute("/command/phase-6")({ component: Phase6 });

const GATES = [
  ["P6-01", "Controlled engineering baseline", "VEDM-301 Rev 5.3.8 remains the authority. Historical geometry is not manufacturing release."],
  ["P6-02", "Fork / front-end correction", "Development direction is approximately 380 mm axle-to-crown; fork offset and trail remain unvalidated until physical validation."],
  ["P6-03", "Tyre envelope", "35 mm is the controlled baseline/target. 700×40 remains a development target and must not be labelled validated."],
  ["P6-04", "T47i interface", "Use the corrected 85.5 mm shell-width configuration in controlled records; do not revert to the historical 68 mm value."],
  ["P6-05", "Pilot release gate", "Pilot units release only after dimensional, cosmetic, NDT, structural and documentation gates pass; deviations require controlled disposition."],
];

function Phase6() {
  return <div className="space-y-6">
    <header className="rounded-2xl border border-border bg-bg-elevated/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Vāyú Shastr · VéLOXIS</p>
          <h1 className="mt-1 font-display text-4xl text-accent">Phase 6 · Pilot Production Control</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Controlled transition from Phase 5 tooling into pilot production. This phase keeps the corrected VéLOXIS engineering baseline visible and prevents development values from being presented as validated production facts.</p>
        </div>
        <img src="/brand/vayu-logo.svg" alt="Vāyú Shastr" className="h-16 w-auto text-accent" />
      </div>
    </header>

    <Panel title="VéLOXIS correction register" kicker="Controlled configuration">
      <div className="overflow-hidden rounded-xl border border-border">
        {GATES.map(([id, title, detail]) => <div key={id} className="grid gap-2 border-b border-border p-4 last:border-b-0 md:grid-cols-[90px_240px_1fr]">
          <span className="text-xs font-semibold tabular-nums text-accent">{id}</span>
          <span className="text-sm font-medium text-fg">{title}</span>
          <span className="text-sm leading-6 text-muted">{detail}</span>
        </div>)}
      </div>
    </Panel>

    <div className="grid gap-4 md:grid-cols-3">
      <Panel title="Authority" kicker="Do not supersede"><p className="text-sm leading-6 text-muted"><strong className="text-fg">VEDM-301 Rev 5.3.8</strong> is the current controlled engineering authority. Older geometry remains historical/superseded.</p></Panel>
      <Panel title="Status discipline" kicker="Evidence first"><p className="text-sm leading-6 text-muted">No supplier qualification, tooling, pilot production, testing or validation status is marked released without the corresponding evidence.</p></Panel>
      <Panel title="Pilot objective" kicker="Phase 6"><p className="text-sm leading-6 text-muted">Build controlled pilot evidence, close dimensional and quality gates, and preserve traceability into final release.</p></Panel>
    </div>
  </div>;
}
