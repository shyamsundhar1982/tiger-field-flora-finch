import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { MANUFACTURING_CONTROLS, MANUFACTURING_GATES } from "@/lib/data/manufacturing-control";
import { buildModelWithInputs, type ScenarioId } from "@/lib/finance/model";
import { qualitySummary } from "@/lib/finance/quality-engine";
import { getInventoryMslWarnings } from "@/lib/inventory-authority";
import { getOperatingLineage, type OperatingLineageRow } from "@/lib/operating-lineage";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/operations")({
  loader: async () => {
    const [warnings, lineage] = await Promise.all([
      getInventoryMslWarnings(),
      getOperatingLineage(),
    ]);
    return { warnings, lineage };
  },
  component: Operations,
});

function nextAction(row: OperatingLineageRow) {
  if (!row.jobCardId) return { label: "Reconcile Job Card", to: "/command/production" };
  if (row.shortageLines > 0 && row.purchaseOrderCount === 0)
    return { label: "Create procurement", to: "/command/purchase-execution" };
  if (row.shortageLines > 0 && row.purchaseOrderCount > 0 && row.goodsReceiptCount === 0)
    return { label: "Receive materials", to: "/command/receiving" };
  if (row.shortageLines > 0)
    return { label: "Resolve remaining shortage", to: "/command/inventory" };
  if (!row.buildApprovedAt || row.travellerCount < row.units)
    return { label: "Release build / genealogy", to: "/command/production" };
  if (row.shipmentCount === 0)
    return { label: "Quality / shipment evidence", to: "/command/quality" };
  if (row.invoiceCount === 0)
    return { label: "Issue invoice", to: "/command/receivables" };
  if (row.collectionCount === 0)
    return { label: "Post collection", to: "/command/receivables" };
  return { label: "Review closed lineage", to: "/command/receivables" };
}

function stateText(value: string, empty = "Not yet recorded") {
  return value.trim() ? value : empty;
}

function Operations() {
  const { warnings, lineage } = Route.useLoaderData();
  const scenario = useVeloxis((s) => s.scenario) as ScenarioId;
  const drawStandby = useVeloxis((s) => s.drawStandby);
  const finance = useVeloxis((s) => s.finance);
  const rows = useMemo(
    () => buildModelWithInputs(scenario, drawStandby, finance),
    [scenario, drawStandby, finance],
  );

  const critical = warnings.filter((item: any) => item.status === "critical").length;
  const stockAlerts = warnings.length;
  const shortageUnits = warnings.reduce(
    (sum: number, item: any) => sum + Number(item.shortage_quantity || 0),
    0,
  );
  const lineageShortages = lineage.reduce((sum, row) => sum + row.shortageLines, 0);
  const openPoLines = lineage.reduce((sum, row) => sum + row.purchaseOrderCount, 0);
  const travellers = lineage.reduce((sum, row) => sum + row.travellerCount, 0);
  const openManufacturing = MANUFACTURING_CONTROLS.filter(
    (control) => control.status === "pending" || control.status === "verify",
  );
  const firstProduction = rows.find((row) => row.units > 0);
  const quality = qualitySummary();

  const exceptions = [
    ...warnings.slice(0, 6).map((item: any) => ({
      category: "Material",
      signal: `${item.sku} · ${item.status === "critical" ? "stockout" : "below MSL"}`,
      detail: `${Number(item.quantity_balance)} on hand · MSL ${Number(item.minimum_stock_level)} · short ${Number(item.shortage_quantity)}`,
      owner: "Inventory / Procurement",
      to: "/command/procurement-planning",
      priority: item.status === "critical" ? "Critical" : "High",
    })),
    ...(openManufacturing.length
      ? [{
          category: "Build readiness",
          signal: `${openManufacturing.length} manufacturing controls open`,
          detail: `${openManufacturing.slice(0, 2).map((control) => control.title).join(" · ")}${openManufacturing.length > 2 ? " · …" : ""}`,
          owner: "Operations / QA",
          to: "/command/manufacturing",
          priority: "High",
        }]
      : []),
    ...(quality.openNcr
      ? [{
          category: "Quality",
          signal: `${quality.openNcr} open NCR${quality.openNcr === 1 ? "" : "s"}`,
          detail: "Containment and CAPA remain part of release readiness.",
          owner: "Quality",
          to: "/command/quality",
          priority: "High",
        }]
      : []),
  ];

  const controls = [
    {
      area: "Requirements",
      signal: `${lineageShortages} live job-card shortage line${lineageShortages === 1 ? "" : "s"}`,
      status: lineageShortages ? "Attention" : "Controlled",
      rule: "Requirements come from current controlled job-card/BOM truth; planning demand never becomes a supplier commitment by itself.",
      to: "/command/procurement-planning",
    },
    {
      area: "Purchase",
      signal: `${openPoLines} linked PO record${openPoLines === 1 ? "" : "s"}`,
      status: lineageShortages && !openPoLines ? "Attention" : "Controlled",
      rule: "Supplier, price, terms and approval remain governed in Purchase Execution.",
      to: "/command/purchase-execution",
    },
    {
      area: "Receiving",
      signal: "Issued PO → GRN → incoming inspection",
      status: "Controlled",
      rule: "Only accepted GRN quantity creates FIFO stock; quarantine and rejection stay outside ATP.",
      to: "/command/receiving",
    },
    {
      area: "Inventory",
      signal: critical ? `${critical} stockout${critical === 1 ? "" : "s"}` : "FIFO / MSL authoritative",
      status: critical ? "Attention" : "Controlled",
      rule: "Master Inventory owns physical balance, MSL, FIFO layers and available-to-promise.",
      to: "/command/inventory",
    },
    {
      area: "Build & genealogy",
      signal: `${lineage.length} committed order${lineage.length === 1 ? "" : "s"} · ${travellers} traveller${travellers === 1 ? "" : "s"}`,
      status: lineage.length ? "Active" : "Waiting",
      rule: "Current order revision → current job card → one traveller per physical unit. Approval remains in Production.",
      to: "/command/production",
    },
    {
      area: "Quality",
      signal: `${quality.openNcr} open NCR · ${quality.warrantyOpen} warranty open`,
      status: quality.openNcr || quality.warrantyOpen ? "Attention" : "Controlled",
      rule: "Quality is a specialist control. Current quality records are not falsely represented as order-linked genealogy.",
      to: "/command/quality",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Operations · demand to quality execution</p>
          <h1 className="mt-1 font-display text-4xl text-accent">Operations</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
            One execution hub for material requirements, purchase, receiving, inventory, controlled build genealogy and quality. Summary views stay read-only; every transaction remains owned by its specialist control.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <Link to="/command/decision-inbox" className="text-accent hover:text-fg">Action Inbox →</Link>
          <Link to="/command/planning" className="text-accent hover:text-fg">Master Plan →</Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Committed orders" value={String(lineage.length)} hint="Order lineage rows" tone={lineage.length ? "ok" : "warn"} />
        <Kpi label="Live shortages" value={String(lineageShortages)} hint={`${shortageUnits} MSL shortfall units`} tone={lineageShortages ? "danger" : "ok"} />
        <Kpi label="Linked PO records" value={String(openPoLines)} hint="Across current job cards" tone={lineageShortages && !openPoLines ? "warn" : "ok"} />
        <Kpi label="Travellers" value={String(travellers)} hint="Persisted genealogy" />
        <Kpi label="Next plan build" value={firstProduction ? `M${firstProduction.m}` : "Not set"} hint={firstProduction ? `${firstProduction.units} planned units` : `${scenario} scenario`} tone={firstProduction ? "ok" : "warn"} />
      </div>

      <Panel title="Today's operating exceptions" kicker={exceptions.length ? `${exceptions.length} exception${exceptions.length === 1 ? "" : "s"} · compact register` : "No material exception requires intervention"}>
        {exceptions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle">
                <tr><th className="px-3 py-2">Priority</th><th className="px-3 py-2">Area</th><th className="px-3 py-2">Signal</th><th className="px-3 py-2">Evidence</th><th className="px-3 py-2">Owner</th><th className="px-3 py-2 text-right">Action</th></tr>
              </thead>
              <tbody>
                {exceptions.map((item, index) => (
                  <tr key={`${item.category}-${item.signal}-${index}`} className="border-t border-border/70 align-top">
                    <td className={item.priority === "Critical" ? "px-3 py-3 font-bold uppercase text-danger" : "px-3 py-3 font-bold uppercase text-warn"}>{item.priority}</td>
                    <td className="px-3 py-3 font-semibold text-fg">{item.category}</td>
                    <td className="px-3 py-3 text-fg">{item.signal}</td>
                    <td className="px-3 py-3 text-muted">{item.detail}</td>
                    <td className="px-3 py-3 text-muted">{item.owner}</td>
                    <td className="px-3 py-3 text-right"><Link to={item.to as never} className="font-semibold text-accent">Open →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted">No stock, build-readiness or quality exception currently requires intervention.</p>}
      </Panel>

      <Panel title="Order-to-cash lineage" kicker="One business object · persisted evidence only · expand IDs when needed">
        {lineage.length === 0 ? (
          <p className="text-sm text-muted">No confirmed or delivered order exists in the canonical sales-order ledger.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Build / BOM</th>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2">Purchase / GRN</th>
                  <th className="px-3 py-2">Traveller</th>
                  <th className="px-3 py-2">Order-to-cash</th>
                  <th className="px-3 py-2">Evidence</th>
                  <th className="px-3 py-2 text-right">Next</th>
                </tr>
              </thead>
              <tbody>
                {lineage.map((row) => {
                  const next = nextAction(row);
                  return (
                    <tr key={`${row.salesOrderId}-${row.salesOrderRevision}`} className="border-t border-border/70 align-top">
                      <td className="px-3 py-3">
                        <p className="font-mono text-[10px] text-accent">{row.salesOrderId}</p>
                        <p className="mt-1 font-semibold text-fg">{row.variantName || row.variantId || "Configured bicycle"}</p>
                        <p className="mt-1 text-[10px] text-muted">R{row.salesOrderRevision} · {row.units} unit(s) · M{row.planMonth}</p>
                      </td>
                      <td className="px-3 py-3 text-muted">
                        <p className={row.jobCardId ? "font-semibold text-fg" : "font-semibold text-warn"}>{row.jobCardId || "No current Job Card"}</p>
                        <p className="mt-1">BOM {stateText(row.bomRevision)}</p>
                        <p className="mt-1 text-[10px]">{stateText(row.jobCardStatus)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className={row.shortageLines ? "font-semibold text-danger" : "font-semibold text-green"}>{row.shortageLines ? `${row.shortageLines} shortage line(s)` : row.jobCardId ? "No live shortage" : "Not evaluated"}</p>
                        <p className="mt-1 text-[10px] text-muted">{row.requirementLines} controlled requirement line(s)</p>
                      </td>
                      <td className="px-3 py-3 text-muted">
                        <p>{row.purchaseOrderCount ? `${row.purchaseOrderCount} PO record(s)` : "No PO recorded"}</p>
                        <p className="mt-1">{row.goodsReceiptCount ? `${row.goodsReceiptCount} GRN · ${row.acceptedReceiptUnits} accepted` : "No GRN recorded"}</p>
                      </td>
                      <td className="px-3 py-3 text-muted">
                        <p>{row.travellerCount ? `${row.travellerCount} traveller(s)` : "No traveller recorded"}</p>
                        <p className="mt-1 text-[10px]">Quality: specialist control, not order-linked yet</p>
                      </td>
                      <td className="px-3 py-3 text-muted">
                        <p>{row.shipmentCount ? `${row.shipmentCount} shipment(s)` : "No shipment recorded"}</p>
                        <p className="mt-1">{row.invoiceCount ? `${row.invoiceCount} invoice(s)` : "No invoice recorded"}</p>
                        <p className="mt-1">{row.collectionCount ? `${row.collectionCount} collection(s)` : "No collection recorded"}</p>
                      </td>
                      <td className="px-3 py-3">
                        <details className="rounded-md border border-border bg-bg/40 p-2">
                          <summary className="cursor-pointer whitespace-nowrap font-semibold text-accent">View IDs</summary>
                          <div className="mt-2 min-w-56 space-y-1 text-[10px] leading-4 text-muted">
                            <p><span className="font-semibold text-fg">Batch:</span> {stateText(row.batchCode)}</p>
                            <p><span className="font-semibold text-fg">PO:</span> {stateText(row.purchaseOrderIds)}</p>
                            <p><span className="font-semibold text-fg">PO status:</span> {stateText(row.purchaseOrderStatuses)}</p>
                            <p><span className="font-semibold text-fg">GRN:</span> {stateText(row.goodsReceiptIds)}</p>
                            <p><span className="font-semibold text-fg">Traveller:</span> {stateText(row.travellerIds)}</p>
                            <p><span className="font-semibold text-fg">Traveller status:</span> {stateText(row.travellerStatuses)}</p>
                            <p><span className="font-semibold text-fg">Shipment:</span> {stateText(row.shipmentIds)}</p>
                            <p><span className="font-semibold text-fg">Invoice:</span> {stateText(row.invoiceIds)}</p>
                            <p><span className="font-semibold text-fg">Collection:</span> {stateText(row.collectionIds)}</p>
                          </div>
                        </details>
                      </td>
                      <td className="px-3 py-3 text-right"><Link to={next.to as never} className="font-semibold text-accent">{next.label} →</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[10px] leading-4 text-subtle">Quality is deliberately shown as a specialist control rather than fabricated genealogy because the current Quality module does not yet persist order/job-card-linked inspection evidence.</p>
      </Panel>

      <Panel title="Operating controls" kicker="One owner per truth · specialist writes only">
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-left text-xs">
            <thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle">
              <tr><th className="px-3 py-2">Control</th><th className="px-3 py-2">Current signal</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Operating rule</th><th className="px-3 py-2 text-right">Action</th></tr>
            </thead>
            <tbody>
              {controls.map((row) => (
                <tr key={row.area} className="border-t border-border/70 align-top">
                  <td className="px-3 py-3 font-semibold text-fg">{row.area}</td>
                  <td className="px-3 py-3 text-muted">{row.signal}</td>
                  <td className={row.status === "Attention" ? "px-3 py-3 font-semibold text-warn" : "px-3 py-3 font-semibold text-green"}>{row.status}</td>
                  <td className="px-3 py-3 leading-5 text-muted">{row.rule}</td>
                  <td className="px-3 py-3 text-right"><Link to={row.to as never} className="font-semibold text-accent">Open →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <details className="rounded-xl border border-border bg-surface/40 p-4 text-xs leading-5 text-muted">
        <summary className="cursor-pointer font-semibold text-fg">Operating control methodology</summary>
        <p className="mt-3">Requirements consume current controlled job-card/BOM demand. Purchase owns supplier commitment. Receiving owns GRN and inspection. Master Inventory owns physical stock/FIFO. Production owns controlled build and traveller genealogy. Quality owns NCR/CAPA and inspection evidence. Finance owns invoice/collection controls. The Operations overview only reconciles those truths; it does not replace them.</p>
        <p className="mt-2">Manufacturing evidence: {openManufacturing.length} open control(s) across {MANUFACTURING_GATES.length} release gates.</p>
      </details>
    </div>
  );
}
