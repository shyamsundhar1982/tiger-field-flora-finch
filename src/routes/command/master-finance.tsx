import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { buildModelWithInputs, DEFAULT_FINANCE_ASSUMPTIONS, minCash, type ScenarioId } from "@/lib/finance/model";

export const Route = createFileRoute("/command/master-finance")({ component: MasterFinance });

const fmt = (n: number) => `₹${n.toFixed(1)}L`;
const pct = (n: number) => `${n.toFixed(1)}%`;

const LINE_META = [
  { id: "aluminium" as const, label: "VéLOXIS Aluminium", short: "Aluminium", note: "Volume / accessible vertical" },
  { id: "carbon" as const, label: "VéLOXIS Carbon", short: "Carbon", note: "Core carbon platform" },
  { id: "premiumCarbon" as const, label: "VéLOXIS Premium Carbon", short: "Premium Carbon", note: "Higher-value performance line" },
];

function MasterFinance() {
  const [scenario, setScenario] = useState<ScenarioId>("base");
  const rows = useMemo(() => buildModelWithInputs(scenario, scenario !== "base", DEFAULT_FINANCE_ASSUMPTIONS), [scenario]);
  const low = useMemo(() => minCash(rows), [rows]);
  const totals = useMemo(() => ({
    units: rows.reduce((s, r) => s + r.units, 0),
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
    cogs: rows.reduce((s, r) => s + r.cogs, 0),
    grossProfit: rows.reduce((s, r) => s + r.gp, 0),
    opex: rows.reduce((s, r) => s + r.opex, 0),
    ebitda: rows.reduce((s, r) => s + r.ebitda, 0),
    capex: rows.reduce((s, r) => s + r.capex, 0),
    inventory: rows.reduce((s, r) => s + r.inventoryBuy, 0),
    funding: rows.reduce((s, r) => s + r.funding, 0),
  }), [rows]);

  const lines = useMemo(() => LINE_META.map((line) => {
    const units = rows.reduce((s, r) => s + r[`${line.id}Units`], 0);
    const assumption = DEFAULT_FINANCE_ASSUMPTIONS.productLines.find((p) => p.id === line.id)!;
    const revenue = units * assumption.aspLakh;
    const stressFactor = scenario === "stress" ? 1.2 : 1;
    const cogs = units * assumption.cogsLakh * stressFactor;
    const grossProfit = revenue - cogs;
    return { ...line, units, revenue, cogs, grossProfit, margin: revenue > 0 ? grossProfit / revenue * 100 : 0 };
  }), [rows, scenario]);

  const annual = [1, 2, 3].map((year) => {
    const slice = rows.slice((year - 1) * 12, year * 12);
    const result = { year, aluminium: 0, carbon: 0, premiumCarbon: 0, revenue: 0, grossProfit: 0, ebitda: 0, funding: 0, capex: 0, inventory: 0, closing: slice.at(-1)?.closing ?? 0 };
    for (const r of slice) {
      result.aluminium += r.aluminiumUnits;
      result.carbon += r.carbonUnits;
      result.premiumCarbon += r.premiumCarbonUnits;
      result.revenue += r.revenue;
      result.grossProfit += r.gp;
      result.ebitda += r.ebitda;
      result.funding += r.funding;
      result.capex += r.capex;
      result.inventory += r.inventoryBuy;
    }
    return result;
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Command · Master financial control</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-4xl">Master Financial Dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">One consolidated management view of Aluminium, Carbon and Premium Carbon production, sales, gross profit, operating economics, funding, capex, inventory and cash implications.</p>
          </div>
          <label className="shrink-0 text-xs text-subtle">Scenario<select value={scenario} onChange={(e) => setScenario(e.target.value as ScenarioId)} className="mt-1 block rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg"><option value="base">Base</option><option value="delayed">Delayed</option><option value="stress">Stress</option></select></label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link to="/command/aluminium-finance" className="rounded-md border border-accent/50 px-3 py-2 text-accent hover:bg-surface">Aluminium Vertical</Link>
          <Link to="/command/finance-control" className="rounded-md border border-border px-3 py-2 text-muted hover:bg-surface hover:text-fg">Editable Portfolio Controls</Link>
          <Link to="/command/balance-sheet" className="rounded-md border border-border px-3 py-2 text-muted hover:bg-surface hover:text-fg">Balance Sheet</Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="36-mo production" value={`${totals.units} bikes`} hint="All product lines" />
        <Kpi label="36-mo sales" value={fmt(totals.revenue)} hint="Revenue" />
        <Kpi label="36-mo gross profit" value={fmt(totals.grossProfit)} hint={`${pct(totals.revenue > 0 ? totals.grossProfit / totals.revenue * 100 : 0)} gross margin`} />
        <Kpi label="36-mo EBITDA" value={fmt(totals.ebitda)} hint="After shared opex" tone={totals.ebitda >= 0 ? "ok" : "danger"} />
      </div>

      <Panel title="Consolidated product economics" kicker="Production · sales · gross profit">
        <div className="overflow-x-auto"><table className="w-full min-w-[54rem] text-left text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle"><tr><th className="px-3 py-3">Vertical</th><th className="px-3 py-3 text-right">Production</th><th className="px-3 py-3 text-right">Sales</th><th className="px-3 py-3 text-right">COGS</th><th className="px-3 py-3 text-right">Gross profit</th><th className="px-3 py-3 text-right">GM</th><th className="px-3 py-3">Role</th></tr></thead><tbody>{lines.map((line) => <tr key={line.id} className="border-t border-border"><td className="px-3 py-3 font-medium text-fg">{line.label}</td><td className="px-3 py-3 text-right tabular-nums">{line.units}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(line.revenue)}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(line.cogs)}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(line.grossProfit)}</td><td className="px-3 py-3 text-right tabular-nums">{pct(line.margin)}</td><td className="px-3 py-3 text-xs text-muted">{line.note}</td></tr>)}<tr className="border-t-2 border-border font-semibold"><td className="px-3 py-3">Consolidated</td><td className="px-3 py-3 text-right">{totals.units}</td><td className="px-3 py-3 text-right">{fmt(totals.revenue)}</td><td className="px-3 py-3 text-right">{fmt(totals.cogs)}</td><td className="px-3 py-3 text-right">{fmt(totals.grossProfit)}</td><td className="px-3 py-3 text-right">{pct(totals.revenue > 0 ? totals.grossProfit / totals.revenue * 100 : 0)}</td><td className="px-3 py-3 text-xs text-muted">Portfolio before shared opex</td></tr></tbody></table></div>
        <p className="mt-4 rounded-md border border-border bg-surface p-3 text-xs leading-5 text-muted">Gross profit is attributable to each product line from its own ASP and COGS assumptions. Shared opex is intentionally kept at portfolio level rather than artificially allocated across Aluminium and Carbon.</p>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Gross profit" value={fmt(totals.grossProfit)} hint="Sales less product COGS" />
        <Kpi label="Shared opex" value={fmt(totals.opex)} hint="Portfolio operating cost" />
        <Kpi label="Capex" value={fmt(totals.capex)} hint="Tooling + setup" />
        <Kpi label="Inventory buys" value={fmt(totals.inventory)} hint="Working-capital outflow" />
        <Kpi label="Funding" value={fmt(totals.funding)} hint="Planned capital ladder" />
      </div>

      <Panel title="Financial implications" kicker="What the consolidated model means for management">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">Cash requirement</p><p className="mt-2 text-xl text-fg">{fmt(Math.max(0, -low.cash))}</p><p className="mt-1 text-xs leading-5 text-muted">Modeled funding gap, if any, at the lowest cash point (M{low.m}).</p></div>
          <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">Operating leverage</p><p className="mt-2 text-xl text-fg">{fmt(totals.grossProfit - totals.opex)}</p><p className="mt-1 text-xs leading-5 text-muted">Gross profit less shared opex, before capex and working-capital movements.</p></div>
          <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">Cash trough</p><p className="mt-2 text-xl text-fg">{fmt(low.cash)}</p><p className="mt-1 text-xs leading-5 text-muted">Lowest modeled closing cash at M{low.m}; funding timing matters as much as total funding.</p></div>
        </div>
      </Panel>

      <Panel title="Three-year consolidated production & sales" kicker="Annual management view">
        <div className="overflow-x-auto"><table className="w-full min-w-[62rem] text-left text-xs"><thead className="border-b border-border text-[10px] uppercase tracking-[0.12em] text-subtle"><tr><th className="px-3 py-3">Year</th><th className="px-3 py-3 text-right">Aluminium</th><th className="px-3 py-3 text-right">Carbon</th><th className="px-3 py-3 text-right">Premium Carbon</th><th className="px-3 py-3 text-right">Sales</th><th className="px-3 py-3 text-right">Gross profit</th><th className="px-3 py-3 text-right">EBITDA</th><th className="px-3 py-3 text-right">Funding</th><th className="px-3 py-3 text-right">Capex</th><th className="px-3 py-3 text-right">Closing cash</th></tr></thead><tbody>{annual.map((a) => <tr key={a.year} className="border-t border-border"><td className="px-3 py-3 font-medium">Year {a.year}</td><td className="px-3 py-3 text-right">{a.aluminium}</td><td className="px-3 py-3 text-right">{a.carbon}</td><td className="px-3 py-3 text-right">{a.premiumCarbon}</td><td className="px-3 py-3 text-right">{fmt(a.revenue)}</td><td className="px-3 py-3 text-right">{fmt(a.grossProfit)}</td><td className="px-3 py-3 text-right">{fmt(a.ebitda)}</td><td className="px-3 py-3 text-right">{fmt(a.funding)}</td><td className="px-3 py-3 text-right">{fmt(a.capex)}</td><td className="px-3 py-3 text-right">{fmt(a.closing)}</td></tr>)}</tbody></table></div>
      </Panel>

      <Panel title="36-month cash waterfall" kicker="Funding · sales · opex · capex · inventory">
        <div className="overflow-x-auto"><table className="w-full min-w-[66rem] text-left text-xs"><thead className="border-b border-border text-[10px] uppercase tracking-[0.12em] text-subtle"><tr><th className="px-3 py-3">Month</th><th className="px-3 py-3 text-right">Units</th><th className="px-3 py-3 text-right">Sales</th><th className="px-3 py-3 text-right">Gross profit</th><th className="px-3 py-3 text-right">Opex</th><th className="px-3 py-3 text-right">Capex</th><th className="px-3 py-3 text-right">Inventory</th><th className="px-3 py-3 text-right">Funding</th><th className="px-3 py-3 text-right">Closing cash</th></tr></thead><tbody>{rows.map((r) => <tr key={r.m} className="border-t border-border"><td className="px-3 py-2">M{r.m}</td><td className="px-3 py-2 text-right">{r.units}</td><td className="px-3 py-2 text-right">{fmt(r.revenue)}</td><td className="px-3 py-2 text-right">{fmt(r.gp)}</td><td className="px-3 py-2 text-right">{fmt(r.opex)}</td><td className="px-3 py-2 text-right">{fmt(r.capex)}</td><td className="px-3 py-2 text-right">{fmt(r.inventoryBuy)}</td><td className="px-3 py-2 text-right">{fmt(r.funding)}</td><td className="px-3 py-2 text-right">{fmt(r.closing)}</td></tr>)}</tbody></table></div>
      </Panel>

      <p className="text-xs leading-5 text-subtle">Management-planning view only. Product ASP, COGS, volume mix, launch timing, opex, capex, inventory and funding are assumptions and should be replaced by supplier quotes, BOM/yield evidence, tax treatment, logistics, warranty and working-capital terms as they are validated.</p>
    </div>
  );
}
