import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { FINANCE_GATES, SCENARIO_SNAPSHOTS } from "@/lib/data/finance-control";
import {
  DEFAULT_FINANCE_ASSUMPTIONS,
  buildModelWithInputs,
  minCash,
  totals,
  type FinanceAssumptions,
  type ProductLineId,
  type ScenarioId,
} from "@/lib/finance/model";

export const Route = createFileRoute("/command/finance-control")({ component: FinanceControl });

const fmt = (n: number) => `₹${n.toFixed(1)}L`;
const pct = (n: number) => `${n.toFixed(1)}%`;

const PRODUCT_META: Record<ProductLineId, { short: string; note: string }> = {
  aluminium: { short: "Aluminium", note: "Separate entry / mid-premium vertical. Own price, cost, mix and launch controls." },
  carbon: { short: "Carbon", note: "Core carbon planning vertical." },
  premiumCarbon: { short: "Premium Carbon", note: "Higher-value performance vertical." },
};

const GLOBAL_INPUTS: Array<{
  key: "unitMultiplier" | "opexMultiplier" | "capexMultiplier" | "inventoryMultiplier" | "fundingMultiplier" | "openingCashLakh";
  label: string;
  suffix: string;
  step: string;
  min: number;
  max: number;
}> = [
  { key: "unitMultiplier", label: "Volume factor", suffix: "× base ramp", step: "0.05", min: 0.25, max: 2 },
  { key: "opexMultiplier", label: "Operating cost", suffix: "× base opex", step: "0.05", min: 0.5, max: 2 },
  { key: "capexMultiplier", label: "Capex factor", suffix: "× base capex", step: "0.05", min: 0.5, max: 2 },
  { key: "inventoryMultiplier", label: "Inventory factor", suffix: "× base buy", step: "0.05", min: 0.5, max: 2 },
  { key: "fundingMultiplier", label: "Funding factor", suffix: "× planned ladder", step: "0.05", min: 0, max: 2 },
  { key: "openingCashLakh", label: "Opening cash", suffix: "₹ lakh", step: "0.5", min: 0, max: 100 },
];

function FinanceControl() {
  const [scenario, setScenario] = useState<ScenarioId>("base");
  const [inputs, setInputs] = useState<FinanceAssumptions>(DEFAULT_FINANCE_ASSUMPTIONS);

  const rows = useMemo(() => buildModelWithInputs(scenario, scenario !== "base", inputs), [scenario, inputs]);
  const total = useMemo(() => totals(rows), [rows]);
  const low = useMemo(() => minCash(rows), [rows]);
  const baseRows = useMemo(() => buildModelWithInputs(scenario, scenario !== "base", DEFAULT_FINANCE_ASSUMPTIONS), [scenario]);
  const baseTotal = useMemo(() => totals(baseRows), [baseRows]);
  const revenueDelta = baseTotal.revenue ? ((total.revenue - baseTotal.revenue) / baseTotal.revenue) * 100 : 0;
  const margin = total.revenue > 0 ? (rows.reduce((s, r) => s + r.gp, 0) / total.revenue) * 100 : 0;

  const annual = [1, 2, 3].map((year) => {
    const slice = rows.slice((year - 1) * 12, year * 12);
    return {
      year,
      units: slice.reduce((s, r) => s + r.units, 0),
      aluminium: slice.reduce((s, r) => s + r.aluminiumUnits, 0),
      carbon: slice.reduce((s, r) => s + r.carbonUnits, 0),
      premium: slice.reduce((s, r) => s + r.premiumCarbonUnits, 0),
      revenue: slice.reduce((s, r) => s + r.revenue, 0),
      ebitda: slice.reduce((s, r) => s + r.ebitda, 0),
      closing: slice.at(-1)?.closing ?? 0,
    };
  });
  const maxRevenue = Math.max(...annual.map((a) => a.revenue), 1);

  const updateGlobal = (key: keyof FinanceAssumptions, value: string) => {
    const n = Number(value);
    if (Number.isFinite(n)) setInputs((current) => ({ ...current, [key]: n }));
  };

  const updateLine = (id: ProductLineId, key: "aspLakh" | "cogsLakh" | "mixPct" | "launchMonth", value: string) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setInputs((current) => ({
      ...current,
      productLines: current.productLines.map((line) => line.id === id ? { ...line, [key]: n } : line),
    }));
  };

  const interpretation = low.cash < 0
    ? `The edited portfolio falls below zero cash at M${low.m}. Treat that as a funding or timing gate, not as a forecast: reduce burn/capex, improve contribution, or move the affected launch.`
    : revenueDelta > 5
      ? `Revenue is ${pct(revenueDelta)} above the controlled scenario. Check production capacity, supplier lead times and working capital before accepting the higher case.`
      : revenueDelta < -5
        ? `Revenue is ${pct(Math.abs(revenueDelta))} below the controlled scenario. The lower case is useful for deciding whether the operating footprint and capital ladder should also be reduced.`
        : `The edited case remains close to the controlled scenario. Watch product-line contribution, monthly volume and the timing of tooling / inventory spend.`;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Stage 4 · Financial control</p>
        <h1 className="font-display text-4xl">Finance Control</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">Portfolio finance stays practical and editable. VéLOXIS Aluminium is intentionally separated below as its own commercial entity and financial vertical.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link to="/command/aluminium-finance" className="rounded-md border border-accent/50 px-3 py-2 text-accent hover:bg-surface">Open Aluminium Financial Vertical</Link>
          <Link to="/command/balance-sheet" className="rounded-md border border-border px-3 py-2 text-muted hover:bg-surface hover:text-fg">Balance Sheet</Link>
          <Link to="/command/ca-audit" className="rounded-md border border-border px-3 py-2 text-muted hover:bg-surface hover:text-fg">CA Verification / Audit</Link>
          <Link to="/command/investor-pitch" className="rounded-md border border-border px-3 py-2 text-muted hover:bg-surface hover:text-fg">Investor Pitch</Link>
        </div>
      </div>

      <Panel title="Product vertical control" kicker="Each line retains its own economics">
        <div className="grid gap-3 lg:grid-cols-3">
          {inputs.productLines.map((line) => {
            const gm = line.aspLakh > 0 ? ((line.aspLakh - line.cogsLakh) / line.aspLakh) * 100 : 0;
            return (
              <div key={line.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-sm font-semibold text-fg">{line.label}</p><p className="mt-1 text-[11px] text-subtle">{line.priceBand} · launch M{line.launchMonth}</p></div>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-accent">{PRODUCT_META[line.id].short}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">{PRODUCT_META[line.id].note}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-subtle">ASP · ₹L<input type="number" step="0.01" min="0.05" value={line.aspLakh} onChange={(e) => updateLine(line.id, "aspLakh", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-fg" /></label>
                  <label className="text-[11px] text-subtle">COGS · ₹L<input type="number" step="0.01" min="0.01" value={line.cogsLakh} onChange={(e) => updateLine(line.id, "cogsLakh", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-fg" /></label>
                  <label className="text-[11px] text-subtle">Mix %<input type="number" step="1" min="0" max="100" value={line.mixPct} onChange={(e) => updateLine(line.id, "mixPct", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-fg" /></label>
                  <label className="text-[11px] text-subtle">Launch month<input type="number" step="1" min="1" max="36" value={line.launchMonth} onChange={(e) => updateLine(line.id, "launchMonth", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-fg" /></label>
                </div>
                <p className="mt-3 text-xs text-muted">Gross margin at current inputs: <span className="text-fg">{pct(gm)}</span></p>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted">These are management planning inputs, not statutory accounts. Supplier quotes, BOM, yield, paint, assembly, logistics, warranty and working-capital evidence should replace assumptions as they become available.</p>
      </Panel>

      <Panel title="Portfolio operating controls" kicker="Shared cash, funding and execution assumptions">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GLOBAL_INPUTS.map((input) => (
            <label key={input.key} className="rounded-lg border border-border bg-surface p-3 text-[11px] text-subtle">
              {input.label}
              <div className="mt-2 flex items-center gap-2"><input type="number" min={input.min} max={input.max} step={input.step} value={inputs[input.key] as number} onChange={(e) => updateGlobal(input.key, e.target.value)} className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg" /><span className="shrink-0">{input.suffix}</span></div>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><span className="text-subtle">Scenario</span><select value={scenario} onChange={(e) => setScenario(e.target.value as ScenarioId)} className="rounded-md border border-border bg-bg px-3 py-2 text-fg"><option value="base">Base</option><option value="delayed">Delayed</option><option value="stress">Stress</option></select></label>
          <button type="button" onClick={() => setInputs(DEFAULT_FINANCE_ASSUMPTIONS)} className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">Reset assumptions</button>
          <span className="text-xs text-muted">All changes recalculate this screen immediately and stay local to the planning session.</span>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="36-mo units" value={String(total.units)} hint={`Al ${rows.reduce((s, r) => s + r.aluminiumUnits, 0)} · Carbon ${rows.reduce((s, r) => s + r.carbonUnits, 0)} · Premium ${rows.reduce((s, r) => s + r.premiumCarbonUnits, 0)}`} />
        <Kpi label="36-mo revenue" value={fmt(total.revenue)} hint="Current editable case" />
        <Kpi label="Gross margin" value={pct(margin)} hint="Portfolio weighted" />
        <Kpi label="Minimum cash" value={fmt(low.cash)} hint={`M${low.m}`} />
        <Kpi label="36-mo funding" value={fmt(total.funding)} hint="Current ladder" />
      </div>

      <Panel title="Three-year operating view" kicker="Annual view keeps scale visible">
        <div className="grid gap-3 lg:grid-cols-3">
          {annual.map((a) => (
            <div key={a.year} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between"><p className="text-sm font-semibold">Year {a.year}</p><p className="text-xs text-subtle">{a.units} bikes</p></div>
              <div className="mt-3 text-xs text-muted">Aluminium {a.aluminium} · Carbon {a.carbon} · Premium {a.premium}</div>
              <div className="mt-4 space-y-3">
                <div><div className="flex justify-between text-xs"><span className="text-subtle">Revenue</span><span>{fmt(a.revenue)}</span></div><div className="mt-1 h-2 rounded-full bg-border"><div className="h-2 rounded-full bg-accent" style={{ width: `${Math.max(3, (a.revenue / maxRevenue) * 100)}%` }} /></div></div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs"><div><span className="text-subtle">EBITDA</span><p className="mt-1 text-sm">{fmt(a.ebitda)}</p></div><div><span className="text-subtle">Closing cash</span><p className="mt-1 text-sm">{fmt(a.closing)}</p></div></div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="What the change means" kicker="Automatic interpretation">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border p-4"><p className="text-xs text-subtle">Revenue vs controlled case</p><p className="mt-1 text-xl">{pct(revenueDelta)}</p></div>
          <div className="rounded-md border border-border p-4"><p className="text-xs text-subtle">Portfolio contribution / bike</p><p className="mt-1 text-xl">{fmt(total.units ? rows.reduce((s, r) => s + r.gp, 0) / total.units : 0)}</p></div>
          <div className="rounded-md border border-border p-4"><p className="text-xs text-subtle">Cash risk</p><p className="mt-1 text-xl">{low.cash < 0 ? "Gap" : "Covered"}</p></div>
        </div>
        <p className="mt-4 rounded-md border border-border bg-surface p-4 text-sm leading-6 text-muted">{interpretation}</p>
      </Panel>

      <Panel title="Scenario reference" kicker="Controlled baseline cases">
        <div className="overflow-x-auto"><table className="w-full min-w-[52rem] text-left text-sm"><thead className="text-[11px] uppercase tracking-[0.14em] text-subtle"><tr><th className="py-2 pr-4">Scenario</th><th className="py-2 pr-4">Probability</th><th className="py-2 pr-4">Units</th><th className="py-2 pr-4">Revenue</th><th className="py-2 pr-4">Funding</th><th className="py-2">Min cash</th></tr></thead><tbody>{SCENARIO_SNAPSHOTS.map((s) => <tr key={s.id} className="border-t border-border"><td className="py-3 pr-4 text-fg">{s.label}</td><td className="py-3 pr-4">{s.probability}</td><td className="py-3 pr-4">{s.units}</td><td className="py-3 pr-4">{fmt(s.revenueLakh)}</td><td className="py-3 pr-4">{fmt(s.fundingLakh)}</td><td className="py-3">{fmt(s.minimumCashLakh)} · M{s.minimumCashMonth}</td></tr>)}</tbody></table></div>
      </Panel>

      <Panel title="Funding gates" kicker="Capital released against evidence">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{FINANCE_GATES.map((gate) => <div key={gate.id} className="rounded-md bg-surface p-4"><div className="flex justify-between gap-3 text-xs text-subtle"><span>{gate.id}</span><span>{gate.month}</span></div><p className="mt-2 text-sm text-fg">{gate.title}</p><p className="mt-1 text-xs text-muted">{gate.evidence}</p></div>)}</div>
      </Panel>

      <Panel title="Monthly control detail" kicker="36 months · selected portfolio case">
        <div className="overflow-x-auto"><table className="w-full min-w-[68rem] text-left text-xs"><thead className="text-[10px] uppercase tracking-[0.12em] text-subtle"><tr><th className="py-2 pr-3">M</th><th className="py-2 pr-3">Units</th><th className="py-2 pr-3">Al</th><th className="py-2 pr-3">Carbon</th><th className="py-2 pr-3">Premium</th><th className="py-2 pr-3">Revenue</th><th className="py-2 pr-3">COGS</th><th className="py-2 pr-3">Opex</th><th className="py-2 pr-3">Capex</th><th className="py-2 pr-3">Funding</th><th className="py-2">Cash</th></tr></thead><tbody>{rows.map((r) => <tr key={r.m} className="border-t border-border"><td className="py-2 pr-3">M{r.m}</td><td className="py-2 pr-3">{r.units}</td><td className="py-2 pr-3">{r.aluminiumUnits}</td><td className="py-2 pr-3">{r.carbonUnits}</td><td className="py-2 pr-3">{r.premiumCarbonUnits}</td><td className="py-2 pr-3">{fmt(r.revenue)}</td><td className="py-2 pr-3">{fmt(r.cogs)}</td><td className="py-2 pr-3">{fmt(r.opex)}</td><td className="py-2 pr-3">{fmt(r.capex)}</td><td className="py-2 pr-3">{fmt(r.funding)}</td><td className="py-2">{fmt(r.closing)}</td></tr>)}</tbody></table></div>
      </Panel>
    </div>
  );
}
