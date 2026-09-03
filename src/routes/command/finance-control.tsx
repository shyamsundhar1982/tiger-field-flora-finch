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
  type ScenarioId,
} from "@/lib/finance/model";

export const Route = createFileRoute("/command/finance-control")({ component: FinanceControl });

const fmt = (n: number) => `₹${n.toFixed(1)}L`;
const pct = (n: number) => `${n.toFixed(1)}%`;

const INPUTS: Array<{
  key: keyof FinanceAssumptions;
  label: string;
  suffix: string;
  step: string;
  min: number;
  max: number;
  note: string;
}> = [
  { key: "aspLakh", label: "Blended ASP", suffix: "₹ lakh / bike", step: "0.01", min: 0.2, max: 10, note: "Change when tier pricing or product mix changes." },
  { key: "cogsLakh", label: "COGS", suffix: "₹ lakh / bike", step: "0.01", min: 0.1, max: 8, note: "Supplier-backed unit cost, before operating overhead." },
  { key: "unitMultiplier", label: "Volume factor", suffix: "× base ramp", step: "0.05", min: 0.25, max: 2, note: "1.00 = current conservative 36-month ramp." },
  { key: "opexMultiplier", label: "Operating cost factor", suffix: "× base opex", step: "0.05", min: 0.5, max: 2, note: "Use for hiring, marketing or overhead variation." },
  { key: "capexMultiplier", label: "Capex factor", suffix: "× base capex", step: "0.05", min: 0.5, max: 2, note: "Use for tooling, equipment or development variation." },
  { key: "inventoryMultiplier", label: "Inventory factor", suffix: "× base buy", step: "0.05", min: 0.5, max: 2, note: "Use for stock-cover and procurement changes." },
  { key: "fundingMultiplier", label: "Funding factor", suffix: "× planned ladder", step: "0.05", min: 0, max: 2, note: "Stress-test smaller or larger capital availability." },
  { key: "openingCashLakh", label: "Opening cash", suffix: "₹ lakh", step: "0.5", min: 0, max: 100, note: "Cash available at M1 before the funding ladder." },
];

function FinanceControl() {
  const [scenario, setScenario] = useState<ScenarioId>("base");
  const [inputs, setInputs] = useState<FinanceAssumptions>(DEFAULT_FINANCE_ASSUMPTIONS);

  const rows = useMemo(() => buildModelWithInputs(scenario, scenario !== "base", inputs), [scenario, inputs]);
  const total = useMemo(() => totals(rows), [rows]);
  const low = useMemo(() => minCash(rows), [rows]);
  const margin = inputs.aspLakh > 0 ? ((inputs.aspLakh - inputs.cogsLakh) / inputs.aspLakh) * 100 : 0;
  const baseRows = useMemo(() => buildModelWithInputs(scenario, scenario !== "base", DEFAULT_FINANCE_ASSUMPTIONS), [scenario]);
  const baseTotal = useMemo(() => totals(baseRows), [baseRows]);
  const revenueDelta = baseTotal.revenue ? ((total.revenue - baseTotal.revenue) / baseTotal.revenue) * 100 : 0;

  const annual = [1, 2, 3].map((year) => {
    const slice = rows.slice((year - 1) * 12, year * 12);
    return {
      year,
      units: slice.reduce((s, r) => s + r.units, 0),
      revenue: slice.reduce((s, r) => s + r.revenue, 0),
      ebitda: slice.reduce((s, r) => s + r.ebitda, 0),
      closing: slice.at(-1)?.closing ?? 0,
    };
  });
  const maxRevenue = Math.max(...annual.map((a) => a.revenue), 1);
  const maxAbsEbitda = Math.max(...annual.map((a) => Math.abs(a.ebitda)), 1);

  const updateInput = (key: keyof FinanceAssumptions, value: string) => {
    const n = Number(value);
    if (Number.isFinite(n)) setInputs((current) => ({ ...current, [key]: n }));
  };

  const interpretation = low.cash < 0
    ? `The current inputs create a cash shortfall of ${fmt(Math.abs(low.cash))} at M${low.m}. Reduce burn/capex, improve contribution margin, increase volume, or add funding before treating the plan as executable.`
    : revenueDelta > 5
      ? `Revenue is ${pct(revenueDelta)} above the scenario baseline. Check whether production capacity, working capital and supplier lead times can support that increase.`
      : revenueDelta < -5
        ? `Revenue is ${pct(Math.abs(revenueDelta))} below the scenario baseline. The model remains useful, but the lower-volume case should be matched with a smaller capital draw and operating footprint.`
        : `The current variation stays close to the scenario baseline. The main control points are contribution margin, monthly volume and the timing of tooling / working-capital spend.`;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Stage 4 · Financial control</p>
        <h1 className="font-display text-4xl">Finance Control</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          A practical 36-month operating model. The headline totals are deliberately restrained, while the key assumptions can be changed here and immediately recalculated.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link to="/command/balance-sheet" className="rounded-md border border-border px-3 py-2 text-muted hover:bg-surface hover:text-fg">Balance Sheet</Link>
          <Link to="/command/ca-audit" className="rounded-md border border-border px-3 py-2 text-muted hover:bg-surface hover:text-fg">CA Verification / Audit</Link>
          <Link to="/command/investor-pitch" className="rounded-md border border-border px-3 py-2 text-muted hover:bg-surface hover:text-fg">Investor Pitch</Link>
        </div>
      </div>

      <Panel title="Editable planning assumptions" kicker="Management sandbox · ₹ lakh unless stated">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INPUTS.map((input) => (
            <label key={input.key} className="rounded-lg border border-border bg-surface p-4">
              <span className="block text-xs font-semibold text-fg">{input.label}</span>
              <span className="mt-1 block text-[11px] text-subtle">{input.note}</span>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={input.min}
                  max={input.max}
                  step={input.step}
                  value={inputs[input.key]}
                  onChange={(e) => updateInput(input.key, e.target.value)}
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-accent"
                />
                <span className="shrink-0 text-[10px] text-subtle">{input.suffix}</span>
              </div>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-subtle">Scenario</span>
            <select value={scenario} onChange={(e) => setScenario(e.target.value as ScenarioId)} className="rounded-md border border-border bg-bg px-3 py-2 text-fg">
              <option value="base">Base</option>
              <option value="delayed">Delayed</option>
              <option value="stress">Stress</option>
            </select>
          </label>
          <button type="button" onClick={() => setInputs(DEFAULT_FINANCE_ASSUMPTIONS)} className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg">Reset assumptions</button>
          <p className="text-xs text-muted">Changes are local to this planning screen; the controlled base case remains unchanged.</p>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Blended ASP" value={fmt(inputs.aspLakh)} hint="Editable" />
        <Kpi label="Gross margin" value={pct(margin)} hint="ASP less COGS" />
        <Kpi label="36-mo units" value={String(total.units)} hint="Current scenario" />
        <Kpi label="36-mo revenue" value={fmt(total.revenue)} hint="Not a forecast" />
        <Kpi label="Minimum cash" value={fmt(low.cash)} hint={`M${low.m}`} />
      </div>

      <Panel title="Scenario control" kicker="Reference cases using the same model engine">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-subtle"><tr><th className="py-2 pr-4">Scenario</th><th className="py-2 pr-4">Probability</th><th className="py-2 pr-4">Units</th><th className="py-2 pr-4">Revenue</th><th className="py-2 pr-4">Funding</th><th className="py-2 pr-4">EBITDA</th><th className="py-2">Min cash</th></tr></thead>
            <tbody>{SCENARIO_SNAPSHOTS.map((s) => <tr key={s.id} className="border-t border-border"><td className="py-3 pr-4 text-fg">{s.label}</td><td className="py-3 pr-4">{s.probability}</td><td className="py-3 pr-4">{s.units}</td><td className="py-3 pr-4">{fmt(s.revenueLakh)}</td><td className="py-3 pr-4">{fmt(s.fundingLakh)}</td><td className="py-3 pr-4">{fmt(s.ebitdaLakh)}</td><td className="py-3">{fmt(s.minimumCashLakh)} · M{s.minimumCashMonth}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted">Base: grants on time / first-pass prototype / M12 launch. Delayed: 4–6 month grant slip / one prototype iteration. Stress: no grants / OEM +20% / M18 launch / Core-only.</p>
      </Panel>

      <Panel title="Three-year operating view" kicker="Annual values are shown to avoid hiding the business behind one cumulative number">
        <div className="grid gap-3 lg:grid-cols-3">
          {annual.map((a) => (
            <div key={a.year} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between"><p className="text-sm font-semibold">Year {a.year}</p><p className="text-xs text-subtle">{a.units} bikes</p></div>
              <div className="mt-4 space-y-3">
                <div><div className="flex justify-between text-xs"><span className="text-subtle">Revenue</span><span>{fmt(a.revenue)}</span></div><div className="mt-1 h-2 rounded-full bg-border"><div className="h-2 rounded-full bg-accent" style={{ width: `${Math.max(3, (a.revenue / maxRevenue) * 100)}%` }} /></div></div>
                <div><div className="flex justify-between text-xs"><span className="text-subtle">EBITDA</span><span>{fmt(a.ebitda)}</span></div><div className="mt-1 h-2 rounded-full bg-border"><div className="h-2 rounded-full bg-accent/60" style={{ width: `${Math.max(3, (Math.abs(a.ebitda) / maxAbsEbitda) * 100)}%` }} /></div></div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs"><div><span className="text-subtle">Closing cash</span><p className="mt-1 text-sm">{fmt(a.closing)}</p></div><div><span className="text-subtle">Revenue / bike</span><p className="mt-1 text-sm">{a.units ? fmt(a.revenue / a.units) : "—"}</p></div></div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="What the change means" kicker="Automatic interpretation of the editable case">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border p-4"><p className="text-xs text-subtle">Revenue vs scenario baseline</p><p className="mt-1 text-xl">{pct(revenueDelta)}</p><p className="mt-1 text-xs text-muted">Based on the same 36-month scenario with default inputs.</p></div>
          <div className="rounded-md border border-border p-4"><p className="text-xs text-subtle">Gross contribution / bike</p><p className="mt-1 text-xl">{fmt(inputs.aspLakh - inputs.cogsLakh)}</p><p className="mt-1 text-xs text-muted">Before opex, capex and working capital.</p></div>
          <div className="rounded-md border border-border p-4"><p className="text-xs text-subtle">Cash risk</p><p className="mt-1 text-xl">{low.cash < 0 ? "Gap" : "Covered"}</p><p className="mt-1 text-xs text-muted">Lowest modeled closing cash occurs at M{low.m}.</p></div>
        </div>
        <p className="mt-4 rounded-md border border-border bg-surface p-4 text-sm leading-6 text-muted">{interpretation}</p>
      </Panel>

      <Panel title="Funding gates" kicker="Capital released against evidence">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{FINANCE_GATES.map((gate) => <div key={gate.id} className="rounded-md bg-surface p-4"><div className="flex justify-between gap-3 text-xs text-subtle"><span>{gate.id}</span><span>{gate.month}</span></div><p className="mt-2 text-sm text-fg">{gate.title}</p><p className="mt-1 text-xs text-muted">{gate.evidence}</p></div>)}</div>
      </Panel>

      <Panel title="Monthly control detail" kicker="36 months · selected editable scenario">
        <div className="overflow-x-auto"><table className="w-full min-w-[64rem] text-left text-xs"><thead className="text-[10px] uppercase tracking-[0.12em] text-subtle"><tr><th className="py-2 pr-3">M</th><th className="py-2 pr-3">Units</th><th className="py-2 pr-3">Revenue</th><th className="py-2 pr-3">COGS</th><th className="py-2 pr-3">Opex</th><th className="py-2 pr-3">Capex</th><th className="py-2 pr-3">Inventory</th><th className="py-2 pr-3">Funding</th><th className="py-2">Closing cash</th></tr></thead><tbody>{rows.map((r) => <tr key={r.m} className="border-t border-border"><td className="py-2 pr-3">M{r.m}</td><td className="py-2 pr-3">{r.units}</td><td className="py-2 pr-3">{fmt(r.revenue)}</td><td className="py-2 pr-3">{fmt(r.cogs)}</td><td className="py-2 pr-3">{fmt(r.opex)}</td><td className="py-2 pr-3">{fmt(r.capex)}</td><td className="py-2 pr-3">{fmt(r.inventoryBuy)}</td><td className="py-2 pr-3">{fmt(r.funding)}</td><td className="py-2">{fmt(r.closing)}</td></tr>)}</tbody></table></div>
      </Panel>

      <div className="text-xs text-muted">Control note: the model is a planning sandbox, not statutory accounting or a sales forecast. Replace assumptions with supplier quotes, actual payroll/opex, tax treatment, working-capital terms and CA-reviewed numbers as evidence arrives.</div>
    </div>
  );
}
