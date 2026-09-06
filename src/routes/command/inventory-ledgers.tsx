import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, Kpi } from "@/components/kpi";
import { InventoryWorkspaceNav } from "@/components/inventory-workspace-nav";
import { inr } from "@/lib/format";
import { getAuthoritativeInventory, getAuthoritativeInventoryMovements, getInventoryControlSummary, getInventoryFifoTrace, getInventoryMslWarnings } from "@/lib/inventory-authority";
import { INVENTORY_LEDGER_PAGES } from "@/lib/inventory-navigation";

export const Route = createFileRoute("/command/inventory-ledgers")({
  loader: async () => {
    const [summary, balances, movements, msl, fifo] = await Promise.all([getInventoryControlSummary(), getAuthoritativeInventory(), getAuthoritativeInventoryMovements(), getInventoryMslWarnings(), getInventoryFifoTrace()]);
    return { summary, balances, movements, msl, fifo };
  },
  component: LedgerIndex,
});

function LedgerIndex() {
  const d = Route.useLoaderData();
  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] uppercase tracking-[0.22em] text-green">Inventory · operational truth</p><h1 className="mt-2 text-4xl font-bold text-accent">Ledger Control</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">Central index for the four authoritative inventory ledgers and three manufacturing-support asset ledgers.</p></div><Link to="/command/inventory" className="rounded-lg border border-border px-4 py-2.5 text-sm">← Inventory Hub</Link></header>
    <InventoryWorkspaceNav active="stock" />
    <div className="grid gap-3 sm:grid-cols-3"><Kpi label="Authoritative SKUs" value={String(d.summary.skuCount)} /><Kpi label="Units" value={String(d.summary.totalUnits)} /><Kpi label="Inventory value" value={inr(d.summary.inventoryValueInr)} /></div>
    <Panel title="All operational ledgers" kicker="One registry · no duplicate navigation trees"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{INVENTORY_LEDGER_PAGES.map((page, i) => <Link key={page.id} to={("/command/inventory-ledgers/" + page.id) as never} className="rounded-xl border border-border p-4 hover:border-accent hover:bg-surface"><div className="flex justify-between gap-3"><span className="text-[10px] uppercase tracking-[0.14em] text-subtle">{String(i + 1).padStart(2, "0")} · {page.group}</span><span className="text-xs text-accent">Open →</span></div><p className="mt-3 font-semibold">{page.label}</p><p className="mt-1 text-xs leading-5 text-muted">{page.detail}</p></Link>)}</div></Panel>
    <Panel title="Authoritative stock index" kicker="Select a SKU to trace movements"><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead className="text-[10px] uppercase tracking-wider text-subtle"><tr>{["Venture","SKU","Unit","Balance","WAC","Value","Ledger"].map(x => <th key={x} className="px-3 py-3 text-left">{x}</th>)}</tr></thead><tbody>{(d.balances as any[]).map(x => <tr key={x.venture + "-" + x.sku + "-" + x.unit} className="border-t border-border/70"><td className="px-3 py-3">{x.venture}</td><td className="px-3 py-3 font-mono text-xs">{x.sku}</td><td className="px-3 py-3">{x.unit}</td><td className="px-3 py-3 text-right">{Number(x.quantity_balance)}</td><td className="px-3 py-3 text-right">{inr(Number(x.weighted_average_cost_inr))}</td><td className="px-3 py-3 text-right">{inr(Number(x.inventory_value_inr))}</td><td className="px-3 py-3"><Link to="/command/inventory-ledgers/movements" className="text-xs font-semibold text-accent">Movements →</Link></td></tr>)}</tbody></table></div></Panel>
    <div className="flex flex-wrap gap-2"><Link to="/command/inventory-openings" className="rounded-lg border border-border px-4 py-2 text-sm">Opening Balances</Link><Link to="/command/inventory-master" className="rounded-lg border border-border px-4 py-2 text-sm">Inventory Master</Link><Link to="/command/bom-inventory-mapping" className="rounded-lg border border-border px-4 py-2 text-sm">BOM → Inventory</Link><Link to="/command/inventory-control-audit" className="rounded-lg border border-border px-4 py-2 text-sm">MSL & FIFO Audit</Link></div>
  </main>;
}
