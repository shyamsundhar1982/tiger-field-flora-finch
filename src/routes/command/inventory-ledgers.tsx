import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, Kpi } from "@/components/kpi";
import { inr } from "@/lib/format";
import { getAuthoritativeInventory, getAuthoritativeInventoryMovements, getInventoryControlSummary, getInventoryFifoTrace, getInventoryMslWarnings } from "@/lib/inventory-authority";

export const Route = createFileRoute("/command/inventory-ledgers")({
  loader: async () => { const [summary, balances, movements, msl, fifo] = await Promise.all([getInventoryControlSummary(), getAuthoritativeInventory(), getAuthoritativeInventoryMovements(), getInventoryMslWarnings(), getInventoryFifoTrace()]); return { summary, balances, movements, msl, fifo }; },
  component: LedgerIndex,
});

const LEDGERS = [["stock", "Stock Ledger", "Authoritative balance, WAC and inventory value"], ["movements", "Movement Ledger", "Every posted receipt, issue, consume and return"], ["fifo", "FIFO Ledger", "Receipt layers, remaining quantities and allocations"], ["msl", "MSL Ledger", "Minimum stock, shortage, reorder and lead time"]] as const;

function LedgerIndex() {
  const d = Route.useLoaderData();
  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] uppercase tracking-[0.22em] text-green">Inventory · operational truth</p><h1 className="mt-2 text-4xl font-bold text-accent">Ledger Control</h1><p className="mt-2 max-w-3xl text-sm text-muted">Central ledger index. Select an individual ledger page, then trace SKUs from stock to posted movements, FIFO and MSL.</p></div><Link to="/command/inventory" className="rounded-lg border border-border px-4 py-2.5 text-sm">← Inventory</Link></header>
    <div className="grid gap-3 sm:grid-cols-3"><Kpi label="Authoritative SKUs" value={String(d.summary.skuCount)} /><Kpi label="Units" value={String(d.summary.totalUnits)} /><Kpi label="Inventory value" value={inr(d.summary.inventoryValueInr)} /></div>
    <Panel title="Individual ledgers" kicker="Direct working routes"><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">{LEDGERS.map(([id, title, detail]) => <Link key={id} to={`/command/inventory-ledgers/${id}` as never} className="rounded-xl border border-border p-4 hover:border-accent hover:bg-surface"><p className="font-semibold">{title}</p><p className="mt-1 text-xs text-muted">{detail}</p><span className="mt-4 inline-block text-xs font-semibold text-accent">Open →</span></Link>)}</div></Panel>
    <Panel title="Authoritative stock index" kicker="Select a SKU to trace its movement ledger"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="text-[10px] uppercase tracking-wider text-subtle"><tr>{["Venture", "SKU", "Unit", "Balance", "WAC", "Value", "Ledger"].map(x => <th key={x} className="px-3 py-3 text-left">{x}</th>)}</tr></thead><tbody>{(d.balances as any[]).map(x => <tr key={`${x.venture}-${x.sku}-${x.unit}`} className="border-t border-border/70"><td>{x.venture}</td><td className="font-mono text-xs">{x.sku}</td><td>{x.unit}</td><td className="text-right">{Number(x.quantity_balance)}</td><td className="text-right">{inr(Number(x.weighted_average_cost_inr))}</td><td className="text-right">{inr(Number(x.inventory_value_inr))}</td><td><Link to="/command/inventory-ledgers/movements" className="text-xs font-semibold text-accent">Open movements →</Link></td></tr>)}</tbody></table></div></Panel>
    <div className="flex flex-wrap gap-2"><Link to="/command/inventory-openings" className="rounded-lg border border-border px-4 py-2 text-sm">Opening Balances</Link><Link to="/command/inventory-master" className="rounded-lg border border-border px-4 py-2 text-sm">Inventory Master</Link><Link to="/command/inventory-control-audit" className="rounded-lg border border-border px-4 py-2 text-sm">MSL & FIFO Audit</Link><Link to="/command/component-control" className="rounded-lg border border-border px-4 py-2 text-sm">Component Control</Link></div>
  </main>;
}
