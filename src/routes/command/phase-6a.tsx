import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";

export const Route = createFileRoute("/command/phase-6a")({ component: Phase6A });

const EPR = [
  ["EPR-01", "Engineering baseline", "VEDM-301 Rev 5.3.8 remains the controlled authority. No historical geometry enters pilot release."],
  ["EPR-02", "Pilot build execution", "Release build instructions, configuration, traveller, inspection points and traceability before each pilot unit proceeds."],
  ["EPR-03", "Evidence capture", "Capture dimensional, cosmetic, NDT, structural and documentation evidence against the controlled unit/configuration."],
  ["EPR-04", "Deviation / NCR", "Record every non-conformance or deviation, assign controlled disposition, and prevent silent acceptance of out-of-baseline work."],
  ["EPR-05", "Validation closure", "Close only with objective evidence. Development targets remain visibly marked as pending until physically validated."],
  ["EPR-06", "Release decision", "Go / hold decision is made from the evidence pack, with traceability preserved into design freeze and production release."],
];

const REGISTER = [
  ["VINDY-01", "VINDY identity", "Use VINDY as the controlled brand/product identity layer where designated; keep company identity as Vāyú Shastr Pvt Ltd."],
  ["VAYU-01", "Vāyú mark", "Use the Vāyú Shastr logo consistently in Phase 6A execution surfaces and controlled documents."],
  ["ENG-01", "Fork / front end", "Approximately 380 mm axle-to-crown is a development direction; fork offset and trail remain unvalidated."],
  ["ENG-02", "Tyre envelope", "35 mm is the controlled baseline/target. 700×40 remains a development target, not a validated claim."],
  ["ENG-03", "Bottom bracket", "T47i, 85.5 mm shell width is the corrected configuration; do not revert to the historical 68 mm value."],
];

function Phase6A() {
  return <div className="space-y-6">
    <header className="rounded-2xl border border-border bg-bg-elevated/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Vāyú Shastr · VINDY</p>
          <h1 className="mt-1 font-display text-4xl text-accent">Phase 6A · EPR Execution Control</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Clean execution layer for pilot production: execute, record evidence, control deviations, validate, and release only when the evidence pack is complete.</p>
        </div>
        <img src="/brand/vayu-logo.svg" alt="Vāyú Shastr" className="h-16 w-auto" />
      </div>
    </header>

    <Panel title="EPR execution register" kicker="Execute · Prove · Release">
      <div className="overflow-hidden rounded-xl border border-border">
        {EPR.map(([id, title, detail]) => <div key={id} className="grid gap-2 border-b border-border p-4 last:border-b-0 md:grid-cols-[90px_220px_1fr]">
          <span className="text-xs font-semibold tabular-nums text-accent">{id}</span>
          <span className="text-sm font-medium text-fg">{title}</span>
          <span className="text-sm leading-6 text-muted">{detail}</span>
        </div>)}
      </div>
    </Panel>

    <Panel title="VINDY · Vāyú controlled register" kicker="Identity + engineering corrections">
      <div className="overflow-hidden rounded-xl border border-border">
        {REGISTER.map(([id, title, detail]) => <div key={id} className="grid gap-2 border-b border-border p-4 last:border-b-0 md:grid-cols-[90px_190px_1fr]">
          <span className="text-xs font-semibold tabular-nums text-accent">{id}</span>
          <span className="text-sm font-medium text-fg">{title}</span>
          <span className="text-sm leading-6 text-muted">{detail}</span>
        </div>)}
      </div>
    </Panel>

    <div className="grid gap-4 md:grid-cols-3">
      <Panel title="INPUT" kicker="Controlled only"><p className="text-sm leading-6 text-muted">Latest approved drawings, BOM/configuration, process instructions, inspection criteria and applicable test requirements.</p></Panel>
      <Panel title="EVIDENCE" kicker="No evidence · no release"><p className="text-sm leading-6 text-muted">Attach objective records to the pilot unit/configuration. Planned, in-progress, blocked and passed states stay distinct.</p></Panel>
      <Panel title="OUTPUT" kicker="Controlled disposition"><p className="text-sm leading-6 text-muted">Released, held, reworked or rejected with a traceable decision. No unsupported validation or certification claims.</p></Panel>
    </div>

    <Panel title="Phase 6A gate" kicker="Pilot → validated configuration">
      <div className="rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm leading-6 text-muted"><strong className="text-fg">Release rule:</strong> Phase 6A closes only when the controlled baseline, pilot evidence, deviations/NCRs and validation records are reconciled. Any open critical evidence item keeps the configuration on hold.</div>
    </Panel>
  </div>;
}
