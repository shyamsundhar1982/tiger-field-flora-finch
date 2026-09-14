import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { getInventoryMslWarnings } from "@/lib/inventory-authority";
import { getOperatingLineage } from "@/lib/operating-lineage";
import { listDispatchRegister } from "@/lib/dispatch-authority";
import { listQualityAuthority } from "@/lib/quality-authority";

type Row = Record<string, unknown>;

const text = (row: Row, ...keys: string[]) => {
  for (const key of keys) if (row[key] != null) return String(row[key]);
  return "";
};

export const Route = createFileRoute("/command/operations")({
  loader: async () => {
    const [warnings, lineage, dispatch, quality] = await Promise.all([
      getInventoryMslWarnings(),
      getOperatingLineage(),
      listDispatchRegister(),
      listQualityAuthority(),
    ]);
    return { warnings, lineage, dispatch, quality };
  },
  component: Operations,
});

function DispatchRecord({ row }: { row: Awaited<ReturnType<typeof listDispatchRegister>>[number] }) {
  const downstream = row.invoiceId
    ? `${row.invoiceId} · ${row.invoiceStatus}`
    : "Invoice not yet posted";

  return (
    <article className="rounded-lg border border-border/80 bg-bg/45 p-3 transition-colors hover:bg-surface/45">
      <div className="hidden grid-cols-[minmax(0,.95fr)_minmax(0,1.35fr)_minmax(0,.55fr)_minmax(0,.8fr)_minmax(0,.7fr)_minmax(0,1.45fr)] items-start gap-3 lg:grid">
        <p className="min-w-0 break-all font-mono text-[11px] text-accent">{row.shipmentId}</p>
        <div className="min-w-0">
          <p className="break-all text-xs text-fg">{row.salesOrderId} · R{row.salesOrderRevision}</p>
          <p className="mt-1 break-all text-[10px] text-muted">{row.jobCardId || "No job card"}</p>
        </div>
        <p className="text-right text-xs tabular-nums">{row.units}</p>
        <p className="min-w-0 break-words text-[11px] text-fg">{row.qualityReleaseCount} release(s)</p>
        <p className="min-w-0 break-words text-[10px] font-semibold uppercase text-fg">{row.status}</p>
        <p className="min-w-0 break-all text-[11px] leading-4 text-muted">{downstream}</p>
      </div>

      <div className="space-y-3 lg:hidden">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-all font-mono text-xs text-accent">{row.shipmentId}</p>
            <p className="mt-1 break-all text-[10px] text-muted">{row.salesOrderId} · R{row.salesOrderRevision}</p>
          </div>
          <span className="shrink-0 text-[10px] font-semibold uppercase text-fg">{row.status}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div className="min-w-0 sm:col-span-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-subtle">Job Card</p>
            <p className="mt-1 break-all">{row.jobCardId || "No job card"}</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-subtle">Units</p>
            <p className="mt-1 tabular-nums">{row.units}</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-subtle">Quality</p>
            <p className="mt-1">{row.qualityReleaseCount} release(s)</p>
          </div>
        </div>
        <div className="border-t border-border/70 pt-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-subtle">Finance downstream</p>
          <p className="mt-1 break-all text-xs leading-5 text-muted">{downstream}</p>
        </div>
      </div>
    </article>
  );
}

function LineageRecord({ row }: { row: Awaited<ReturnType<typeof getOperatingLineage>>[number] }) {
  return (
    <article className="rounded-lg border border-border/80 bg-bg/45 p-3 transition-colors hover:bg-surface/45">
      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,.95fr)_minmax(0,.85fr)_minmax(0,1fr)_minmax(0,.65fr)_minmax(0,1.55fr)] items-start gap-3 lg:grid">
        <div className="min-w-0">
          <p className="break-all font-mono text-[11px] text-accent">{row.salesOrderId}</p>
          <p className="mt-1 text-[10px] text-muted">R{row.salesOrderRevision} · {row.units} unit(s)</p>
        </div>
        <p className="min-w-0 break-all text-[11px] text-fg">{row.jobCardId || "Not raised"}</p>
        <p className={row.shortageLines ? "min-w-0 break-words text-[11px] text-warn" : "min-w-0 break-words text-[11px] text-ok"}>
          {row.shortageLines ? `${row.shortageLines} shortage line(s)` : "Ready"}
        </p>
        <p className="min-w-0 break-words text-[11px] text-fg">{row.purchaseOrderCount} PO · {row.goodsReceiptCount} GRN</p>
        <p className="text-xs tabular-nums">{row.travellerCount}/{row.units}</p>
        <p className="min-w-0 break-words text-[11px] leading-4 text-fg">
          {row.shipmentCount} dispatch · {row.invoiceCount} invoice · {row.collectionCount} collection
        </p>
      </div>

      <div className="space-y-3 lg:hidden">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-all font-mono text-xs text-accent">{row.salesOrderId}</p>
            <p className="mt-1 text-[10px] text-muted">R{row.salesOrderRevision} · {row.units} unit(s)</p>
          </div>
          <span className={row.shortageLines ? "shrink-0 text-[10px] font-semibold text-warn" : "shrink-0 text-[10px] font-semibold text-ok"}>
            {row.shortageLines ? `${row.shortageLines} shortage` : "Material ready"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div className="min-w-0 sm:col-span-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-subtle">Job Card</p>
            <p className="mt-1 break-all">{row.jobCardId || "Not raised"}</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-subtle">Procurement</p>
            <p className="mt-1">{row.purchaseOrderCount} PO · {row.goodsReceiptCount} GRN</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-subtle">Traveller</p>
            <p className="mt-1 tabular-nums">{row.travellerCount}/{row.units}</p>
          </div>
        </div>
        <div className="border-t border-border/70 pt-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-subtle">Dispatch / invoice / collection</p>
          <p className="mt-1 break-words text-xs leading-5 text-muted">
            {row.shipmentCount} dispatch · {row.invoiceCount} invoice · {row.collectionCount} collection
          </p>
        </div>
      </div>
    </article>
  );
}

function Operations() {
  const { warnings, lineage, dispatch, quality } = Route.useLoaderData();
  const currentDispatch = dispatch.filter((row) => row.status === "posted");
  const openNcr = (quality.ncrs as Row[]).filter(
    (row) => !["closed", "rejected"].includes(text(row, "status")),
  ).length;
  const releases = (quality.releases as Row[]).filter(
    (row) => text(row, "status") === "released",
  ).length;
  const shortages = lineage.reduce((sum, row) => sum + row.shortageLines, 0);

  return (
    <div className="space-y-6">
      <header className="border-b border-border pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">
          Operations · demand to quality execution · canonical authority
        </p>
        <h1 className="mt-1 font-display text-4xl text-accent">Operations</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
          Order lineage, material readiness, Quality release evidence and Dispatch visibility are rendered from canonical operating authorities. Finance remains downstream of posted Operations dispatch.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
          <Link to="/command/procurement-planning" className="text-accent">Procurement →</Link>
          <Link to="/command/production" className="text-accent">Production →</Link>
          <Link to="/command/quality" className="text-accent">Quality →</Link>
          <Link to="/command/receivables" className="text-accent">Downstream Finance →</Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Committed lineage" value={String(lineage.length)} hint="Current order revisions" />
        <Kpi label="Live shortages" value={String(shortages)} hint="Controlled requirement lines" tone={shortages ? "warn" : "ok"} />
        <Kpi label="Inventory alerts" value={String(warnings.length)} hint="MSL / stockout" tone={warnings.length ? "warn" : "ok"} />
        <Kpi label="Quality releases" value={String(releases)} hint={`${openNcr} open NCR`} tone={openNcr ? "warn" : "ok"} />
        <Kpi label="Posted dispatch" value={String(currentDispatch.length)} hint="Operations-owned register" tone={currentDispatch.length ? "ok" : undefined} />
      </div>

      <Panel title="Today's operating exceptions" kicker="Material · quality · dispatch">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs uppercase tracking-wider text-muted">Material</p>
            <p className={shortages ? "mt-1 font-semibold text-warn" : "mt-1 font-semibold text-ok"}>{shortages ? `${shortages} shortage line(s)` : "No live shortage"}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs uppercase tracking-wider text-muted">Quality</p>
            <p className={openNcr ? "mt-1 font-semibold text-warn" : "mt-1 font-semibold text-ok"}>{openNcr ? `${openNcr} open NCR(s)` : "No open NCR"}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs uppercase tracking-wider text-muted">Inventory</p>
            <p className={warnings.length ? "mt-1 font-semibold text-warn" : "mt-1 font-semibold text-ok"}>{warnings.length ? `${warnings.length} MSL / stock alert(s)` : "No active alert"}</p>
          </div>
        </div>
      </Panel>

      <Panel title="Operating controls" kicker="compact register · expand only the evidence you need">
        <div className="space-y-3">
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer font-semibold text-accent">Canonical Dispatch Register ({dispatch.length})</summary>
            <p className="mt-2 text-xs text-muted">Operations/Fulfilment owns shipment truth; Finance is downstream.</p>
            {dispatch.length ? (
              <div className="mt-3 space-y-2" data-full-view-table="operations-dispatch-register">
                <div className="hidden grid-cols-[minmax(0,.95fr)_minmax(0,1.35fr)_minmax(0,.55fr)_minmax(0,.8fr)_minmax(0,.7fr)_minmax(0,1.45fr)] gap-3 rounded-lg border border-border bg-surface/55 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-subtle lg:grid">
                  <span>Shipment</span><span>Order / job</span><span className="text-right">Units</span><span>Quality</span><span>Status</span><span>Finance downstream</span>
                </div>
                {dispatch.map((row) => <DispatchRecord key={row.shipmentId} row={row} />)}
              </div>
            ) : <p className="mt-3 text-sm text-muted">No dispatch has been posted. This is a valid empty canonical register, not an unknown route binding.</p>}
          </details>

          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer font-semibold text-accent">Order-to-cash lineage ({lineage.length})</summary>
            <p className="mt-2 text-xs text-muted">Persisted evidence from order through production, procurement, receiving, genealogy, Quality, dispatch and Finance.</p>
            {lineage.length ? (
              <div className="mt-3 space-y-2" data-full-view-table="operations-order-to-cash-lineage">
                <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,.95fr)_minmax(0,.85fr)_minmax(0,1fr)_minmax(0,.65fr)_minmax(0,1.55fr)] gap-3 rounded-lg border border-border bg-surface/55 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-subtle lg:grid">
                  <span>Order</span><span>Job Card</span><span>Material</span><span>Procurement</span><span>Traveller</span><span>Dispatch / invoice / collection</span>
                </div>
                {lineage.map((row) => (
                  <LineageRecord key={`${row.salesOrderId}-${row.salesOrderRevision}`} row={row} />
                ))}
              </div>
            ) : <p className="mt-3 text-sm text-muted">No confirmed order lineage exists yet.</p>}
          </details>
        </div>
      </Panel>

      <p className="text-xs text-muted">
        Dispatch source authority: <code>vyndi_dispatch_register</code> via <code>src/lib/dispatch-authority.ts</code>. Quality evidence is loaded from <code>src/lib/quality-authority.ts</code>. This surface does not write Finance records.
      </p>
    </div>
  );
}
