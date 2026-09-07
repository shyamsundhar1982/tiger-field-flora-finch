import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { FinanceVisual } from "@/components/finance-visual";
import { buildModelWithInputs, totals, type ScenarioId } from "@/lib/finance/model";
import { accountingTotals, buildAccountingModel } from "@/lib/finance/accounting";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/financial-cockpit")({ component: FinancialCockpit });

const money = (n: number, digits = 1) => `₹${n.toFixed(digits)}L`;
const scenarios: { id: ScenarioId; label: string }[] = [
  { id: "base", label: "Base" },
  { id: "delayed", label: "Delayed" },
  { id: "stress", label: "Stress" },
];

function FinancialCockpit() {
  const scenario = useVeloxis((s) => s.scenario);
  const setScenario = useVeloxis((s) => s.setScenario);
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const setDrawStandby = useVeloxis((s) => s.setDrawStandby);
  const finance = useVeloxis((s) => s.finance);
  const accounting = useVeloxis((s) => s.accounting);

  const rows = useMemo(() => buildModelWithInputs(scenario, drawStandby, finance), [scenario, drawStandby, finance]);
  const stressRows = useMemo(() => buildModelWithInputs("stress", drawStandby, finance), [drawStandby, finance]);
  const accountingRows = useMemo(() => buildAccountingModel(rows, accounting), [rows, accounting]);
  const stressAccountingRows = useMemo(() => buildAccountingModel(stressRows, accounting), [stressRows, accounting]);
  const t = totals(rows);
  const at = accountingTotals(accountingRows);
  const last = rows.at(-1)!;
  const grossProfit = at.grossProfit;
  const totalCogs = at.cogs;
  const totalCapex = at.investingCashFlow * -1;
  const totalInventoryBuy = at.purchases;
  const runwayIndex = accountingRows.findIndex((r) => r.closingCash < 0);
  const runway = runwayIndex < 0 ? accountingRows.length : runwayIndex;
  const breakEven = accountingRows.find((r) => r.ebitda >= 0)?.m ?? null;
  const troughRow = accountingRows.reduce((min, r) => (r.closingCash < min.closingCash ? r : min), accountingRows[0]);
  const stressTrough = stressAccountingRows.reduce((min, r) => (r.closingCash < min.closingCash ? r : min), stressAccountingRows[0]);
  const cashFloor = 15;
  const fundingBuffer = Math.max(0, cashFloor - troughRow.closingCash);
  const operatingOutflow = at.opex + totalCapex + totalInventoryBuy;
  const m12 = rows[11];
  const m18 = rows[17];
  const m24 = rows[23];
  const productUnits = {
    aluminium: rows.reduce((s, r) => s + r.aluminiumUnits, 0),
    carbon: rows.reduce((s, r) => s + r.carbonUnits, 0),
    premium: rows.reduce((s, r) => s + r.premiumCarbonUnits, 0),
  };
  const health = troughRow.closingCash >= cashFloor ? "SAFE" : troughRow.closingCash >= 0 ? "WATCH" : "FUNDING GAP";
  const healthTone = health === "SAFE" ? "ok" : health === "WATCH" ? "warn" : "danger";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Finance · executive financial control · 36M</p>
          <h1 className="mt-1 font-display text-4xl text-accent">Finance</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">One executive view of liquidity, funding, break-even and runway. Revenue, COGS and operating drivers remain visible in the money chain; assumptions, cash, balance sheet, CA audit and scenarios stay in the Finance tabs.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <Link to="/command/finance-assumptions" className="text-accent hover:text-fg">
            Edit assumptions →
          </Link>
          <Link to="/command/inventory" className="text-accent hover:text-fg">
            Inventory →
          </Link>
          <Link to="/command/procurement" className="text-accent hover:text-fg">
            Procurement →
          </Link>
        </div>
      </header>

      <div className="rounded-xl border border-border bg-surface/40 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-green">Live scenario</span>
            {scenarios.map((item) => (
              <button key={item.id} type="button" onClick={() => setScenario(item.id)} className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${scenario === item.id ? "border-accent bg-accent text-accent-fg" : "border-border text-muted hover:border-accent/40 hover:text-fg"}`}>
                {item.label}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={drawStandby} onChange={(e) => setDrawStandby(e.target.checked)} className="accent-current" />
            Include standby funding
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface/35 p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-green">Executive status</p>
            <div className="mt-1 flex items-baseline gap-3">
              <h2 className="font-display text-3xl text-accent">{health}</h2>
              <span className="text-sm text-muted">{scenario} plan · M1–M36</span>
            </div>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-muted">Status and runway use timed accounting cash after receivables, payables, tax and GST settlement. The operating chart remains linked to the same live planning inputs.</p>
          </div>
          <div className={`rounded-lg border px-4 py-3 text-right ${healthTone === "ok" ? "border-ok/40" : healthTone === "warn" ? "border-warn/40" : "border-danger/40"}`}>
            <p className="text-[10px] uppercase tracking-[0.14em] text-green">Accounting cash trough</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${healthTone === "ok" ? "text-ok" : healthTone === "warn" ? "text-warn" : "text-danger"}`}>{money(troughRow.closingCash)}</p>
            <p className="text-xs text-muted">
              Month {troughRow.m} · floor {money(cashFloor)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Cash trough" value={money(troughRow.closingCash)} hint={`M${troughRow.m} · floor ${money(cashFloor)}`} tone={healthTone} />
        <Kpi label="Planned funding" value={money(at.financingCashFlow)} hint="Scheduled financing inflows" />
        <Kpi label="Break-even" value={breakEven ? `M${breakEven}` : "Not reached"} hint="EBITDA ≥ 0" tone={breakEven ? "ok" : "warn"} />
        <Kpi label="Runway" value={`${runway.toFixed(1)} mo`} hint={runwayIndex < 0 ? "No modeled cash breach" : `Cash breach M${accountingRows[runwayIndex].m}`} tone={runway >= 12 ? "ok" : runway >= 6 ? "warn" : "danger"} />
      </div>

      <Panel title="The money chain" kicker="Cause → effect">
        <div className="grid gap-2 md:grid-cols-7">
          {[
            ["01", "Units", `${t.units}`],
            ["02", "Revenue", money(at.revenue)],
            ["03", "COGS", money(totalCogs)],
            ["04", "Gross profit", money(grossProfit)],
            ["05", "Outflow", money(operatingOutflow)],
            ["06", "Funding", money(at.financingCashFlow)],
            ["07", "Cash trough", money(troughRow.closingCash)],
          ].map(([n, label, value], i) => (
            <div key={label} className="relative rounded-lg border border-border bg-surface p-3">
              {i < 6 ? <span className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-subtle lg:block">→</span> : null}
              <span className="text-[10px] text-accent">{n}</span>
              <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-green">{label}</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-fg">{value}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted">ASP × mix × units creates revenue. Revenue less COGS creates gross profit. Opex, capex and inventory purchases consume cash. Funding changes liquidity; it does not improve operating margin.</p>
      </Panel>

      <FinanceVisual rows={rows} title="36-month financial trajectory" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Management checkpoints" kicker="What should be true by each phase">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-subtle">
                  <th className="pb-2 font-normal">Checkpoint</th>
                  <th className="pb-2 font-normal">Units</th>
                  <th className="pb-2 font-normal">Revenue</th>
                  <th className="pb-2 font-normal">Closing cash</th>
                  <th className="pb-2 font-normal">Inventory</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["M12", m12],
                  ["M18", m18],
                  ["M24", m24],
                  ["M36", last],
                ].map(([label, r]) => (
                  <tr key={label as string} className="border-b border-border last:border-0">
                    <td className="py-3 font-medium text-fg">{String(label)}</td>
                    <td className="py-3 tabular-nums">{(r as typeof last).units}</td>
                    <td className="py-3 tabular-nums">{money((r as typeof last).revenue)}</td>
                    <td className={`py-3 tabular-nums ${(accountingRows[(r as typeof last).m - 1]?.closingCash ?? 0) < cashFloor ? "text-warn" : "text-fg"}`}>{money(accountingRows[(r as typeof last).m - 1]?.closingCash ?? 0)}</td>
                    <td className="py-3 tabular-nums">{money((r as typeof last).inventory)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Portfolio volumetrics" kicker="Units behind the financial result">
          <div className="space-y-3">
            {[
              ["Aluminium", productUnits.aluminium],
              ["Carbon", productUnits.carbon],
              ["Premium Carbon", productUnits.premium],
            ].map(([label, units]) => {
              const n = Number(units);
              const share = t.units ? (n / t.units) * 100 : 0;
              return (
                <div key={label as string}>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">{label}</span>
                    <span className="tabular-nums text-fg">
                      {n} · {share.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, share)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-green">Accounting purchases</p>
              <p className="mt-1 text-lg tabular-nums text-fg">{money(totalInventoryBuy)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-green">Capex</p>
              <p className="mt-1 text-lg tabular-nums text-fg">{money(totalCapex)}</p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Funding decision" kicker="Liquidity guardrail">
          <p className="text-sm text-muted">
            To preserve a <span className="text-fg">₹{cashFloor}L</span> management floor at the accounting cash trough:
          </p>
          <p className="mt-2 font-display text-2xl text-fg">{fundingBuffer > 0 ? `${money(fundingBuffer)} buffer` : "No extra buffer"}</p>
          <p className="mt-1 text-xs text-muted">
            Current planned funding: {money(at.financingCashFlow)}. Stress trough: {money(stressTrough.closingCash)}.
          </p>
          <Link to="/command/cash" className="mt-4 inline-block text-sm text-accent hover:text-fg">
            Open cash & working capital →
          </Link>
        </Panel>
        <Panel title="Operating levers" kicker="Change once, see everywhere">
          <div className="space-y-2 text-sm">
            <Link className="block rounded-lg border border-border p-3 hover:border-accent" to="/command/finance-assumptions">
              ASP · COGS · volume · mix · launch
            </Link>
            <Link className="block rounded-lg border border-border p-3 hover:border-accent" to="/command/production">
              Production · units · inventory draw
            </Link>
            <Link className="block rounded-lg border border-border p-3 hover:border-accent" to="/command/sales">
              Sales · revenue · sell-through
            </Link>
          </div>
        </Panel>
        <Panel title="Executive drill-down" kicker="Follow the chain">
          <div className="space-y-2 text-sm">
            <Link className="block rounded-lg border border-border p-3 hover:border-accent" to="/command/finance-control">
              Finance Control · plan / forecast / actual
            </Link>
            <Link className="block rounded-lg border border-border p-3 hover:border-accent" to="/command/scenarios">
              Scenarios · compare outcomes
            </Link>
            <Link className="block rounded-lg border border-border p-3 hover:border-accent" to="/command/aluminium-finance">
              Aluminium · dedicated vertical
            </Link>
          </div>
        </Panel>
      </div>

      <div className="rounded-xl border border-border bg-surface/35 p-4 text-xs leading-5 text-muted">
        <span className="font-semibold text-green">Decision rule:</span> use Finance for direction, assumptions for changing the plan, operations pages for execution, and Finance Control for plan / forecast / actual review. Accounting cash drives liquidity signals; actual accounting, tax, GST and statutory reporting still require CA reconciliation.
      </div>
    </div>
  );
}
