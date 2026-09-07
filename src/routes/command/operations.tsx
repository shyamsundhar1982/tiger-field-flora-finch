import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { getInventoryMslWarnings } from "@/lib/inventory-authority";
import { buildModelWithInputs, type ScenarioId } from "@/lib/finance/model";
import { MANUFACTURING_CONTROLS, MANUFACTURING_GATES } from "@/lib/data/manufacturing-control";
import { qualitySummary } from "@/lib/finance/quality-engine";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/operations")({
  loader: () => getInventoryMslWarnings(),
  component: SupplyProduction,
});

function SupplyProduction() {
  const warnings = Route.useLoaderData();
  const scenario = useVeloxis((s) => s.scenario) as ScenarioId;
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const finance = useVeloxis((s) => s.finance);
  const rows = useMemo(
    () => buildModelWithInputs(scenario, drawStandby, finance),
    [scenario, drawStandby, finance],
  );

  const critical = warnings.filter((item: any) => item.status === "critical").length;
  const stockAlerts = warnings.length;
  const shortage = warnings.reduce(
    (sum: number, item: any) => sum + Number(item.shortage_quantity || 0),
    0,
  );
  const openManufacturing = MANUFACTURING_CONTROLS.filter(
    (control) => control.status === "pending" || control.status === "verify",
  );
  const firstProduction = rows.find((row) => row.units > 0);
  const quality = qualitySummary();

  const attention = [
    ...warnings.slice(0, 4).map((item: any) => ({
      tone: item.status === "critical" ? "danger" : "warn",
      title: `${item.sku} · ${item.status === "critical" ? "stockout" : "below MSL"}`,
      detail: `${Number(item.quantity_balance)} on hand · MSL ${Number(item.minimum_stock_level)} · shortfall ${Number(item.shortage_quantity)}`,
      to: "/command/procurement",
    })),
    ...(openManufacturing.length
      ? [{
          tone: "warn",
          title: `${openManufacturing.length} manufacturing controls need evidence or verification`,
          detail: `${openManufacturing.slice(0, 2).map((control) => control.title).join(" · ")}${openManufacturing.length > 2 ? " · …" : ""}`,
          to: "/command/manufacturing",
        }]
      : []),
    ...(quality.openNcr
      ? [{
          tone: "warn",
          title: `${quality.openNcr} open NCR${quality.openNcr === 1 ? "" : "s"}`,
          detail: "Containment and CAPA remain part of release readiness.",
          to: "/command/quality",
        }]
      : []),
    ...(!firstProduction
      ? [{
          tone: "warn",
          title: "No production month is scheduled",
          detail: "The active plan currently has no build quantity. Review the integrated Master Plan before procurement commitments.",
          to: "/command/planning",
        }]
      : []),
  ];

  const readiness = [
    {
      area: "Procurement",
      signal: stockAlerts ? `${stockAlerts} MSL alert${stockAlerts === 1 ? "" : "s"}` : "No MSL alerts",
      status: stockAlerts ? "Attention" : "Healthy",
      rule: "Validate supplier, MOQ, lead time, price and approval before PO release.",
      to: "/command/procurement",
    },
    {
      area: "Inventory",
      signal: critical ? `${critical} stockout${critical === 1 ? "" : "s"}` : "FIFO / MSL authoritative",
      status: critical ? "Attention" : "Controlled",
      rule: "Receipts create FIFO layers; issues consume oldest available stock first.",
      to: "/command/inventory",
    },
    {
      area: "Production",
      signal: firstProduction ? `First planned build M${firstProduction.m} · ${firstProduction.units} units` : "No build scheduled",
      status: firstProduction ? "Planned" : "Attention",
      rule: "Production volume follows the shared plan; actual job execution stays separate.",
      to: "/command/production",
    },
    {
      area: "Manufacturing",
      signal: `${openManufacturing.length} controls open · ${MANUFACTURING_GATES.length} release gates`,
      status: openManufacturing.length ? "Attention" : "Ready",
      rule: "Supplier, tooling, traceability and release evidence must precede downstream gates.",
      to: "/command/manufacturing",
    },
    {
      area: "Quality",
      signal: `${quality.openNcr} open NCR · ${quality.warrantyOpen} warranty open`,
      status: quality.openNcr || quality.warrantyOpen ? "Attention" : "Healthy",
      rule: "NCR/CAPA and recurring field failures feed release and engineering decisions.",
      to: "/command/quality",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Operate · cross-functional control</p>
          <h1 className="mt-1 font-display text-4xl text-accent">Supply & Production</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            One exception-led operating view across replenishment, authoritative stock, the production plan, manufacturing readiness and quality release. Detailed transactions remain in their specialist controls.
          </p>
        </div>
        <Link to="/command/planning" className="text-sm font-semibold text-accent hover:text-fg">Master Plan →</Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Stock alerts" value={String(stockAlerts)} hint={`${critical} critical`} tone={stockAlerts ? "warn" : "ok"} />
        <Kpi label="MSL shortfall" value={String(shortage)} hint="Units to configured minimum" tone={shortage ? "warn" : "ok"} />
        <Kpi label="Next production" value={firstProduction ? `M${firstProduction.m}` : "Not set"} hint={firstProduction ? `${firstProduction.units} planned units` : `${scenario} scenario`} tone={firstProduction ? "ok" : "warn"} />
        <Kpi label="Mfg controls open" value={String(openManufacturing.length)} hint={`${MANUFACTURING_GATES.length} release gates`} tone={openManufacturing.length ? "warn" : "ok"} />
      </div>

      <Panel title="Needs attention" kicker={attention.length ? `${attention.length} material exception${attention.length === 1 ? "" : "s"}` : "No material exceptions"}>
        {attention.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {attention.slice(0, 8).map((item, index) => (
              <Link key={`${item.title}-${index}`} to={item.to as never} className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent">
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${item.tone === "danger" ? "bg-danger" : "bg-warn"}`} />
                  <div>
                    <p className="text-sm font-semibold text-fg">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{item.detail}</p>
                    <p className="mt-2 text-xs font-semibold text-accent">Open control →</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No stock, manufacturing or quality exception currently requires intervention.</p>
        )}
      </Panel>

      <Panel title="Operating control surface" kicker="One owner per truth">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="px-3 py-3">Control</th>
                <th className="px-3 py-3">Current signal</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Operating rule</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {readiness.map((row) => (
                <tr key={row.area} className="border-t border-border/70 align-top">
                  <td className="px-3 py-3 font-semibold text-fg">{row.area}</td>
                  <td className="px-3 py-3 text-muted">{row.signal}</td>
                  <td className={row.status === "Attention" ? "px-3 py-3 font-semibold text-warn" : "px-3 py-3 font-semibold text-green"}>{row.status}</td>
                  <td className="px-3 py-3 text-xs leading-5 text-muted">{row.rule}</td>
                  <td className="px-3 py-3 text-right"><Link to={row.to as never} className="text-xs font-semibold text-accent">Open →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <details className="rounded-xl border border-border bg-surface/40 p-4 text-xs leading-5 text-muted">
        <summary className="cursor-pointer font-semibold text-fg">Control methodology</summary>
        <p className="mt-3">Procurement consumes MSL signals from Master Inventory; it does not own stock. Master Inventory remains the ledger authority for category, balance, MSL, forecast coverage and FIFO. Production is a shared planning output until execution is released. Manufacturing and Quality retain their own evidence and release controls.</p>
      </details>
    </div>
  );
}
