import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Panel, Kpi } from "@/components/kpi";
import {
  getProcurementPlanningReport,
  setProcurementPlanningAction,
} from "@/lib/procurement-authority";
import { MSL_PLANNING_LEAD_MONTHS } from "@/lib/data/procurement-planning";
import { calendarMonthForPlanMonth } from "@/lib/planning/operating-plan";

export const Route = createFileRoute("/command/procurement-planning")({
  loader: () => getProcurementPlanningReport(),
  component: ProcurementPlanning,
});

const lakh = (n: number) => `₹${Number(n).toFixed(1)}L`;

function ProcurementPlanning() {
  const data = Route.useLoaderData();
  const [rows] = useState(data.forecast);
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  async function markAction(
    row: (typeof data.forecast)[number],
    actionType: "rfq" | "approval" | "po",
  ) {
    setActionBusy(row.month);
    setMessage("");
    try {
      await setProcurementPlanningAction({
        data: {
          planMonth: row.planningMonth,
          requirementMonth: row.requirementMonth,
          trancheId: row.tranche,
          actionType,
          status: "in_progress",
          note: `Action initiated from MSL two-month planning signal for M${row.requirementMonth}.`,
        },
      });
      setMessage(`M${row.requirementMonth}: ${actionType.toUpperCase()} marked in progress.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update planning action.");
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-green">
            Plan · supply + finance integration
          </p>
          <h1 className="mt-2 text-4xl font-bold text-accent">Procurement Planning Status</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-muted">
            Rolling 36-month procurement planning now consumes the Admin-published Operating Plan.
            Approved launch is <strong className="text-fg">M{data.plan.milestoneMonths.commercialLaunch}</strong>{" "}
            ({calendarMonthForPlanMonth(data.plan, data.plan.milestoneMonths.commercialLaunch)}). MSL signals
            activate <strong className="text-fg">{MSL_PLANNING_LEAD_MONTHS} months before</strong> the
            requirement month so Operations can act early without moving the modeled cash-impact month.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/command/procurement"
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted hover:text-accent"
          >
            Live MSL queue
          </Link>
          <Link
            to="/command/planning"
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted hover:text-accent"
          >
            Planning Studio
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        <Kpi label="Planning horizon" value="36 mo" hint="Rolling M1 → M36" />
        <Kpi label="MSL lead time" value="2 mo" hint="Early planning fence" />
        <Kpi
          label="Planned procurement"
          value={lakh(data.summary.totalProcurementLakh)}
          hint="Published base plan"
        />
        <Kpi
          label="Procurement months"
          value={String(data.summary.procurementMonths)}
          hint="Non-zero planned buy"
        />
      </div>

      {message ? (
        <div className="mt-5 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          {message}
        </div>
      ) : null}

      <Panel
        title="36-month procurement forecast"
        kicker="Approved demand → MSL planning signal → financial impact"
        className="mt-6"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="px-3 py-3">Req.</th>
                <th className="px-3 py-3">Plan action</th>
                <th className="px-3 py-3">Funding / cash</th>
                <th className="px-3 py-3">Units</th>
                <th className="px-3 py-3">Longitude / Latitude / Altitude</th>
                <th className="px-3 py-3">Procurement</th>
                <th className="px-3 py-3">Cash month</th>
                <th className="px-3 py-3">Signal</th>
                <th className="px-3 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.month} className="border-t border-border/70">
                  <td className="px-3 py-3 font-semibold">M{row.requirementMonth}</td>
                  <td className="px-3 py-3 text-accent">M{row.planningMonth}</td>
                  <td className="px-3 py-3">
                    <span className="font-semibold">{row.tranche}</span>
                    <span className="ml-1 text-xs text-subtle">{row.trancheName}</span>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{row.units}</td>
                  <td className="px-3 py-3 text-xs tabular-nums">
                    {row.coreUnits} / {row.proUnits} / {row.apexUnits}
                  </td>
                  <td className="px-3 py-3 tabular-nums font-semibold">
                    {row.procurementLakh ? lakh(row.procurementLakh) : "—"}
                  </td>
                  <td className="px-3 py-3 text-xs">M{row.financialImpactMonth}</td>
                  <td className="px-3 py-3 text-xs font-semibold uppercase">{row.trigger}</td>
                  <td className="px-3 py-3">
                    {row.procurementLakh > 0 ? (
                      <div className="flex gap-2">
                        <button
                          disabled={actionBusy === row.month}
                          onClick={() => markAction(row, "rfq")}
                          className="text-xs font-semibold text-accent disabled:opacity-50"
                        >
                          RFQ
                        </button>
                        <button
                          disabled={actionBusy === row.month}
                          onClick={() => markAction(row, "approval")}
                          className="text-xs font-semibold text-muted disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          disabled={actionBusy === row.month}
                          onClick={() => markAction(row, "po")}
                          className="text-xs font-semibold text-muted disabled:opacity-50"
                        >
                          PO
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-subtle">Monitor</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs leading-5 text-muted">
          The forecast consumes the published plan rather than inventing a second production schedule.
          Procurement spend remains represented in the financial forecast; the MSL planning fence changes
          when Operations acts, not when the modeled purchase affects cash.
        </p>
      </Panel>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Current stock status" kicker="Existing EPR stock control source · MSL exceptions">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle">
                <tr>
                  <th className="px-2 py-2">SKU</th>
                  <th className="px-2 py-2">Venture</th>
                  <th className="px-2 py-2">On hand</th>
                  <th className="px-2 py-2">MSL</th>
                  <th className="px-2 py-2">Shortfall</th>
                  <th className="px-2 py-2">Lead</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.stock.slice(0, 20).map((item: any) => (
                  <tr key={`${item.venture}-${item.sku}-${item.unit}`} className="border-t border-border/70">
                    <td className="px-2 py-2 font-mono text-xs">{item.sku}</td>
                    <td className="px-2 py-2 uppercase text-xs">{item.venture}</td>
                    <td className="px-2 py-2 tabular-nums">{Number(item.quantity_balance)}</td>
                    <td className="px-2 py-2 tabular-nums">{Number(item.minimum_stock_level)}</td>
                    <td className="px-2 py-2 tabular-nums">{Number(item.shortage_quantity)}</td>
                    <td className="px-2 py-2 text-xs">{Number(item.lead_time_days)}d</td>
                    <td
                      className={`px-2 py-2 text-xs font-semibold uppercase ${
                        item.status === "critical"
                          ? "text-warn"
                          : item.status === "low"
                            ? "text-accent"
                            : "text-green"
                      }`}
                    >
                      {item.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Planning → finance → procurement" kicker="Control logic">
          <div className="space-y-3 text-sm leading-6 text-muted">
            <p><strong className="text-fg">1. Demand:</strong> published rolling-plan units are the demand signal.</p>
            <p><strong className="text-fg">2. Product mix:</strong> Longitude, Latitude and Altitude allocations come from the same finance model rows.</p>
            <p><strong className="text-fg">3. MSL fence:</strong> a requirement due in M10 raises the planning signal in M8.</p>
            <p><strong className="text-fg">4. Procurement:</strong> Operations validates supplier, MOQ, lead time, RFQ and approval before PO.</p>
            <p><strong className="text-fg">5. Finance:</strong> the purchase/receipt month remains the cash-impact month so plan changes propagate without double counting.</p>
          </div>
        </Panel>
      </div>

      <Panel title="Investor / demo reporting" kicker="Presentation-safe control view" className="mt-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-subtle">Rolling planning</p>
            <p className="mt-1 text-sm leading-5">Every procurement signal is time-phased against the published rolling M1–M36 plan.</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-subtle">Two-month action fence</p>
            <p className="mt-1 text-sm leading-5">Materials are identified before they become a cash or production emergency.</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-subtle">Execution evidence</p>
            <p className="mt-1 text-sm leading-5">RFQ, approval and PO actions remain distinguishable from forecast-only signals.</p>
          </div>
        </div>
      </Panel>
    </main>
  );
}
