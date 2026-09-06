import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, Kpi } from "@/components/kpi";
import { inr } from "@/lib/format";
import { getAuthoritativeInventory, getAuthoritativeInventoryMovements, getInventoryControlSummary, getInventoryFifoTrace, getInventoryMslWarnings } from "@/lib/inventory-authority";

const LEDGERS = ["stock", "movements", "fifo", "msl"] as const;
type LedgerId = typeof LEDGERS[number];

export const Route = createFileRoute("/command/inventory-ledgers/$ledger")({
  loader: async () => {
    const [summary, balances, movements, msl, fifo] = await Promise.all([
      getInventoryControlSummary(),
      getAuthoritativeInventory(),
      getAuthoritativeInventoryMovements(),
      getInventoryMslWarnings(),
      getInventoryFifoTrace(),
    ]);
    return { summary, balances, movements, msl, fifo };
  },
  component: LedgerPage,
});

function LedgerPage() {
  const d = Route.useLoaderData();
  const { ledger: rawLedger } = Route.useParams();
  const ledger = (LEDGERS.includes(rawLedger as LedgerId) ? rawLedger : "stock") as LedgerId;
  const titles: Record<LedgerId, [string, string]> = {
    stock: ["Stock Ledger", "Authoritative balance + WAC"],
    movements: ["Movement Ledger", "Append-only posted inventory events"],
    fifo: ["FIFO Ledger", "Oldest receipt layer first"],
    msl: ["MSL Ledger", "Minimum-stock and replenishment control"],
  };
  const [title, kicker] = titles[ledger];

  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-green">Inventory · ledger control</p>
        <h1 className="mt-2 text-4xl font-bold text-accent">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">{kicker}. This page reads only authoritative posted inventory data.</p>
      </div>
      <div className="flex gap-2">
        <Link to="/command/inventory-ledgers" className="rounded-lg border border-border px-4 py-2.5 text-sm">← Ledger Control</Link>
        <Link to="/command/inventory" className="rounded-lg border border-border px-4 py-2.5 text-sm">Inventory</Link>
      </div>
    </header>

    <div className="grid gap-3 sm:grid-cols-3">
      <Kpi label="Authoritative SKUs" value={String(d.summary.skuCount)} />
      <Kpi label="Units" value={String(d.summary.totalUnits)} />
      <Kpi label="Inventory value" value={inr(d.summary.inventoryValueInr)} />
    </div>

    <nav className="flex flex-wrap gap-2" aria-label="Inventory ledgers">
      {LEDGERS.map(id => <Link key={id} to={`/command/inventory-ledgers/${id}` as never} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${ledger === id ? "border-accent bg-accent/10 text-accent" : "border-border"}`}>{titles[id][0]}</Link>)}
    </nav>

    {ledger === "stock" && <Panel title="Stock ledger" kicker="Authoritative balance + WAC"><Table h={["Venture", "SKU", "Unit", "Balance", "WAC", "Value"]}>{(d.balances as any[]).map(x => <tr key={`${x.venture}-${x.sku}-${x.unit}`} className="border-t border-border/70"><td>{x.venture}</td><td><Link className="font-mono text-xs text-accent" to="/command/inventory-ledgers/movements" search={{ sku: x.sku } as never}>{x.sku}</Link></td><td>{x.unit}</td><td className="text-right">{Number(x.quantity_balance)}</td><td className="text-right">{inr(Number(x.weighted_average_cost_inr))}</td><td className="text-right">{inr(Number(x.inventory_value_inr))}</td></tr>)}</Table></Panel>}
    {ledger === "movements" && <Panel title="Movement ledger" kicker="Append-only posted events"><Table h={["Date", "Type", "SKU", "Delta", "Unit", "Reference"]}>{(d.movements as any[]).map(x => <tr key={x.id} className="border-t border-border/70"><td>{new Date(x.created_at).toLocaleString()}</td><td className="uppercase text-xs">{x.movement_type}</td><td className="font-mono text-xs">{x.sku}</td><td className="text-right">{Number(x.quantity_delta)}</td><td>{x.unit}</td><td>{x.reference || "—"}</td></tr>)}</Table></Panel>}
    {ledger === "fifo" && <Panel title="FIFO ledger" kicker="Oldest receipt layer first"><Table h={["Received", "SKU", "Received", "Remaining", "Unit cost", "Allocations"]}>{(d.fifo as any[]).map(x => <tr key={x.layer_id} className="border-t border-border/70"><td>{new Date(x.received_at).toLocaleDateString()}</td><td className="font-mono text-xs">{x.sku}</td><td className="text-right">{Number(x.quantity_received)}</td><td className="text-right font-semibold">{Number(x.quantity_remaining)}</td><td className="text-right">{inr(Number(x.unit_cost_inr))}</td><td className="text-right">{Number(x.allocation_count)}</td></tr>)}</Table></Panel>}
    {ledger === "msl" && <Panel title="MSL ledger" kicker="Minimum stock exceptions"><Table h={["Status", "SKU", "On hand", "MSL", "Shortfall", "Reorder", "Lead"]}>{(d.msl as any[]).map(x => <tr key={`${x.venture}-${x.sku}-${x.unit}`} className="border-t border-border/70"><td className="uppercase text-xs">{x.status}</td><td className="font-mono text-xs">{x.sku}</td><td className="text-right">{Number(x.quantity_balance)}</td><td className="text-right">{Number(x.minimum_stock_level)}</td><td className="text-right">{Number(x.shortage_quantity)}</td><td className="text-right">{Number(x.reorder_quantity)}</td><td>{Number(x.lead_time_days)} d</td></tr>)}</Table></Panel>}
  </main>;
}

function Table({ h, children }: { h: string[]; children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead className="text-[10px] uppercase tracking-wider text-subtle"><tr>{h.map(x => <th key={x} className="px-3 py-3 text-left">{x}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
