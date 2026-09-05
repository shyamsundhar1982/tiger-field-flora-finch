import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";

export const Route = createFileRoute("/command/phase-4")({ component: Phase4 });

const GATES = [
  ["P4-01", "Plan → demand", "Freeze the commercial planning basis: product mix, launch timing, ASP and unit plan. Changes flow through the shared finance model."],
  ["P4-02", "Orders", "Capture lead, confirmed, delivered and cancelled demand without overwriting the financial plan."],
  ["P4-03", "Revenue", "Connect delivery/sale events to planned and actual revenue while keeping future months plan-driven."],
  ["P4-04", "Receivables", "Track uncollected revenue and collection timing using the accounting assumptions."],
  ["P4-05", "Cash connection", "Connect collections to the accounting cash view and expose the working-capital effect."],
  ["P4-06", "Commercial handoff", "Pass validated demand, mix and pricing assumptions into production, inventory and Phase 5 controls."],
];

function Phase4() {
  return <div className="space-y-6">
    <header className="rounded-2xl border border-border bg-bg-elevated/70 p-5">
      <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Recovered execution stage</p>
      <h1 className="mt-1 font-display text-4xl text-accent">Phase 4 · Sales & Revenue Execution</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Restored from the earlier Phase 4 implementation: the commercial chain connecting plan, orders, revenue, receivables, collections and cash. The existing Sales & Revenue Engine remains the working transaction surface.</p>
    </header>
    <Panel title="Phase 4 gate register" kicker="Commercial control">
      <div className="overflow-hidden rounded-xl border border-border">{GATES.map(([id,title,detail])=><div key={id} className="grid gap-2 border-b border-border p-4 last:border-b-0 md:grid-cols-[90px_210px_1fr]"><span className="text-xs font-semibold text-accent">{id}</span><span className="text-sm font-medium text-fg">{title}</span><span className="text-sm leading-6 text-muted">{detail}</span></div>)}</div>
    </Panel>
    <div className="grid gap-4 md:grid-cols-3">
      <Panel title="Commercial surface" kicker="Recovered"><p className="text-sm leading-6 text-muted">The existing Sales & Revenue Engine contains the 36-month plan, order book, actuals, collections and AR view.</p><Link to="/command/sales" className="mt-3 inline-block text-sm text-accent">Open Sales & Revenue Engine →</Link></Panel>
      <Panel title="Finance handoff" kicker="Shared assumptions"><p className="text-sm leading-6 text-muted">Pricing and mix remain in the single Plan & Assumptions surface; commercial changes must not create duplicate financial assumptions.</p><Link to="/command/finance-assumptions" className="mt-3 inline-block text-sm text-accent">Open Plan & Assumptions →</Link></Panel>
      <Panel title="Downstream handoff" kicker="Phase 5 prerequisite"><p className="text-sm leading-6 text-muted">Production volume, inventory cash and manufacturing readiness must reconcile before pilot tooling or production commitments.</p><Link to="/command/production" className="mt-3 inline-block text-sm text-accent">Open Production Planning →</Link></Panel>
    </div>
  </div>;
}
