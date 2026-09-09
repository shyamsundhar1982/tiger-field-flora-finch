import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { accountingTotals, buildAccountingModel } from "@/lib/finance/accounting";
import { buildModelWithInputs, type ScenarioId } from "@/lib/finance/model";
import { lakh } from "@/lib/format";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/cash")({ component: CashPlanning });

function CashPlanning() {
  const scenario = useVeloxis((s) => s.scenario) as ScenarioId;
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const finance = useVeloxis((s) => s.finance);
  const accounting = useVeloxis((s) => s.accounting);
  const planning = useMemo(
    () => buildModelWithInputs(scenario, drawStandby, finance),
    [scenario, drawStandby, finance],
  );
  const rows = useMemo(
    () => buildAccountingModel(planning, accounting),
    [planning, accounting],
  );
  const totals = useMemo(() => accountingTotals(rows), [rows]);
  const [minimumCash, setMinimumCash] = useState(10);

  const trough = rows.reduce(
    (lowest, row) => row.closingCash < lowest.cash ? { m: row.m, cash: row.closingCash } : lowest,
    { m: 0, cash: Number.POSITIVE_INFINITY },
  );
  const troughCash = Number.isFinite(trough.cash) ? trough.cash : 0;
  const belowPolicy = rows.filter((row) => row.closingCash < minimumCash);
  const policyGap = belowPolicy.length
    ? Math.max(0, minimumCash - Math.min(...belowPolicy.map((row) => row.closingCash)))
    : 0;
  const runway = rows.findIndex((row) => row.closingCash <= 0);
  const runwayLabel = runway >= 0 ? `M${rows[runway].m}` : "36M+";
  const last = rows.at(-1);

  const totalCollections = rows.reduce((sum, row) => sum + row.salesCollections, 0);
  const totalSupplierPayments = rows.reduce((sum, row) => sum + row.supplierPayments, 0);
  const totalTax = rows.reduce((sum, row) => sum + row.tax, 0);
  const totalGstSettlement = rows.reduce((sum, row) => sum + row.gstSettlement, 0);
  const totalFunding = rows.reduce((sum, row) => sum + row.funding, 0);
  const totalCapex = rows.reduce((sum, row) => sum + row.capex, 0);
  const uses = totalSupplierPayments + totals.opex + totalTax + totalGstSettlement + totalCapex;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Finance · treasury projection</p>
          <h1 className="mt-1 font-display text-4xl">Cash & working capital</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Cash is derived from the same accounting layer as the Financial Statements. Sales are collected on configured terms; supplier purchases, tax, GST settlement, capex and funding are timed separately.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/command/finance-assumptions" className="rounded-lg border border-accent px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent/10">Edit assumptions</Link>
          <Link to="/command/balance-sheet" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:border-accent">Financial statements</Link>
          <Link to="/command/inventory-truth" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:border-accent">Inventory truth</Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi label="Cash trough" value={lakh(troughCash)} hint={trough.m ? `M${trough.m}` : "No model rows"} tone={troughCash < 0 ? "danger" : troughCash < minimumCash ? "warn" : "ok"} />
        <Kpi label="36-mo collections" value={lakh(totalCollections, 0)} hint={`${accounting.collectionDays ?? accounting.collectionMonths * 30} day customer terms`} />
        <Kpi label="Supplier payments" value={lakh(totalSupplierPayments, 0)} hint={`${accounting.supplierPaymentDays ?? accounting.supplierCreditMonths * 30} day supplier terms`} />
        <Kpi label="Tax + GST paid" value={lakh(totalTax + totalGstSettlement, 0)} hint={`Tax ${accounting.taxRatePct}% · GST ${accounting.gstRatePct}%`} tone={(accounting.taxRatePct === 0 || accounting.gstRatePct === 0) ? "warn" : "ok"} />
        <Kpi label="Closing inventory" value={lakh(last?.inventory ?? 0)} hint="Working capital still tied up" />
        <Kpi label="Zero-cash point" value={runwayLabel} hint={runway >= 0 ? "Action required before this month" : "No zero-cash month in 36M"} tone={runway >= 0 ? "danger" : "ok"} />
      </div>

      {(accounting.taxRatePct === 0 || accounting.gstRatePct === 0) && (
        <div className="rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm leading-6 text-muted">
          <strong className="text-fg">CA input required.</strong> Tax and/or GST is currently 0%. The cash model intentionally uses that configured value; do not rely on liquidity for statutory or externally certified purposes until the applicable treatment is reviewed and entered.
        </div>
      )}

      <Panel title="Minimum cash policy" kicker="Interactive management control">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm text-muted">Set the minimum cash buffer the plan should protect. This policy changes only the warning threshold; it does not alter the accounting model.</p>
            <input aria-label="Minimum cash policy" type="range" min="0" max="40" step="1" value={minimumCash} onChange={(event) => setMinimumCash(Number(event.target.value))} className="mt-5 w-full accent-accent" />
            <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.12em] text-subtle"><span>₹0L</span><span>₹20L</span><span>₹40L</span></div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/50 px-5 py-4 text-center">
            <p className="text-[10px] uppercase tracking-[0.15em] text-subtle">Policy buffer</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-fg">{lakh(minimumCash)}</p>
            <p className={`mt-1 text-xs ${policyGap > 0 ? "text-accent" : "text-muted"}`}>{policyGap > 0 ? `Additional ₹${policyGap.toFixed(1)}L needed at trough` : "Policy protected in current plan"}</p>
          </div>
        </div>
      </Panel>

      <Panel title="36-month cash waterfall" kicker="Collections → payments → tax/GST → closing cash">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="px-3 py-3 text-left">Month</th>
                <th className="px-3 py-3 text-right">Opening</th>
                <th className="px-3 py-3 text-right">Collections</th>
                <th className="px-3 py-3 text-right">Funding</th>
                <th className="px-3 py-3 text-right">Supplier</th>
                <th className="px-3 py-3 text-right">Opex</th>
                <th className="px-3 py-3 text-right">Tax</th>
                <th className="px-3 py-3 text-right">GST</th>
                <th className="px-3 py-3 text-right">Capex</th>
                <th className="px-3 py-3 text-right">Closing</th>
              </tr>
            </thead>
            <tbody>{rows.map((row) => (
              <tr key={row.m} className={`border-t border-border/70 ${row.closingCash < minimumCash ? "bg-accent/5" : ""}`}>
                <td className="px-3 py-2.5 font-semibold">M{row.m}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{lakh(row.openingCash)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{lakh(row.salesCollections)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{lakh(row.funding)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">−{lakh(row.supplierPayments)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">−{lakh(row.opex)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">−{lakh(row.tax)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">−{lakh(row.gstSettlement)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">−{lakh(row.capex)}</td>
                <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${row.closingCash < minimumCash ? "text-accent" : ""}`}>{lakh(row.closingCash)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-subtle">This table consumes <code>buildAccountingModel()</code>, the same canonical management-accounting projection used by Financial Statements. Revenue recognition and cash collection are deliberately separate.</p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Cash uses" kicker="36-month accounting-timed outflows">
          <div className="space-y-4">{[
            ["Supplier payments", totalSupplierPayments],
            ["Operating spend", totals.opex],
            ["Capital expenditure", totalCapex],
            ["Tax", totalTax],
            ["GST settlement", totalGstSettlement],
          ].map(([label, value]) => (
            <div key={label as string}>
              <div className="flex justify-between text-sm"><span>{label as string}</span><span className="font-semibold tabular-nums">{lakh(value as number, 0)}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-accent" style={{ width: `${uses > 0 ? Math.min(100, ((value as number) / uses) * 100) : 0}%` }} /></div>
            </div>
          ))}</div>
        </Panel>
        <Panel title="Working capital bridge" kicker="AR · inventory · AP">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Receivables", last?.receivables ?? 0, "Sales not yet collected"],
              ["Inventory", last?.inventory ?? 0, "Cash tied in stock"],
              ["Payables", last?.payables ?? 0, "Supplier cash not yet paid"],
            ].map(([label, value, note]) => (
              <div key={label as string} className="rounded-xl border border-border bg-bg-elevated/40 p-4">
                <p className="text-[10px] uppercase tracking-[0.14em] text-subtle">{label as string}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{lakh(value as number)}</p>
                <p className="mt-1 text-xs text-muted">{note as string}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Cash control equation" kicker="One connected finance model">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Timed collections {lakh(totalCollections, 0)}</span><span>+</span><span>funding {lakh(totalFunding, 0)}</span><span>→</span><span>cash uses {lakh(uses, 0)}</span><span>→</span><span className="font-semibold text-fg">cash trough {lakh(troughCash)}</span>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">Accrual revenue over the horizon is {lakh(totals.revenue, 0)}; cash collections are {lakh(totalCollections, 0)}. The difference is reflected through receivables rather than being treated as immediate cash.</p>
      </Panel>
    </div>
  );
}
