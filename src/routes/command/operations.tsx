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

      <div className="grid gap-3 sm:grid-cols-5">
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
              <div className="mt-3 overflow-x-auto">
                <table className="w-full table-auto text-left text-xs">
                  <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle">
                    <tr><th className="px-2 py-2">Shipment</th><th className="px-2 py-2">Order / job</th><th className="px-2 py-2 text-right">Units</th><th className="px-2 py-2">Quality</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Finance downstream</th></tr>
                  </thead>
                  <tbody>
                    {dispatch.map((row) => (
                      <tr key={row.shipmentId} className="border-t border-border/70">
                        <td className="px-2 py-2 font-mono text-accent">{row.shipmentId}</td>
                        <td className="px-2 py-2"><p>{row.salesOrderId} · R{row.salesOrderRevision}</p><p className="text-[10px] text-muted">{row.jobCardId || "No job card"}</p></td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.units}</td>
                        <td className="px-2 py-2">{row.qualityReleaseCount} release(s)</td>
                        <td className="px-2 py-2 font-semibold uppercase">{row.status}</td>
                        <td className="px-2 py-2 text-muted">{row.invoiceId ? `${row.invoiceId} · ${row.invoiceStatus}` : "Invoice not yet posted"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="mt-3 text-sm text-muted">No dispatch has been posted. This is a valid empty canonical register, not an unknown route binding.</p>}
          </details>

          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer font-semibold text-accent">Order-to-cash lineage ({lineage.length})</summary>
            <p className="mt-2 text-xs text-muted">Persisted evidence from order through production, procurement, receiving, genealogy, Quality, dispatch and Finance.</p>
            {lineage.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full table-auto text-left text-xs">
                  <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle">
                    <tr><th className="px-2 py-2">Order</th><th className="px-2 py-2">Job Card</th><th className="px-2 py-2">Material</th><th className="px-2 py-2">Procurement</th><th className="px-2 py-2">Traveller</th><th className="px-2 py-2">Dispatch / invoice / collection</th></tr>
                  </thead>
                  <tbody>
                    {lineage.map((row) => (
                      <tr key={`${row.salesOrderId}-${row.salesOrderRevision}`} className="border-t border-border/70">
                        <td className="px-2 py-2"><p className="font-mono text-accent">{row.salesOrderId}</p><p className="text-[10px] text-muted">R{row.salesOrderRevision} · {row.units} unit(s)</p></td>
                        <td className="px-2 py-2">{row.jobCardId || "Not raised"}</td>
                        <td className="px-2 py-2"><span className={row.shortageLines ? "text-warn" : "text-ok"}>{row.shortageLines ? `${row.shortageLines} shortage line(s)` : "Ready"}</span></td>
                        <td className="px-2 py-2">{row.purchaseOrderCount} PO · {row.goodsReceiptCount} GRN</td>
                        <td className="px-2 py-2">{row.travellerCount}/{row.units}</td>
                        <td className="px-2 py-2">{row.shipmentCount} dispatch · {row.invoiceCount} invoice · {row.collectionCount} collection</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="mt-3 text-sm text-muted">No confirmed order lineage exists yet.</p>}
          </details>
        </div>
      </Panel>

      <p className="text-xs text-muted">Dispatch source authority: <code>vyndi_dispatch_register</code> via <code>src/lib/dispatch-authority.ts</code>. Quality evidence is loaded from <code>src/lib/quality-authority.ts</code>. This surface does not write Finance records.</p>
    </div>
  );
}
