import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, Kpi } from "@/components/kpi";
import { getInventoryMslWarnings } from "@/lib/inventory-authority";

export const Route = createFileRoute("/command/procurement")({
  loader: () => getInventoryMslWarnings(),
  component: Procurement,
});

function Procurement() {
  const warnings = Route.useLoaderData();
  const critical = warnings.filter((x: any) => x.status === "critical").length;
  const low = warnings.filter((x: any) => x.status === "low").length;
  const shortage = warnings.reduce((sum: number, x: any) => sum + Number(x.shortage_quantity), 0);

  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-green">Operate · procurement control</p>
        <h1 className="mt-2 text-4xl font-bold text-accent">Procurement</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">MSL warnings from authoritative inventory become the replenishment queue. This page does not create a purchase order automatically; it gives Operations the controlled signal to act.</p>
      </div>
      <Link to="/command/inventory-truth" className="text-sm font-semibold text-accent">Inventory truth →</Link>
    </div>

    <div className="mt-8 grid gap-3 sm:grid-cols-3">
      <Kpi label="Critical" value={String(critical)} hint="At zero stock" />
      <Kpi label="Below MSL" value={String(low)} hint="Replenishment required" />
      <Kpi label="Total shortfall" value={String(shortage)} hint="Units to reach MSL" />
    </div>

    <Panel title="MSL replenishment queue" kicker="FIFO inventory · minimum stock control" className="mt-6">
      {warnings.length === 0 ? <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">No active MSL warnings. Nothing is currently below minimum stock level.</div> :
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle"><tr><th className="px-3 py-3">Priority</th><th className="px-3 py-3">Venture</th><th className="px-3 py-3">SKU</th><th className="px-3 py-3">On hand</th><th className="px-3 py-3">MSL</th><th className="px-3 py-3">Shortfall</th><th className="px-3 py-3">Reorder qty</th><th className="px-3 py-3">Lead time</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{warnings.map((x: any) => <tr key={`${x.venture}-${x.sku}-${x.unit}`} className="border-t border-border/70"><td className="px-3 py-3 text-xs font-semibold uppercase">{x.status === "critical" ? "Immediate" : "Replenish"}</td><td className="px-3 py-3 uppercase">{x.venture}</td><td className="px-3 py-3 font-mono text-xs">{x.sku}</td><td className="px-3 py-3 tabular-nums">{Number(x.quantity_balance)}</td><td className="px-3 py-3 tabular-nums">{Number(x.minimum_stock_level)}</td><td className="px-3 py-3 tabular-nums">{Number(x.shortage_quantity)}</td><td className="px-3 py-3 tabular-nums">{Number(x.reorder_quantity)}</td><td className="px-3 py-3 tabular-nums">{Number(x.lead_time_days)} d</td><td className="px-3 py-3 text-xs uppercase">{x.status}</td></tr>)}</tbody></table></div>}
    </Panel>

    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <Panel title="Procurement rule" kicker="Do not bypass inventory truth">
        <p className="text-sm leading-6 text-muted">A warning means authoritative on-hand quantity is at or below the configured MSL. Procurement should validate supplier, MOQ, lead time, price and approval before posting a receipt.</p>
      </Panel>
      <Panel title="FIFO rule" kicker="Receipt → layer → issue">
        <p className="text-sm leading-6 text-muted">Every future positive inventory posting creates a FIFO layer. Issues consume the oldest available layer first and record the allocation, preserving an auditable stock trail.</p>
      </Panel>
    </div>
  </main>;
}
