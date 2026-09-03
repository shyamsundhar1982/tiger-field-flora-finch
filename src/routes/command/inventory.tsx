import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { buildModelWithInputs, minCash, type ScenarioId } from "@/lib/finance/model";
import { inr, lakh } from "@/lib/format";
import { SEED_INVENTORY, useInventory } from "@/lib/data/inventory";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/inventory")({ component: InventoryPlanning });

function InventoryPlanning() {
  const scenario = useVeloxis((s) => s.scenario) as ScenarioId;
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const [items] = useInventory(SEED_INVENTORY);
  const rows = useMemo(() => buildModelWithInputs(scenario, drawStandby), [scenario, drawStandby]);
  const trough = minCash(rows);
  const live = rows.filter((r) => r.inventoryBuy > 0).slice(0, 8);
  const listedValue = items.reduce((sum, x) => sum + x.priceInr * x.stockQty, 0);
  const reorderExposure = items.reduce((sum, x) => sum + x.priceInr * Math.max(0, x.reorderLevel - x.stockQty), 0);
  const lowStock = items.filter((x) => x.stockQty <= x.reorderLevel);
  const outOfStock = items.filter((x) => x.stockQty === 0);
  const selectable = items.filter((x) => x.stockQty > 0 && (x.coreEnabled || x.proEnabled || x.apexEnabled));
  const categories = [...new Set(items.map((x) => x.category))].map((category) => {
    const group = items.filter((x) => x.category === category);
    return { category, models: group.length, units: group.reduce((s, x) => s + x.stockQty, 0), listed: group.reduce((s, x) => s + x.priceInr * x.stockQty, 0), low: group.filter((x) => x.stockQty <= x.reorderLevel).length };
  });

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Operations · cash connection</p><h1 className="mt-1 font-display text-4xl">Inventory planning</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Inventory is not only a component list. It is cash committed before a sale. This workspace connects the live component catalogue to the 36-month financial model and makes reorder exposure visible.</p></div>
      <Link to="/inventory" className="rounded-lg border border-accent px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent/10">Open component control</Link>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Catalogue value" value={inr(listedValue)} hint="Listed-price × units; planning proxy, not accounting inventory cost" />
      <Kpi label="Reorder exposure" value={inr(reorderExposure)} hint={`${lowStock.length} items at / below reorder`} tone={lowStock.length > 0 ? "warn" : "ok"} />
      <Kpi label="Selectable stock" value={String(selectable.length)} hint={`${outOfStock.length} models currently unavailable`} tone={outOfStock.length > 0 ? "warn" : "ok"} />
      <Kpi label="Model cash trough" value={lakh(trough.cash)} hint={`M${trough.m} · ${scenario} scenario`} tone={trough.cash < 8 ? "danger" : trough.cash < 15 ? "warn" : "ok"} />
    </div>

    <Panel title="The cash connection" kicker="Inventory → cash → runway">
      <div className="grid gap-3 md:grid-cols-5">
        {[
          ["01", "Buy components", "Purchase creates inventory and consumes cash"],
          ["02", "Build", "Components move into production"],
          ["03", "Sell", "Revenue converts finished stock back to cash"],
          ["04", "Reorder", "Low stock creates the next cash requirement"],
          ["05", "Runway", "Inventory timing changes the cash trough"],
        ].map(([n, title, note]) => <div key={n} className="rounded-xl border border-border bg-bg-elevated/40 p-4"><span className="text-[10px] font-bold tracking-[0.16em] text-accent">{n}</span><p className="mt-2 text-sm font-semibold text-fg">{title}</p><p className="mt-1 text-xs leading-5 text-muted">{note}</p></div>)}
      </div>
      <p className="mt-4 text-xs leading-5 text-muted">The financial model currently tracks inventory purchases at the portfolio level. The component catalogue remains the operational source for stock, eligibility and listed pricing. We deliberately do not call listed component prices accounting COGS.</p>
    </Panel>

    <Panel title="Planned inventory cash draw" kicker="36-month model · ₹ L">
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle"><tr><th className="px-3 py-3 text-left">Month</th><th className="px-3 py-3 text-right">Units</th><th className="px-3 py-3 text-right">Inventory buy</th><th className="px-3 py-3 text-right">Closing inventory</th><th className="px-3 py-3 text-right">Closing cash</th></tr></thead><tbody>{live.map((r) => <tr key={r.m} className="border-t border-border/70"><td className="px-3 py-3 font-semibold text-fg">M{r.m}</td><td className="px-3 py-3 text-right tabular-nums text-muted">{r.units}</td><td className="px-3 py-3 text-right tabular-nums text-accent">{lakh(r.inventoryBuy)}</td><td className="px-3 py-3 text-right tabular-nums text-fg">{lakh(r.inventory)}</td><td className="px-3 py-3 text-right tabular-nums text-fg">{lakh(r.closing)}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-[11px] text-subtle">Change assumptions in Plan & Assumptions and this table recalculates with the same model used by Financial Cockpit and Master Finance.</p>
    </Panel>

    <Panel title="Stock position by component family" kicker="Live catalogue">
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle"><tr><th className="px-3 py-3 text-left">Family</th><th className="px-3 py-3 text-right">Models</th><th className="px-3 py-3 text-right">Units</th><th className="px-3 py-3 text-right">Listed value</th><th className="px-3 py-3 text-right">At / below reorder</th></tr></thead><tbody>{categories.map((r) => <tr key={r.category} className="border-t border-border/70"><td className="px-3 py-3 font-semibold capitalize text-fg">{r.category.replaceAll("-", " ")}</td><td className="px-3 py-3 text-right tabular-nums text-muted">{r.models}</td><td className="px-3 py-3 text-right tabular-nums text-fg">{r.units}</td><td className="px-3 py-3 text-right tabular-nums text-fg">{inr(r.listed)}</td><td className={`px-3 py-3 text-right tabular-nums ${r.low > 0 ? "text-warn" : "text-green"}`}>{r.low}</td></tr>)}</tbody></table></div>
    </Panel>

    <Panel title="Reorder queue" kicker="Actionable now">
      {lowStock.length === 0 ? <p className="text-sm text-muted">No components are at or below their reorder level.</p> : <div className="grid gap-2 md:grid-cols-2">{lowStock.slice(0, 12).map((x) => <Link key={x.id} to="/inventory" className="flex items-center justify-between rounded-lg border border-border bg-bg-elevated/40 p-3 hover:border-accent"><span><span className="block text-sm font-semibold text-fg">{x.brand} {x.model}</span><span className="text-xs text-muted">{x.sku} · reorder {x.reorderLevel}</span></span><span className="text-right"><span className="block text-sm font-bold tabular-nums text-warn">{x.stockQty} left</span><span className="text-[10px] uppercase tracking-wider text-subtle">edit stock</span></span></Link>)}</div>}
    </Panel>
  </div>;
}
