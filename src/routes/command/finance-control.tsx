import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { FINANCE_CONTROL, FINANCE_GATES, MONTHLY_CASH_PLAN, SCENARIO_SNAPSHOTS } from "@/lib/data/finance-control";

export const Route = createFileRoute("/command/finance-control")({ component: FinanceControl });

const fmt = (n: number) => `₹${n.toFixed(1)}L`;

function FinanceControl() {
  const base = SCENARIO_SNAPSHOTS.find((s) => s.id === "base")!;
  const delayed = SCENARIO_SNAPSHOTS.find((s) => s.id === "delayed")!;
  const stress = SCENARIO_SNAPSHOTS.find((s) => s.id === "stress")!;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Stage 4 · Financial control</p>
        <h1 className="font-display text-4xl">Finance Control</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          A 36-month operating view linking burn, revenue, COGS, inventory, development, tooling, funding and runway to execution gates.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link to="/command/balance-sheet" className="rounded-md border border-border px-3 py-2 text-muted hover:bg-surface hover:text-fg">Balance Sheet</Link>
          <Link to="/command/ca-audit" className="rounded-md border border-border px-3 py-2 text-muted hover:bg-surface hover:text-fg">CA Verification / Audit</Link>
          <Link to="/command/investor-pitch" className="rounded-md border border-border px-3 py-2 text-muted hover:bg-surface hover:text-fg">Investor Pitch</Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Planning ASP" value={fmt(FINANCE_CONTROL.planningAspLakh)} hint="Blended planning assumption" />
        <Kpi label="Planning COGS" value={fmt(FINANCE_CONTROL.planningCogsLakh)} hint="Per unit planning assumption" />
        <Kpi label="Gross margin" value={`${FINANCE_CONTROL.planningGrossMarginPct.toFixed(1)}%`} hint="Before operating costs" />
        <Kpi label="Funding ladder" value="₹15L → ₹2Cr" hint="Evidence-led staged capital" />
      </div>

      <Panel title="Scenario control" kicker="36-month model">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="py-2 pr-4">Scenario</th><th className="py-2 pr-4">Probability</th><th className="py-2 pr-4">Units</th><th className="py-2 pr-4">Revenue</th><th className="py-2 pr-4">Funding</th><th className="py-2 pr-4">EBITDA</th><th className="py-2">Min cash</th>
              </tr>
            </thead>
            <tbody>
              {SCENARIO_SNAPSHOTS.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-3 pr-4 text-fg">{s.label}</td><td className="py-3 pr-4">{s.probability}</td><td className="py-3 pr-4">{s.units}</td><td className="py-3 pr-4">{fmt(s.revenueLakh)}</td><td className="py-3 pr-4">{fmt(s.fundingLakh)}</td><td className="py-3 pr-4">{fmt(s.ebitdaLakh)}</td><td className="py-3">{fmt(s.minimumCashLakh)} · M{s.minimumCashMonth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted">Base: grants on time / first-pass prototype / M12 launch. Delayed: 4–6 month grant slip / one prototype iteration. Stress: no grants / OEM +20% / M18 launch / Core-only.</p>
      </Panel>

      <Panel title="Funding gates" kicker="Capital released against evidence">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {FINANCE_GATES.map((gate) => (
            <div key={gate.id} className="rounded-md bg-surface p-4">
              <div className="flex justify-between gap-3 text-xs text-subtle"><span>{gate.id}</span><span>{gate.month}</span></div>
              <p className="mt-2 text-sm text-fg">{gate.title}</p>
              <p className="mt-1 text-xs text-muted">{gate.evidence}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="36-month cash plan" kicker="Base / delayed / stress">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[0.12em] text-subtle">
              <tr><th className="py-2 pr-3">Scenario</th><th className="py-2 pr-3">M</th><th className="py-2 pr-3">Units</th><th className="py-2 pr-3">Revenue</th><th className="py-2 pr-3">COGS</th><th className="py-2 pr-3">Opex</th><th className="py-2 pr-3">Capex</th><th className="py-2 pr-3">Inventory</th><th className="py-2 pr-3">Funding</th><th className="py-2">Closing cash</th></tr>
            </thead>
            <tbody>
              {MONTHLY_CASH_PLAN.map((r) => (
                <tr key={`${r.scenario}-${r.month}`} className="border-t border-border">
                  <td className="py-2 pr-3">{r.scenario}</td><td className="py-2 pr-3">M{r.month}</td><td className="py-2 pr-3">{r.units}</td><td className="py-2 pr-3">{fmt(r.revenueLakh)}</td><td className="py-2 pr-3">{fmt(r.cogsLakh)}</td><td className="py-2 pr-3">{fmt(r.opexLakh)}</td><td className="py-2 pr-3">{fmt(r.capexLakh)}</td><td className="py-2 pr-3">{fmt(r.inventoryBuyLakh)}</td><td className="py-2 pr-3">{fmt(r.fundingLakh)}</td><td className="py-2">{fmt(r.closingCashLakh)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Breakeven markers" kicker="Planning markers, not forecasts">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md bg-surface p-4"><p className="text-xs text-subtle">Early contribution breakeven</p><p className="mt-1 font-display text-2xl">M{FINANCE_CONTROL.earlyBreakevenMonth}</p><p className="mt-1 text-xs text-muted">Current planning marker from the finance model.</p></div>
          <div className="rounded-md bg-surface p-4"><p className="text-xs text-subtle">Scale breakeven</p><p className="mt-1 font-display text-2xl">M{FINANCE_CONTROL.scaleBreakevenMonth}</p><p className="mt-1 text-xs text-muted">Now inside the 36-month operating horizon.</p></div>
        </div>
      </Panel>

      <div className="text-xs text-muted">Model control note: {base.label} / {delayed.label} / {stress.label} are planning scenarios. Validate assumptions with the CA before statutory use.</div>
    </div>
  );
}
