import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";

export const Route = createFileRoute("/command/aluminium-finance")({ component: AluminiumFinance });

const fmt = (n: number) => `₹${n.toFixed(1)}L`;
const pct = (n: number) => `${n.toFixed(1)}%`;

type Assumptions = {
  asp: number;
  cogs: number;
  volumeFactor: number;
  launchMonth: number;
  opex: number;
  capex: number;
  inventoryCover: number;
  openingCash: number;
  funding: number;
};

const DEFAULTS: Assumptions = {
  asp: 0.4,
  cogs: 0.25,
  volumeFactor: 1,
  launchMonth: 6,
  opex: 1.8,
  capex: 24,
  inventoryCover: 1.15,
  openingCash: 2,
  funding: 60,
};

const RAMP = [0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 10, 10, 12, 12, 14, 14, 16, 16, 18, 18, 20, 20, 22, 22, 24, 24, 26];

const INPUTS: Array<{ key: keyof Assumptions; label: string; suffix: string; step: string; min: number; max: number; note: string }> = [
  { key: "asp", label: "Aluminium ASP", suffix: "₹ lakh / bike", step: "0.01", min: 0.2, max: 1, note: "Editable commercial price within the current planning band." },
  { key: "cogs", label: "Aluminium COGS", suffix: "₹ lakh / bike", step: "0.01", min: 0.1, max: 0.8, note: "Frame + components + production cost assumption." },
  { key: "volumeFactor", label: "Volume factor", suffix: "× base ramp", step: "0.05", min: 0.25, max: 2, note: "Changes only the Aluminium unit ramp." },
  { key: "launchMonth", label: "Launch month", suffix: "M", step: "1", min: 1, max: 36, note: "Shifts the vertical's commercial start." },
  { key: "opex", label: "Monthly opex", suffix: "₹ lakh", step: "0.1", min: 0, max: 10, note: "Dedicated vertical operating footprint." },
  { key: "capex", label: "Launch capex", suffix: "₹ lakh", step: "1", min: 0, max: 100, note: "Tooling, fixtures, launch equipment and setup." },
  { key: "inventoryCover", label: "Inventory cover", suffix: "× COGS", step: "0.05", min: 1, max: 2, note: "Procurement buffer applied to monthly production." },
  { key: "openingCash", label: "Opening cash", suffix: "₹ lakh", step: "0.5", min: 0, max: 100, note: "Cash allocated to this vertical before funding." },
  { key: "funding", label: "Dedicated funding", suffix: "₹ lakh", step: "1", min: 0, max: 200, note: "Capital reserved for the Aluminium vertical." },
];

function AluminiumFinance() {
  const [inputs, setInputs] = useState<Assumptions>(DEFAULTS);

  const rows = useMemo(() => {
    let cash = inputs.openingCash;
    let inventory = 0;
    return Array.from({ length: 36 }, (_, index) => {
      const m = index + 1;
      const launched = m >= inputs.launchMonth;
      const units = launched ? Math.round((RAMP[m - 1] ?? 0) * inputs.volumeFactor) : 0;
      const revenue = units * inputs.asp;
      const cogs = units * inputs.cogs;
      const inventoryBuy = launched && units > 0 ? units * inputs.cogs * Math.max(0, inputs.inventoryCover - 1) : 0;
      const capex = m === inputs.launchMonth ? inputs.capex : 0;
      const funding = m === inputs.launchMonth ? inputs.funding : 0;
      const opex = launched ? inputs.opex : inputs.opex * 0.35;
      const grossProfit = revenue - cogs;
      const ebitda = grossProfit - opex;
      const opening = cash;
      cash = opening + revenue + funding - opex - inventoryBuy - capex;
      inventory = Math.max(0, inventory + inventoryBuy - cogs);
      return { m, units, revenue, cogs, grossProfit, opex, ebitda, capex, inventoryBuy, funding, opening, closing: cash, inventory };
    });
  }, [inputs]);

  const totalUnits = rows.reduce((s, r) => s + r.units, 0);
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const cogs = rows.reduce((s, r) => s + r.cogs, 0);
  const ebitda = rows.reduce((s, r) => s + r.ebitda, 0);
  const funding = rows.reduce((s, r) => s + r.funding, 0);
  const low = rows.reduce((a, r) => r.closing < a.closing ? r : a, rows[0]);
  const gm = inputs.asp > 0 ? ((inputs.asp - inputs.cogs) / inputs.asp) * 100 : 0;
  const contribution = inputs.asp - inputs.cogs;
  const breakEvenUnits = contribution > 0 ? Math.ceil((inputs.opex + inputs.capex) / contribution) : 0;
  const annual = [1, 2, 3].map((year) => {
    const slice = rows.slice((year - 1) * 12, year * 12);
    return { year, units: slice.reduce((s, r) => s + r.units, 0), revenue: slice.reduce((s, r) => s + r.revenue, 0), ebitda: slice.reduce((s, r) => s + r.ebitda, 0), closing: slice.at(-1)?.closing ?? 0 };
  });
  const maxRevenue = Math.max(...annual.map((a) => a.revenue), 1);

  const update = (key: keyof Assumptions, value: string) => {
    const n = Number(value);
    if (Number.isFinite(n)) setInputs((current) => ({ ...current, [key]: n }));
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Command · Product entity</p>
        <h1 className="font-display text-4xl">VéLOXIS Aluminium</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">A separate financial vertical inside Command — not blended into the Carbon / Premium Carbon economics. It has its own commercial assumptions, operating cost, launch capex, inventory logic, funding and cash view.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link to="/command" className="rounded-md border border-border px-3 py-2 text-muted hover:bg-surface hover:text-fg">Command Board</Link>
          <Link to="/command/finance-control" className="rounded-md border border-border px-3 py-2 text-muted hover:bg-surface hover:text-fg">Portfolio Finance</Link>
          <Link to="/command/market-survey" className="rounded-md border border-border px-3 py-2 text-muted hover:bg-surface hover:text-fg">Market Survey</Link>
        </div>
      </div>

      <Panel title="Entity brief" kicker="Dedicated product vertical">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">Position</p><p className="mt-2 text-lg text-fg">₹30k–₹50k</p><p className="mt-1 text-xs text-muted">Current Market Survey positioning band.</p></div>
          <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">Role</p><p className="mt-2 text-lg text-fg">Volume bridge</p><p className="mt-1 text-xs text-muted">A more accessible aluminium platform before higher-value carbon expansion.</p></div>
          <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">Accounting treatment</p><p className="mt-2 text-lg text-fg">Standalone planning</p><p className="mt-1 text-xs text-muted">Its inputs and outputs remain visible independently of portfolio totals.</p></div>
        </div>
      </Panel>

      <Panel title="Editable Aluminium assumptions" kicker="All ₹ values are lakh unless stated">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INPUTS.map((input) => (
            <label key={input.key} className="rounded-lg border border-border bg-surface p-4 text-xs text-subtle">
              <span className="font-semibold text-fg">{input.label}</span>
              <span className="mt-1 block text-[11px] leading-5">{input.note}</span>
              <div className="mt-3 flex items-center gap-2"><input type="number" min={input.min} max={input.max} step={input.step} value={inputs[input.key]} onChange={(e) => update(input.key, e.target.value)} className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg" /><span className="shrink-0">{input.suffix}</span></div>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => setInputs(DEFAULTS)} className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">Reset Aluminium assumptions</button><span className="text-xs text-muted">Changes are local to this planning session and recalculate the full 36-month vertical.</span></div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="ASP" value={fmt(inputs.asp)} hint="Editable" />
        <Kpi label="Gross margin" value={pct(gm)} hint="Before opex" />
        <Kpi label="36-mo units" value={String(totalUnits)} hint="Aluminium only" />
        <Kpi label="36-mo revenue" value={fmt(revenue)} hint="Standalone" />
        <Kpi label="Cash trough" value={fmt(low.closing)} hint={`M${low.m}`} />
      </div>

      <Panel title="Aluminium unit economics" kicker="Decision controls">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border border-border p-4"><p className="text-xs text-subtle">COGS / bike</p><p className="mt-1 text-xl">{fmt(inputs.cogs)}</p></div>
          <div className="rounded-md border border-border p-4"><p className="text-xs text-subtle">Contribution / bike</p><p className="mt-1 text-xl">{fmt(contribution)}</p></div>
          <div className="rounded-md border border-border p-4"><p className="text-xs text-subtle">Launch funding</p><p className="mt-1 text-xl">{fmt(funding)}</p></div>
          <div className="rounded-md border border-border p-4"><p className="text-xs text-subtle">Simple break-even</p><p className="mt-1 text-xl">{breakEvenUnits} bikes</p><p className="mt-1 text-[11px] text-muted">Uses launch capex + one month opex / contribution.</p></div>
        </div>
      </Panel>

      <Panel title="Three-year Aluminium view" kicker="Standalone vertical · no Carbon aggregation">
        <div className="grid gap-3 lg:grid-cols-3">
          {annual.map((a) => (
            <div key={a.year} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between"><p className="text-sm font-semibold">Year {a.year}</p><p className="text-xs text-subtle">{a.units} bikes</p></div>
              <div className="mt-4"><div className="flex justify-between text-xs"><span className="text-subtle">Revenue</span><span>{fmt(a.revenue)}</span></div><div className="mt-1 h-2 rounded-full bg-border"><div className="h-2 rounded-full bg-accent" style={{ width: `${Math.max(3, (a.revenue / maxRevenue) * 100)}%` }} /></div></div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div><span className="text-subtle">EBITDA</span><p className="mt-1 text-sm">{fmt(a.ebitda)}</p></div><div><span className="text-subtle">Closing cash</span><p className="mt-1 text-sm">{fmt(a.closing)}</p></div></div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Aluminium monthly control" kicker="36 months · dedicated cash waterfall">
        <div className="overflow-x-auto"><table className="w-full min-w-[64rem] text-left text-xs"><thead className="text-[10px] uppercase tracking-[0.12em] text-subtle"><tr><th className="py-2 pr-3">M</th><th className="py-2 pr-3">Units</th><th className="py-2 pr-3">Revenue</th><th className="py-2 pr-3">COGS</th><th className="py-2 pr-3">Opex</th><th className="py-2 pr-3">Capex</th><th className="py-2 pr-3">Inventory</th><th className="py-2 pr-3">Funding</th><th className="py-2">Closing cash</th></tr></thead><tbody>{rows.map((r) => <tr key={r.m} className="border-t border-border"><td className="py-2 pr-3">M{r.m}</td><td className="py-2 pr-3">{r.units}</td><td className="py-2 pr-3">{fmt(r.revenue)}</td><td className="py-2 pr-3">{fmt(r.cogs)}</td><td className="py-2 pr-3">{fmt(r.opex)}</td><td className="py-2 pr-3">{fmt(r.capex)}</td><td className="py-2 pr-3">{fmt(r.inventoryBuy)}</td><td className="py-2 pr-3">{fmt(r.funding)}</td><td className="py-2">{fmt(r.closing)}</td></tr>)}</tbody></table></div>
      </Panel>

      <Panel title="Interpretation" kicker="Automatic planning readout">
        <div className="rounded-md border border-border bg-surface p-4 text-sm leading-6 text-muted">
          At the current inputs, Aluminium contributes {fmt(contribution)} gross contribution per bike at {pct(gm)} gross margin. The 36-month vertical produces {totalUnits} bikes and {fmt(revenue)} revenue, with a modeled EBITDA of {fmt(ebitda)}. The lowest modeled cash is {fmt(low.closing)} at M{low.m}. These are planning mechanics only; supplier quotations, BOM validation, production yield, warranty, logistics, taxes and working-capital terms should be substituted as evidence arrives.
        </div>
      </Panel>
    </div>
  );
}
