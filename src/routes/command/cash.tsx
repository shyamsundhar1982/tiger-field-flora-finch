import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { buildModelWithInputs, minCash, type ScenarioId } from "@/lib/finance/model";
import { lakh } from "@/lib/format";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/cash")({ component: CashPlanning });

function CashPlanning() {
  const scenario = useVeloxis((s) => s.scenario) as ScenarioId;
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const finance = useVeloxis((s) => s.finance);
  const rows = useMemo(() => buildModelWithInputs(scenario, drawStandby, finance), [scenario, drawStandby, finance]);
  const trough = minCash(rows);
  const [minimumCash, setMinimumCash] = useState(10);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const totalOpex = rows.reduce((sum, r) => sum + r.opex, 0);
  const totalCapex = rows.reduce((sum, r) => sum + r.capex, 0);
  const totalInventory = rows.reduce((sum, r) => sum + r.inventoryBuy, 0);
  const totalFunding = rows.reduce((sum, r) => sum + r.funding, 0);
  const totalCogs = rows.reduce((sum, r) => sum + r.cogs, 0);
  const belowPolicy = rows.filter((r) => r.closing < minimumCash);
  const policyGap = belowPolicy.length ? Math.max(0, minimumCash - Math.min(...belowPolicy.map((r) => r.closing))) : 0;
  const runway = rows.findIndex((r) => r.closing <= 0);
  const runwayLabel = runway >= 0 ? `M${rows[runway].m}` : "36M+";
  const workingCapital = rows[rows.length - 1]?.inventory ?? 0;
  const sources = totalFunding + totalRevenue;
  const uses = totalOpex + totalCapex + totalInventory;

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Treasury · working capital → cash</p><h1 className="mt-1 font-display text-4xl">Cash & working capital</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">The cash control room: where money comes from, where it goes, how much gets trapped in inventory, and when the business crosses its minimum cash policy.</p></div>
      <div className="flex flex-wrap gap-2"><Link to="/command/finance-assumptions" className="rounded-lg border border-accent px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent/10">Edit assumptions</Link><Link to="/command/financial-cockpit" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:border-accent">Financial cockpit</Link></div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Kpi label="Cash trough" value={lakh(trough.cash)} hint={`M${trough.m}`} tone={trough.cash < 0 ? "danger" : trough.cash < minimumCash ? "warn" : "ok"} />
      <Kpi label="36-mo revenue" value={lakh(totalRevenue, 0)} hint="Cash inflow modeled at sale" />
      <Kpi label="Funding" value={lakh(totalFunding, 0)} hint="Planned financing" />
      <Kpi label="Inventory cash" value={lakh(totalInventory, 0)} hint="Cumulative purchase draw" />
      <Kpi label="Closing inventory" value={lakh(workingCapital)} hint="Cash still tied up" />
      <Kpi label="Zero-cash point" value={runwayLabel} hint={runway >= 0 ? "Action required before this month" : "No zero-cash month in 36M"} tone={runway >= 0 ? "danger" : "ok"} />
    </div>

    <Panel title="Minimum cash policy" kicker="Interactive control">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-sm text-muted">Set the minimum cash buffer you want the plan to protect. This is a management policy, not a hidden model assumption.</p><input aria-label="Minimum cash policy" type="range" min="0" max="40" step="1" value={minimumCash} onChange={(e) => setMinimumCash(Number(e.target.value))} className="mt-5 w-full accent-accent"/><div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.12em] text-subtle"><span>₹0L</span><span>₹20L</span><span>₹40L</span></div></div><div className="rounded-xl border border-border bg-bg-elevated/50 px-5 py-4 text-center"><p className="text-[10px] uppercase tracking-[0.15em] text-subtle">Policy buffer</p><p className="mt-1 text-3xl font-semibold tabular-nums text-fg">{lakh(minimumCash)}</p><p className={`mt-1 text-xs ${policyGap > 0 ? "text-accent" : "text-muted"}`}>{policyGap > 0 ? `Additional ₹${policyGap.toFixed(1)}L needed at trough` : "Policy protected in current plan"}</p></div></div>
    </Panel>

    <Panel title="36-month cash waterfall" kicker="Sources → uses → closing cash">
      <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle"><tr><th className="px-3 py-3 text-left">Month</th><th className="px-3 py-3 text-right">Opening</th><th className="px-3 py-3 text-right">Sales</th><th className="px-3 py-3 text-right">Funding</th><th className="px-3 py-3 text-right">Opex</th><th className="px-3 py-3 text-right">Capex</th><th className="px-3 py-3 text-right">Inventory</th><th className="px-3 py-3 text-right">Closing</th></tr></thead><tbody>{rows.map((r) => <tr key={r.m} className={`border-t border-border/70 ${r.closing < minimumCash ? "bg-accent/5" : ""}`}><td className="px-3 py-2.5 font-semibold">M{r.m}</td><td className="px-3 py-2.5 text-right tabular-nums">{lakh(r.opening)}</td><td className="px-3 py-2.5 text-right tabular-nums">{lakh(r.revenue)}</td><td className="px-3 py-2.5 text-right tabular-nums">{lakh(r.funding)}</td><td className="px-3 py-2.5 text-right tabular-nums">−{lakh(r.opex)}</td><td className="px-3 py-2.5 text-right tabular-nums">−{lakh(r.capex)}</td><td className="px-3 py-2.5 text-right tabular-nums">−{lakh(r.inventoryBuy)}</td><td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${r.closing < minimumCash ? "text-accent" : ""}`}>{lakh(r.closing)}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-[11px] leading-5 text-subtle">Every row is calculated from the shared finance model. Changing ASP, COGS, volume, launch timing, opex, capex, funding or Aluminium assumptions elsewhere recalculates this table.</p>
    </Panel>

    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Where the money goes" kicker="36-month uses"><div className="space-y-4">{[["Operating spend", totalOpex], ["Inventory purchases", totalInventory], ["Capital expenditure", totalCapex], ["Product COGS", totalCogs]].map(([label, value]) => <div key={label as string}><div className="flex justify-between text-sm"><span className="text-fg">{label as string}</span><span className="font-semibold tabular-nums">{lakh(value as number, 0)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-accent" style={{ width: `${uses > 0 ? Math.min(100, ((value as number) / Math.max(uses, totalCogs)) * 100) : 0}%` }} /></div></div>)}</div></Panel>
      <Panel title="Working capital bridge" kicker="Why inventory matters"><div className="grid gap-3 sm:grid-cols-3">{[["Purchases", totalInventory, "Cash leaves"],["COGS consumed", totalCogs, "Inventory releases"],["Closing stock", workingCapital, "Cash remains tied"]].map(([label, value, note]) => <div key={label as string} className="rounded-xl border border-border bg-bg-elevated/40 p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">{label as string}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{lakh(value as number)}</p><p className="mt-1 text-xs text-muted">{note as string}</p></div>)}</div><p className="mt-4 text-xs leading-5 text-muted">Inventory is not an expense when purchased; it is a cash use that becomes cost of goods as bikes are sold. That distinction keeps the planning model understandable.</p></Panel>
    </div>

    <Panel title="The cash equation" kicker="One connected system"><div className="grid gap-3 md:grid-cols-5">{[["01","Cash in","Sales + funding"],["02","Cash out","Opex + capex + inventory buys"],["03","Working capital","Inventory stores cash until consumed"],["04","Cash trough","Lowest monthly closing cash"],["05","Funding need","Capital required to protect policy"]].map(([n,title,note]) => <div key={n} className="rounded-xl border border-border bg-bg-elevated/40 p-4"><span className="text-[10px] font-bold tracking-[0.16em] text-accent">{n}</span><p className="mt-2 text-sm font-semibold text-fg">{title}</p><p className="mt-1 text-xs leading-5 text-muted">{note}</p></div>)}</div><div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted"><span>Modeled sources {lakh(sources, 0)}</span><span>→</span><span>Modeled uses {lakh(uses, 0)}</span><span>→</span><span className="font-semibold text-fg">Cash trough {lakh(trough.cash)}</span></div></Panel>
  </div>;
}
