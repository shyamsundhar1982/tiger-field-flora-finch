import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";

export const Route = createFileRoute("/command/control-tower")({ component: ControlTower });

const GATES = [
  ["01", "Engineering baseline", "VEDM-301 Rev 5.3.8", "/command/engineering"],
  ["02", "Commercial / finance", "36-month model + funding ladder", "/command/financial-cockpit"],
  ["03", "Supplier + tooling", "Qualification, ownership and pilot readiness", "/command/manufacturing"],
  ["04", "Quality + validation", "NDT, dimensional, structural and ISO evidence", "/command/quality"],
  ["05", "EPR closure", "Evidence, deviations and release decision", "/command/phase-6a"],
] as const;

function ControlTower() {
  return <div className="space-y-6">
    <header className="rounded-2xl border border-border bg-bg-elevated/70 p-6">
      <p className="text-[11px] uppercase tracking-[0.22em] text-green">VINDY · Vāyú Shastr · Executive overview</p>
      <h1 className="mt-2 font-display text-4xl text-accent">Control Tower</h1>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">The cross-functional command screen: see what is blocking engineering, money, manufacturing, quality and release before moving the next gate.</p>
    </header>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi label="Current identity" value="VINDY" hint="VéLOXIS retired" />
      <Kpi label="Engineering authority" value="VEDM-301" hint="Rev 5.3.8" />
      <Kpi label="Pilot stage" value="Phase 6" hint="EPR follows" />
      <Kpi label="Planning horizon" value="36M" hint="Financial control" />
    </div>
    <Panel title="Critical gate map" kicker="One view across the operating system"><div className="grid gap-3 md:grid-cols-5">{GATES.map(([n,title,detail,to])=><Link key={n} to={to as never} className="rounded-xl border border-border p-4 transition-colors hover:border-accent/50 hover:bg-surface"><p className="text-xs font-semibold text-accent">GATE {n}</p><p className="mt-2 text-sm font-semibold text-fg">{title}</p><p className="mt-2 text-xs leading-5 text-muted">{detail}</p><span className="mt-3 inline-block text-xs text-accent">Open control →</span></Link>)}</div></Panel>
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title="Red-line rules" kicker="Do not bypass"><ul className="space-y-2 text-sm leading-6 text-muted"><li>• No historical geometry as manufacturing release.</li><li>• No certification claim without test evidence.</li><li>• No supplier/tooling release without controlled records.</li><li>• No silent engineering or commercial deviation.</li></ul></Panel>
      <Panel title="Identity control" kicker="Brand migration"><p className="text-sm leading-6 text-muted">Customer-facing identity is <strong className="text-fg">VINDY</strong>. Vāyú Shastr Pvt Ltd remains the legal company. Legacy VéLOXIS references are retained only where needed for controlled historical traceability.</p></Panel>
      <Panel title="Next decision" kicker="Founder command"><p className="text-sm leading-6 text-muted">Use the dashboard links to move from status to evidence: Finance → Engineering → Manufacturing → Quality → EPR.</p><Link to="/command/founder-command" className="mt-3 inline-block text-sm text-accent">Founder Command →</Link></Panel>
    </div>
  </div>;
}
