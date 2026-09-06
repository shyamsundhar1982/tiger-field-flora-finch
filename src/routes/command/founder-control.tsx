import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { founderActionSummary, FOUNDER_CONTROL_CHECKS, FOUNDER_CONTROL_LANES, FOUNDER_CONTROL_THRESHOLDS } from "@/lib/data/founder-control";
import { buildModelWithInputs, totals } from "@/lib/finance/model";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/founder-control")({ component: FounderControl });
const money = (n: number) => `₹${n.toFixed(1)}L`;

function FounderControl() {
  const scenario = useVeloxis((s) => s.scenario);
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const finance = useVeloxis((s) => s.finance);
  const rows = buildModelWithInputs(scenario, drawStandby, finance);
  const t = totals(rows);
  const trough = rows.reduce((min, row) => row.closingCash < min.closingCash ? row : min, rows[0]);
  const cashRisk = trough.closingCash < FOUNDER_CONTROL_THRESHOLDS.cashFloorLakh;
  const blocked = founderActionSummary.filter((a) => a.status === "blocked");
  const active = founderActionSummary.filter((a) => a.status === "active");

  return <div className="space-y-6">
    <header>
      <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">Phase I · Deep Control</p>
      <h1 className="mt-2 font-display text-4xl">Founder Control Upgrade</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">A tighter operating layer above the Founder Command Centre: guardrails, intervention lanes, action urgency and release rules. It surfaces risk; it never fabricates completion.</p>
    </header>

    <div className="grid gap-3 sm:grid-cols-4">
      <Kpi label="Cash trough" value={money(trough.closingCash)} hint={`M${trough.m}`} tone={cashRisk ? "danger" : "ok"} />
      <Kpi label="36M revenue" value={money(t.revenue)} hint="Current model" />
      <Kpi label="Blocked" value={`${blocked.length}`} hint="Needs intervention" tone={blocked.length ? "danger" : "ok"} />
      <Kpi label="Active" value={`${active.length}`} hint="Founder queue" tone="ok" />
    </div>

    <Panel title="Intervention rules" kicker="Founder guardrails">
      <div className="grid gap-3 md:grid-cols-2">{FOUNDER_CONTROL_CHECKS.map((check) => <Link key={check.id} to={check.route as never} className="rounded-lg border border-border bg-surface p-4 hover:border-accent"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-accent">{check.id}</span><span className={`text-[10px] uppercase tracking-wider ${check.severity === "critical" ? "text-danger" : "text-warn"}`}>{check.severity}</span></div><p className="mt-2 text-sm font-medium">{check.title}</p><p className="mt-1 text-xs text-muted">Source: {check.source}</p><p className="mt-2 text-xs text-fg">Action: {check.action}</p></Link>)}</div>
    </Panel>

    <Panel title="Operating lanes" kicker="Owner → rule → control">
      <div className="space-y-2">{FOUNDER_CONTROL_LANES.map((lane) => <div key={lane.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 md:flex-row md:items-center"><div className="md:w-44"><p className="text-sm font-medium">{lane.title}</p><p className="text-[10px] uppercase tracking-wider text-subtle">Owner: {lane.owner}</p></div><p className="flex-1 text-xs leading-5 text-muted">{lane.rule}</p><Link to={lane.route as never} className="text-xs text-accent">Open control →</Link></div>)}</div>
    </Panel>

    <Panel title="Action urgency" kicker="Derived from controlled queue">
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-[10px] uppercase tracking-wider text-subtle"><tr><th className="py-2 pr-3">ID</th><th className="py-2 pr-3">Urgency</th><th className="py-2 pr-3">Action</th><th className="py-2 pr-3">Owner</th><th className="py-2 pr-3">Status</th><th className="py-2">Control</th></tr></thead><tbody>{founderActionSummary.map((a) => <tr key={a.id} className="border-t border-border"><td className="py-3 pr-3 text-accent">{a.id}</td><td className="py-3 pr-3">{a.urgency}</td><td className="py-3 pr-3 font-medium">{a.title}</td><td className="py-3 pr-3 text-muted">{a.owner}</td><td className="py-3 pr-3">{a.status}</td><td className="py-3"><Link to={a.controlRoute as never} className="text-xs text-accent">Open →</Link></td></tr>)}</tbody></table></div>
    </Panel>

    <div className="rounded-lg border border-border bg-surface p-5"><p className="text-[10px] uppercase tracking-wider text-subtle">Control constants</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-muted">Management cash floor</p><p className="mt-1 text-lg font-semibold">{money(FOUNDER_CONTROL_THRESHOLDS.cashFloorLakh)}</p></div><div><p className="text-xs text-muted">Evidence freshness window</p><p className="mt-1 text-lg font-semibold">{FOUNDER_CONTROL_THRESHOLDS.evidenceFreshnessDays} days</p></div><div><p className="text-xs text-muted">Critical action horizon</p><p className="mt-1 text-lg font-semibold">{FOUNDER_CONTROL_THRESHOLDS.criticalActionDays} days</p></div></div><p className="mt-4 text-xs leading-5 text-muted">These are operating guardrails, not accounting or legal conclusions. Any change to the underlying financial, engineering or compliance source remains subject to its own control register.</p></div>
  </div>;
}
