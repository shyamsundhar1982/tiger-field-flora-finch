import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { buildModel, totals } from "@/lib/finance/model";

export const Route = createFileRoute("/command/management-intelligence")({ component: ManagementIntelligence });
const money=(n:number)=>`₹${n.toFixed(1)}L`;

function ManagementIntelligence(){
  const rows=buildModel("base",false); const t=totals(rows); const m12=rows[11]; const m24=rows[23]; const m36=rows[35];
  return <div className="space-y-6">
    <header><p className="text-[11px] uppercase tracking-[0.22em] text-green">VINDY · Management layer</p><h1 className="mt-1 font-display text-4xl text-accent">Management Intelligence</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">Decision intelligence connecting sales, production, inventory, funding, cash and engineering readiness. Management-model figures remain assumptions until evidence is reconciled.</p></header>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Kpi label="M12 revenue" value={money(m12.revenue)} hint="Base model"/><Kpi label="M24 revenue" value={money(m24.revenue)} hint="Cumulative view"/><Kpi label="M36 revenue" value={money(t.revenue)} hint="Cumulative"/><Kpi label="M36 EBITDA" value={money(t.ebitda)} hint="Management model"/><Kpi label="M36 cash" value={money(m36.closing)} hint="Closing cash"/></div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Executive signals" kicker="What management should watch"><div className="grid gap-3 sm:grid-cols-2">{[["Cash safety","Funding timing + inventory buys must preserve the minimum cash buffer."],["Gross margin","BOM, yield, freight, paint, assembly and warranty must be validated."],["Working capital","Inventory and receivables can consume cash ahead of revenue."],["Engineering readiness","Pilot and launch timing depend on evidence, not calendar intent."]].map(([a,b])=><div key={a} className="rounded-xl border border-border p-4"><p className="text-sm font-semibold text-accent">{a}</p><p className="mt-2 text-xs leading-5 text-muted">{b}</p></div>)}</div></Panel>
      <Panel title="Scenario discipline" kicker="Base · Delayed · Stress"><div className="space-y-3 text-sm text-muted"><p><strong className="text-fg">Base:</strong> grants on time, prototype succeeds first pass, launch around M12.</p><p><strong className="text-fg">Delayed:</strong> engineering / funding slips and cash requirement increases.</p><p><strong className="text-fg">Stress:</strong> slower ramp, higher working capital and additional funding pressure.</p><Link to="/command/scenarios" className="inline-block text-sm text-accent">Open scenario control →</Link></div></Panel>
    </div>
    <Panel title="Management operating chain" kicker="Revenue → production → inventory → cash → funding"><div className="grid gap-3 md:grid-cols-6">{[["01","Demand","/command/sales"],["02","Production","/command/production"],["03","Inventory","/command/inventory"],["04","Cash","/command/cash"],["05","Funding","/command/funding"],["06","Break-even","/command/financial-cockpit"]].map(([n,label,to])=><Link key={n} to={to as never} className="rounded-lg border border-border p-3 hover:border-accent/50"><p className="text-xs text-accent">{n}</p><p className="mt-2 text-sm font-medium">{label}</p></Link>)}</div></Panel>
  </div>;
}
