import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { buildModelWithInputs, minCash, type ScenarioId } from "@/lib/finance/model";
import { lakh } from "@/lib/format";
import { MANUFACTURING_CONTROLS, MANUFACTURING_GATES } from "@/lib/data/manufacturing-control";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/production")({ component: ProductionPlanning });

function ProductionPlanning() {
  const scenario = useVeloxis((s) => s.scenario) as ScenarioId;
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const finance = useVeloxis((s) => s.finance);
  const updateGlobalFinance = useVeloxis((s) => s.updateGlobalFinance);
  const rows = useMemo(() => buildModelWithInputs(scenario, drawStandby, finance), [scenario, drawStandby, finance]);
  const trough = minCash(rows);
  const productionRows = rows.filter((r) => r.units > 0).slice(0, 12);
  const firstProduction = productionRows[0];
  const totalUnits = rows.reduce((sum, r) => sum + r.units, 0);
  const aluminiumUnits = rows.reduce((sum, r) => sum + r.aluminiumUnits, 0);
  const carbonUnits = rows.reduce((sum, r) => sum + r.carbonUnits, 0);
  const premiumUnits = rows.reduce((sum, r) => sum + r.premiumCarbonUnits, 0);
  const pending = MANUFACTURING_CONTROLS.filter((c) => c.status === "pending").length;
  const verify = MANUFACTURING_CONTROLS.filter((c) => c.status === "verify").length;

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Operations · production → cash</p><h1 className="mt-1 font-display text-4xl">Production planning</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Translate the financial plan into units, product mix and production spend. This page uses the same assumptions as the finance model and points to manufacturing controls when production readiness depends on evidence.</p></div>
      <Link to="/command/manufacturing" className="rounded-lg border border-accent px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent/10">Manufacturing controls</Link>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi label="36-mo planned units" value={String(totalUnits)} hint={`${scenario} scenario`} />
      <Kpi label="Carbon" value={String(carbonUnits)} hint="Core portfolio" />
      <Kpi label="Aluminium" value={String(aluminiumUnits)} hint="Vertical" />
      <Kpi label="Premium Carbon" value={String(premiumUnits)} hint="Premium portfolio" />
      <Kpi label="Cash trough" value={lakh(trough.cash)} hint={`M${trough.m} after production / inventory`} tone={trough.cash < 8 ? "danger" : trough.cash < 15 ? "warn" : "ok"} />
    </div>

    <Panel title="Production volume control" kicker="Shared with finance">
      <div className="grid gap-4 lg:grid-cols-[1fr_220px] lg:items-end"><div><p className="text-sm font-semibold text-fg">Portfolio production multiplier</p><p className="mt-1 max-w-2xl text-xs leading-5 text-muted">Change this once here; the unit plan, revenue, COGS, inventory draw and cash trajectory recalculate everywhere the shared finance model is used.</p></div><label className="block"><span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-subtle">Multiplier</span><input type="number" min="0" max="5" step="0.05" value={finance.unitMultiplier} onChange={(e) => updateGlobalFinance("unitMultiplier", Math.max(0, Math.min(5, Number(e.target.value) || 0)))} className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-right tabular-nums text-fg outline-none focus:border-accent" /></label></div>
    </Panel>

    <Panel title="Production ramp" kicker="Monthly plan · units / ₹ L">
      {productionRows.length === 0 ? <p className="text-sm text-muted">No production is scheduled under the current assumptions.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle"><tr><th className="px-3 py-3 text-left">Month</th><th className="px-3 py-3 text-right">Total</th><th className="px-3 py-3 text-right">Aluminium</th><th className="px-3 py-3 text-right">Carbon</th><th className="px-3 py-3 text-right">Premium</th><th className="px-3 py-3 text-right">Revenue</th><th className="px-3 py-3 text-right">COGS</th><th className="px-3 py-3 text-right">Inventory buy</th><th className="px-3 py-3 text-right">Closing cash</th></tr></thead><tbody>{productionRows.map((r) => <tr key={r.m} className="border-t border-border/70"><td className="px-3 py-3 font-semibold text-fg">M{r.m}</td><td className="px-3 py-3 text-right font-semibold tabular-nums">{r.units}</td><td className="px-3 py-3 text-right tabular-nums text-muted">{r.aluminiumUnits}</td><td className="px-3 py-3 text-right tabular-nums text-muted">{r.carbonUnits}</td><td className="px-3 py-3 text-right tabular-nums text-muted">{r.premiumCarbonUnits}</td><td className="px-3 py-3 text-right tabular-nums">{lakh(r.revenue)}</td><td className="px-3 py-3 text-right tabular-nums">{lakh(r.cogs)}</td><td className="px-3 py-3 text-right tabular-nums text-accent">{lakh(r.inventoryBuy)}</td><td className="px-3 py-3 text-right tabular-nums">{lakh(r.closing)}</td></tr>)}</tbody></table></div>}
      <p className="mt-3 text-[11px] leading-5 text-subtle">First planned production: {firstProduction ? `M${firstProduction.m}` : "not scheduled"}. Product launch months and mix remain controlled in Plan & Assumptions.</p>
    </Panel>

    <Panel title="Production → cash" kicker="No hidden jumps"><div className="grid gap-3 md:grid-cols-5">{[["01","Launch","Product becomes active"],["02","Build","Units follow portfolio mix"],["03","Consume","COGS and inventory move"],["04","Sell","Units create revenue and gross profit"],["05","Cash","Timing changes the cash trough"]].map(([n,title,note]) => <div key={n} className="rounded-xl border border-border bg-bg-elevated/40 p-4"><span className="text-[10px] font-bold tracking-[0.16em] text-accent">{n}</span><p className="mt-2 text-sm font-semibold text-fg">{title}</p><p className="mt-1 text-xs leading-5 text-muted">{note}</p></div>)}</div></Panel>

    <Panel title="Manufacturing readiness" kicker="Production cannot outrun controls"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-border bg-bg-elevated/40 p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">Evidence pending</p><p className="mt-2 text-3xl tabular-nums">{pending}</p></div><div className="rounded-xl border border-border bg-bg-elevated/40 p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">Verification</p><p className="mt-2 text-3xl tabular-nums">{verify}</p></div><div className="rounded-xl border border-border bg-bg-elevated/40 p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">Release gates</p><p className="mt-2 text-3xl tabular-nums">{MANUFACTURING_GATES.length}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><Link to="/command/manufacturing" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Review controls</Link><Link to="/command/inventory" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Check inventory cash</Link><Link to="/command/finance-assumptions" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Adjust assumptions</Link></div></Panel>
  </div>;
}
