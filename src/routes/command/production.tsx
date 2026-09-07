import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { buildAccountingModel } from "@/lib/finance/accounting";
import { buildModelWithInputs, type ScenarioId } from "@/lib/finance/model";
import { lakh } from "@/lib/format";
import { MANUFACTURING_CONTROLS, MANUFACTURING_GATES } from "@/lib/data/manufacturing-control";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/production")({ component: ProductionPlanning });

function ProductionPlanning() {
  const scenario = useVeloxis((state) => state.scenario) as ScenarioId;
  const drawStandby = useVeloxis((state) => state.drawStandby);
  const finance = useVeloxis((state) => state.finance);
  const accounting = useVeloxis((state) => state.accounting);
  const updateGlobalFinance = useVeloxis((state) => state.updateGlobalFinance);

  const rows = useMemo(() => buildModelWithInputs(scenario, drawStandby, finance), [scenario, drawStandby, finance]);
  const accountingRows = useMemo(() => buildAccountingModel(rows, accounting), [rows, accounting]);
  const trough = accountingRows.reduce((minimum, row) => row.closingCash < minimum.closingCash ? row : minimum, accountingRows[0]);
  const productionRows = rows.filter((row) => row.units > 0).slice(0, 12);
  const firstProduction = productionRows[0];
  const totalUnits = rows.reduce((sum, row) => sum + row.units, 0);
  const aluminiumUnits = rows.reduce((sum, row) => sum + row.aluminiumUnits, 0);
  const carbonUnits = rows.reduce((sum, row) => sum + row.carbonUnits, 0);
  const premiumUnits = rows.reduce((sum, row) => sum + row.premiumCarbonUnits, 0);
  const pending = MANUFACTURING_CONTROLS.filter((control) => control.status === "pending").length;
  const verify = MANUFACTURING_CONTROLS.filter((control) => control.status === "verify").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Operations · production → cash</p>
          <h1 className="mt-1 font-display text-4xl">Production planning</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Translate the approved plan and committed orders into production demand. Physical inventory is a separate operating truth and may legitimately be zero; zero stock creates shortages, not hidden job cards.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/command/production-jobcards" className="rounded-lg border border-accent bg-accent/5 px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent/10">
            Production Job Cards →
          </Link>
          <Link to="/command/operations" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted hover:border-accent">
            Operations & procurement
          </Link>
          <Link to="/command/manufacturing" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted hover:border-accent">
            Manufacturing controls
          </Link>
        </div>
      </div>

      <Panel title="Production job-card window" kicker="Committed order execution · independent of stock availability">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-fg">Job cards remain visible even when physical inventory is 0.</p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted">
              A confirmed Commercial order with one approved exact-variant BOM creates the Production job card. With no physical stock, component lines correctly show Physical 0 · Reserved 0 · ATP 0 and Shortage equal to the required quantity. That committed shortage then feeds Procurement.
            </p>
          </div>
          <Link to="/command/production-jobcards" className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg">
            Open Job Cards
          </Link>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="36-mo planned units" value={String(totalUnits)} hint={`${scenario} scenario`} />
        <Kpi label="Carbon" value={String(carbonUnits)} hint="Core portfolio" />
        <Kpi label="Aluminium" value={String(aluminiumUnits)} hint="Vertical" />
        <Kpi label="Premium Carbon" value={String(premiumUnits)} hint="Premium portfolio" />
        <Kpi label="Accounting cash trough" value={lakh(trough.closingCash)} hint={`M${trough.m}`} tone={trough.closingCash < 0 ? "danger" : trough.closingCash < 15 ? "warn" : "ok"} />
      </div>

      <Panel title="Production volume control" kicker="Shared with finance">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px] lg:items-end">
          <div>
            <p className="text-sm font-semibold text-fg">Portfolio production multiplier</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
              Change this once here; the unit plan, revenue, COGS, inventory draw and cash trajectory recalculate everywhere the shared finance model is used.
            </p>
          </div>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-subtle">Multiplier</span>
            <input
              type="number"
              min="0"
              max="5"
              step="0.05"
              value={finance.unitMultiplier}
              onChange={(event) => updateGlobalFinance("unitMultiplier", Math.max(0, Math.min(5, Number(event.target.value) || 0)))}
              className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-right tabular-nums text-fg outline-none focus:border-accent"
            />
          </label>
        </div>
      </Panel>

      <Panel title="Production ramp" kicker="Monthly plan · units / ₹ L">
        {productionRows.length === 0 ? (
          <p className="text-sm text-muted">No production is scheduled under the current assumptions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle">
                <tr>
                  <th className="px-3 py-3 text-left">Month</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3 text-right">Aluminium</th>
                  <th className="px-3 py-3 text-right">Carbon</th>
                  <th className="px-3 py-3 text-right">Premium</th>
                  <th className="px-3 py-3 text-right">Revenue</th>
                  <th className="px-3 py-3 text-right">COGS</th>
                  <th className="px-3 py-3 text-right">Inventory buy</th>
                  <th className="px-3 py-3 text-right">Accounting cash</th>
                </tr>
              </thead>
              <tbody>
                {productionRows.map((row) => (
                  <tr key={row.m} className="border-t border-border/70">
                    <td className="px-3 py-3 font-semibold text-fg">M{row.m}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{row.units}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{row.aluminiumUnits}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{row.carbonUnits}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{row.premiumCarbonUnits}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{lakh(row.revenue)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{lakh(row.cogs)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-accent">{lakh(row.inventoryBuy)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{lakh(accountingRows[row.m - 1]?.closingCash ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] leading-5 text-subtle">
          First planned production: {firstProduction ? `M${firstProduction.m}` : "not scheduled"}. Product launch months and mix remain controlled in Plan & Assumptions.
        </p>
      </Panel>

      <Panel title="Production → cash" kicker="No hidden jumps">
        <div className="grid gap-3 md:grid-cols-5">
          {[
            ["01", "Launch", "Product becomes active"],
            ["02", "Build", "Units follow portfolio mix"],
            ["03", "Consume", "COGS and inventory move only when stock is physically issued"],
            ["04", "Sell", "Units create revenue and gross profit"],
            ["05", "Cash", "Accounting timing changes the cash trough"],
          ].map(([number, title, note]) => (
            <div key={number} className="rounded-xl border border-border bg-bg-elevated/40 p-4">
              <span className="text-[10px] font-bold tracking-[0.16em] text-accent">{number}</span>
              <p className="mt-2 text-sm font-semibold text-fg">{title}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{note}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Manufacturing readiness" kicker="Production cannot outrun controls">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-bg-elevated/40 p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">Evidence pending</p><p className="mt-2 text-3xl tabular-nums">{pending}</p></div>
          <div className="rounded-xl border border-border bg-bg-elevated/40 p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">Verification</p><p className="mt-2 text-3xl tabular-nums">{verify}</p></div>
          <div className="rounded-xl border border-border bg-bg-elevated/40 p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">Release gates</p><p className="mt-2 text-3xl tabular-nums">{MANUFACTURING_GATES.length}</p></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/command/production-jobcards" className="rounded-lg border border-accent px-3 py-2 text-xs font-semibold text-accent">Production Job Cards</Link>
          <Link to="/command/manufacturing" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Review controls</Link>
          <Link to="/command/inventory" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Master Inventory</Link>
          <Link to="/command/finance-assumptions" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Adjust assumptions</Link>
        </div>
      </Panel>
    </div>
  );
}
