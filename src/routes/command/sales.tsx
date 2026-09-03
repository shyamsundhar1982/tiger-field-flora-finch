import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { buildModelWithInputs, minCash, type ScenarioId } from "@/lib/finance/model";
import { lakh } from "@/lib/format";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/sales")({ component: SalesPlanning });

function SalesPlanning() {
  const scenario = useVeloxis((s) => s.scenario) as ScenarioId;
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const finance = useVeloxis((s) => s.finance);
  const rows = useMemo(() => buildModelWithInputs(scenario, drawStandby, finance), [scenario, drawStandby, finance]);
  const trough = minCash(rows);
  const sellingRows = rows.filter((r) => r.revenue > 0).slice(0, 12);
  const totalUnits = rows.reduce((sum, r) => sum + r.units, 0);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const totalGrossProfit = rows.reduce((sum, r) => sum + r.grossProfit, 0);
  const firstSale = sellingRows[0];
  const margin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Commercial · sales → cash</p><h1 className="mt-1 font-display text-4xl">Sales planning</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Translate the production plan into sell-through, revenue and gross profit. Sales uses the same product ASP, COGS, launch and mix assumptions as the financial model, so there is no second commercial forecast hiding elsewhere.</p></div>
      <Link to="/command/finance-assumptions" className="rounded-lg border border-accent px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent/10">Open sales assumptions</Link>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi label="36-mo units" value={String(totalUnits)} hint={`${scenario} scenario`} />
      <Kpi label="36-mo revenue" value={lakh(totalRevenue)} hint="Gross sales model" />
      <Kpi label="Gross profit" value={lakh(totalGrossProfit)} hint={`${margin.toFixed(1)}% blended margin`} />
      <Kpi label="First sale" value={firstSale ? `M${firstSale.m}` : "—"} hint="First revenue month" />
      <Kpi label="Cash trough" value={lakh(trough.cash)} hint={`M${trough.m} after sales / operating flows`} tone={trough.cash < 8 ? "danger" : trough.cash < 15 ? "warn" : "ok"} />
    </div>

    <Panel title="Sales ramp" kicker="Monthly plan · units / ₹ L">
      {sellingRows.length === 0 ? <p className="text-sm text-muted">No sales are scheduled under the current assumptions.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle"><tr><th className="px-3 py-3 text-left">Month</th><th className="px-3 py-3 text-right">Units</th><th className="px-3 py-3 text-right">Revenue</th><th className="px-3 py-3 text-right">COGS</th><th className="px-3 py-3 text-right">Gross profit</th><th className="px-3 py-3 text-right">Gross margin</th><th className="px-3 py-3 text-right">Closing cash</th></tr></thead><tbody>{sellingRows.map((r) => <tr key={r.m} className="border-t border-border/70"><td className="px-3 py-3 font-semibold text-fg">M{r.m}</td><td className="px-3 py-3 text-right font-semibold tabular-nums">{r.units}</td><td className="px-3 py-3 text-right tabular-nums">{lakh(r.revenue)}</td><td className="px-3 py-3 text-right tabular-nums">{lakh(r.cogs)}</td><td className="px-3 py-3 text-right tabular-nums text-accent">{lakh(r.grossProfit)}</td><td className="px-3 py-3 text-right tabular-nums">{r.revenue > 0 ? `${((r.grossProfit / r.revenue) * 100).toFixed(1)}%` : "—"}</td><td className="px-3 py-3 text-right tabular-nums">{lakh(r.closing)}</td></tr>)}</tbody></table></div>}
      <p className="mt-3 text-[11px] leading-5 text-subtle">Revenue follows the same launch months and product mix controlled in Plan & Assumptions. ASP and COGS changes therefore flow into gross profit, cash and funding requirements.</p>
    </Panel>

    <Panel title="The sales equation" kicker="One commercial chain"><div className="grid gap-3 md:grid-cols-5">{[["01","Traffic / demand","Demand creates the opportunity to sell"],["02","Units","Production creates sellable units"],["03","ASP","Units × ASP creates revenue"],["04","Gross profit","Revenue − COGS shows product economics"],["05","Cash","Collections and timing determine cash reality"]].map(([n,title,note]) => <div key={n} className="rounded-xl border border-border bg-bg-elevated/40 p-4"><span className="text-[10px] font-bold tracking-[0.16em] text-accent">{n}</span><p className="mt-2 text-sm font-semibold text-fg">{title}</p><p className="mt-1 text-xs leading-5 text-muted">{note}</p></div>)}</div></Panel>

    <Panel title="What changes sales performance" kicker="Connected assumptions"><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">{[["ASP","Price per bike","Changes revenue and gross profit"],["Volume","Units sold","Changes revenue, COGS and cash"],["Mix","Carbon / Aluminium / Premium","Changes blended economics"],["Launch timing","First selling month","Moves revenue and the cash curve"]].map(([title,label,note]) => <div key={title} className="rounded-xl border border-border bg-bg-elevated/40 p-4"><p className="text-sm font-semibold text-fg">{title}</p><p className="mt-1 text-xs text-accent">{label}</p><p className="mt-2 text-xs leading-5 text-muted">{note}</p></div>)}</div><div className="mt-4 flex flex-wrap gap-2"><Link to="/command/finance-assumptions" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Edit assumptions</Link><Link to="/command/scenarios" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Compare scenarios</Link><Link to="/command/financial-cockpit" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">See cash impact</Link></div></Panel>
  </div>;
}
