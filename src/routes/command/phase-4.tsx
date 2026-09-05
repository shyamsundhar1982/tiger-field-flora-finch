import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { useVeloxis } from "@/lib/store";
import { buildModelWithInputs, minCash } from "@/lib/finance/model";
import { lakh } from "@/lib/format";

export const Route = createFileRoute("/command/phase-4")({ component: Phase4 });

const GATES = [
  ["P4-01", "Commercial plan", "Product mix, launch timing, ASP, COGS and unit plan must come from the shared finance assumptions surface."],
  ["P4-02", "Demand / order book", "Capture leads, confirmed orders, deliveries and cancellations without overwriting the underlying plan."],
  ["P4-03", "Sales ramp", "Translate production availability into monthly sell-through and expose the first-sale and volume curve."],
  ["P4-04", "Revenue recognition", "Connect delivered/sold units to planned and actual revenue while future months remain plan-driven."],
  ["P4-05", "Receivables / collections", "Track AR and collection timing so revenue does not masquerade as cash."],
  ["P4-06", "Gross margin", "Revenue minus COGS must remain connected to BOM, supplier quotes, mix and ECR changes."],
  ["P4-07", "Working capital", "Inventory purchases, receivables and collections must flow into the accounting cash view."],
  ["P4-08", "Scenario handoff", "Base / Delayed / Stress changes must propagate to production, inventory, funding and cash rather than create parallel forecasts."],
  ["P4-09", "Phase 5 entry", "Commercial assumptions are accepted only when the downstream production, inventory and manufacturing implications are visible."],
];

function Phase4() {
  const scenario = useVeloxis((s) => s.scenario); const drawStandby = useVeloxis((s) => s.drawStandby); const finance = useVeloxis((s) => s.finance);
  const rows = buildModelWithInputs(scenario, drawStandby, finance); const units = rows.reduce((s,r)=>s+r.units,0); const revenue = rows.reduce((s,r)=>s+r.revenue,0); const gp = rows.reduce((s,r)=>s+r.grossProfit,0); const trough = minCash(rows);
  return <div className="space-y-6">
    <header className="rounded-2xl border border-border bg-bg-elevated/70 p-5"><p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Execution stage 04</p><h1 className="mt-1 font-display text-4xl text-accent">Phase 4 · Sales & Revenue Execution</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">The commercial control layer connecting demand to units, revenue, gross profit, receivables, collections and cash. Phase 4 does not create a second financial model.</p></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="36-mo units" value={String(units)} hint={`${scenario} scenario`} /><Kpi label="36-mo revenue" value={lakh(revenue)} /><Kpi label="Gross profit" value={lakh(gp)} hint={revenue ? `${((gp/revenue)*100).toFixed(1)}% blended margin` : "—"}/><Kpi label="Cash trough" value={lakh(trough.cash)} hint={`M${trough.m}`} tone={trough.cash<8?"danger":trough.cash<15?"warn":"ok"}/></div>
    <Panel title="Phase 4 gate register" kicker="Commercial control → Phase 5 readiness"><div className="overflow-hidden rounded-xl border border-border">{GATES.map(([id,title,detail])=><div key={id} className="grid gap-2 border-b border-border p-4 last:border-b-0 md:grid-cols-[90px_210px_1fr]"><span className="text-xs font-semibold text-accent">{id}</span><span className="text-sm font-medium text-fg">{title}</span><span className="text-sm leading-6 text-muted">{detail}</span></div>)}</div></Panel>
    <div className="grid gap-4 md:grid-cols-4"><Panel title="Sales engine" kicker="Detailed surface"><p className="text-sm leading-6 text-muted">Monthly sales ramp, units, revenue, COGS, gross profit and cash impact.</p><Link to="/command/sales" className="mt-3 inline-block text-sm text-accent">Open →</Link></Panel><Panel title="Assumptions" kicker="Single source"><p className="text-sm leading-6 text-muted">ASP, COGS, volume, mix, launch and funding assumptions remain centralized.</p><Link to="/command/finance-assumptions" className="mt-3 inline-block text-sm text-accent">Open →</Link></Panel><Panel title="Actuals" kicker="Plan vs reality"><p className="text-sm leading-6 text-muted">Actuals, variance and rolling forecast remain separate from the plan.</p><Link to="/command/actuals" className="mt-3 inline-block text-sm text-accent">Open →</Link></Panel><Panel title="Phase 5" kicker="Next gate"><p className="text-sm leading-6 text-muted">Commercial readiness hands off into engineering, tooling, quality and supplier controls.</p><Link to="/command/phase-5" className="mt-3 inline-block text-sm text-accent">Open →</Link></Panel></div>
    <Panel title="Commercial equation" kicker="No hidden forecast"><div className="grid gap-2 md:grid-cols-6">{[["01","Demand","Lead / order"],["02","Units","Production availability"],["03","ASP","Units × price"],["04","Gross profit","Revenue − COGS"],["05","AR","Uncollected sales"],["06","Cash","Collections + funding − uses"]].map(([n,t,d])=><div key={n} className="rounded-xl border border-border p-3"><span className="text-[10px] font-bold text-accent">{n}</span><p className="mt-1 text-sm font-semibold text-fg">{t}</p><p className="mt-1 text-xs text-muted">{d}</p></div>)}</div></Panel>
    <div className="flex flex-wrap gap-2"><Link to="/command/phase-5" className="rounded-lg border border-accent px-3 py-2 text-xs font-semibold text-accent">Phase 5 →</Link><Link to="/command/phase-6" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Phase 6 →</Link><Link to="/command/phase-6a" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Phase 6A EPR →</Link></div>
  </div>;
}
