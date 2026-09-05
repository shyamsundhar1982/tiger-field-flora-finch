import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";

export const Route = createFileRoute("/command/phase-5")({ component: Phase5 });

const GATES = [
  ["P5-01", "Engineering baseline", "Use VEDM-301 Rev 5.3.8 as the controlled engineering authority; reconcile geometry, interfaces, drawings and revision status before tooling release."],
  ["P5-02", "ECR / change control", "Every geometry, material, layup, tooling, process or supplier change requires controlled engineering review and revalidation impact assessment."],
  ["P5-03", "CAD / FEA closure", "Close CAD definition and structural viability evidence before design freeze; FEA and laminate adequacy remain evidence gates."],
  ["P5-04", "Supplier qualification", "Controlled RFQ, NDA/disclosure control, capability audit, quality system review, subcontractor review and qualification decision precede pilot PO."],
  ["P5-05", "Tooling ownership & acceptance", "Record buyer ownership, custody, maintenance, retrieval and non-use obligations; accept moulds/jigs only against controlled tooling drawings."],
  ["P5-06", "Pilot quality system", "Establish material traceability, layup/cure records, critical-dimension capability, NDT, cosmetic inspection, serial genealogy and NCR/CAPA."],
  ["P5-07", "ISO 4210 path", "Maintain lab/test planning and evidence. No certification or validation claim is released until the applicable test evidence exists."],
  ["P5-08", "Phase 6 entry gate", "Phase 5 is complete only when engineering baseline, supplier/tooling controls and pilot-quality prerequisites are ready for controlled production."],
];

function Phase5() {
  return <div className="space-y-6">
    <header className="rounded-2xl border border-border bg-bg-elevated/70 p-5">
      <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Recovered execution stage</p>
      <h1 className="mt-1 font-display text-4xl text-accent">Phase 5 · Engineering, Tooling & Quality Gate</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Restored as the prerequisite layer between Phase 4 commercial readiness and Phase 6 pilot production. Existing Engineering, Manufacturing and Quality workspaces remain the detailed control surfaces.</p>
    </header>
    <Panel title="Phase 5 prerequisite register" kicker="Do not skip the gate">
      <div className="overflow-hidden rounded-xl border border-border">{GATES.map(([id,title,detail])=><div key={id} className="grid gap-2 border-b border-border p-4 last:border-b-0 md:grid-cols-[90px_230px_1fr]"><span className="text-xs font-semibold text-accent">{id}</span><span className="text-sm font-medium text-fg">{title}</span><span className="text-sm leading-6 text-muted">{detail}</span></div>)}</div>
    </Panel>
    <div className="grid gap-4 md:grid-cols-3">
      <Panel title="Engineering" kicker="Revision control"><p className="text-sm leading-6 text-muted">ECR impact is connected to BOM/COGS, weight, production and inventory effects. Approval must precede release.</p><Link to="/command/engineering" className="mt-3 inline-block text-sm text-accent">Open Engineering Control →</Link></Panel>
      <Panel title="Manufacturing" kicker="Supplier + tooling"><p className="text-sm leading-6 text-muted">Supplier qualification, tooling ownership/acceptance, pilot build, traceability and release controls are already represented in the manufacturing register.</p><Link to="/command/manufacturing" className="mt-3 inline-block text-sm text-accent">Open Manufacturing Controls →</Link></Panel>
      <Panel title="Quality" kicker="Inspection + CAPA"><p className="text-sm leading-6 text-muted">Incoming, in-process and final inspection, NCR/CAPA, warranty and failure-analysis traceability remain evidence-controlled.</p><Link to="/command/quality" className="mt-3 inline-block text-sm text-accent">Open Quality Control →</Link></Panel>
    </div>
    <Panel title="Engineering correction register" kicker="Reconciled, not silently overwritten"><div className="grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-border p-4"><p className="text-xs uppercase tracking-[0.14em] text-subtle">Fork / front end</p><p className="mt-2 text-sm leading-6 text-muted">Historical 370 mm A-C is superseded for the current development direction. Approximately 380 mm is the working direction; the ~378 mm value in the execution package is treated as an indicated minimum, not a locked production dimension. Fork offset and trail remain unvalidated.</p></div><div className="rounded-xl border border-border p-4"><p className="text-xs uppercase tracking-[0.14em] text-subtle">Tyre / BB</p><p className="mt-2 text-sm leading-6 text-muted">35 mm is the controlled baseline/target; 700×40 is a development target pending physical/CAD verification. T47i shell width is 85.5 mm; the historical 68 mm value is not the current configuration.</p></div><div className="rounded-xl border border-border p-4"><p className="text-xs uppercase tracking-[0.14em] text-subtle">Carbon</p><p className="mt-2 text-sm leading-6 text-muted">T700/T800 mixed carbon is the planned platform; 2.5 mm is a working wall-thickness baseline pending laminate/FEA confirmation. Medium painted frame target remains 850–950 g.</p></div><div className="rounded-xl border border-border p-4"><p className="text-xs uppercase tracking-[0.14em] text-subtle">Design language</p><p className="mt-2 text-sm leading-6 text-muted">VAEA / VEDM-503 working architecture: DT 3.5:1 truncated Kammtail/KVF, TT 3.2:1 flattened aero ellipse with VTS™ intent, ST 3.0:1 KVF, plus controlled junction/interface definitions.</p></div></div></Panel>
  </div>;
}
