import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, Kpi } from "@/components/kpi";
import { InventoryWorkspaceNav } from "@/components/inventory-workspace-nav";
import { inr } from "@/lib/format";
import { getAuthoritativeInventory, getInventoryControlSummary, getInventoryMslWarnings, getInventoryFifoTrace } from "@/lib/inventory-authority";
import { INVENTORY_CONTROL_PAGES, INVENTORY_LEDGER_PAGES } from "@/lib/inventory-navigation";

export const Route = createFileRoute("/command/inventory")({
  loader: async () => {
    const [summary, balances, msl, fifo] = await Promise.all([getInventoryControlSummary(), getAuthoritativeInventory(), getInventoryMslWarnings(), getInventoryFifoTrace()]);
    return { summary, balances, msl, fifo };
  },
  component: Inventory,
});

function Inventory() {
  const { summary, balances, msl } = Route.useLoaderData();
  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[10px] uppercase tracking-[0.22em] text-green">Operations · inventory control</p><h1 className="mt-2 text-4xl font-bold text-accent">Inventory Hub</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">Single navigation point for controlled inventory masters, BOM linkage, opening stock, authoritative truth and every operational ledger. Ledger pages remain read-only views of their authoritative source.</p></div>
      <Link to="/command" className="rounded-lg border border-border px-4 py-2.5 text-sm">← Command</Link>
    </header>
    <InventoryWorkspaceNav />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Kpi label="Authoritative SKUs" value={String(summary.skuCount)} /><Kpi label="Units" value={String(summary.totalUnits)} /><Kpi label="Inventory value" value={inr(summary.inventoryValueInr)} /><Kpi label="FIFO layers" value={String(summary.fifoLayerCount)} /><Kpi label="MSL alerts" value={String(msl.length)} /></div>
    <Panel title="Inventory control sequence" kicker="One route for each control boundary"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {INVENTORY_CONTROL_PAGES.map((page, i) => <Link key={page.id} to={page.route as never} className="rounded-xl border border-border p-4 hover:border-accent hover:bg-surface"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-bold tracking-[0.16em] text-accent">{String(i + 1).padStart(2, "0")}</span><span className="text-xs text-accent">Open →</span></div><p className="mt-3 font-semibold text-fg">{page.label}</p><p className="mt-1 text-xs leading-5 text-muted">{page.detail}</p></Link>)}
    </div></Panel>
    <Panel title="Operational ledgers" kicker="Seven ledgers · four inventory + three manufacturing support views"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {INVENTORY_LEDGER_PAGES.map(page => <Link key={page.id} to={("/command/inventory-ledgers/" + page.id) as never} className="rounded-xl border border-border p-4 hover:border-accent hover:bg-surface"><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">{page.group}</p><p className="mt-2 font-semibold text-fg">{page.label}</p><p className="mt-1 text-xs leading-5 text-muted">{page.detail}</p><span className="mt-4 inline-block text-xs font-semibold text-accent">Open ledger →</span></Link>)}
    </div></Panel>
    <Panel title="Authoritative stock trace" kicker="Every SKU should resolve to the same ledger chain"><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead className="text-[10px] uppercase tracking-wider text-subtle"><tr>{["Venture","SKU","Unit","Balance","WAC","Value","Trace"].map(x => <th key={x} className="px-3 py-3 text-left">{x}</th>)}</tr></thead><tbody>
      {(balances as any[]).map(x => <tr key={x.venture + "-" + x.sku + "-" + x.unit} className="border-t border-border/70"><td className="px-3 py-3">{x.venture}</td><td className="px-3 py-3 font-mono text-xs">{x.sku}</td><td className="px-3 py-3">{x.unit}</td><td className="px-3 py-3 text-right">{Number(x.quantity_balance)}</td><td className="px-3 py-3 text-right">{inr(Number(x.weighted_average_cost_inr))}</td><td className="px-3 py-3 text-right">{inr(Number(x.inventory_value_inr))}</td><td className="px-3 py-3"><Link to="/command/inventory-ledgers/movements" search={{ sku: x.sku } as never} className="text-xs font-semibold text-accent">Movements →</Link></td></tr>)}
    </tbody></table></div></Panel>
    <div className="grid gap-3 md:grid-cols-3"><Link to="/command/production" className="rounded-xl border border-border p-4 hover:border-accent"><p className="font-semibold">Production</p><p className="mt-1 text-xs text-muted">Demand and issue/consumption follows inventory truth.</p></Link><Link to="/command/procurement" className="rounded-xl border border-border p-4 hover:border-accent"><p className="font-semibold">Procurement</p><p className="mt-1 text-xs text-muted">Replenishment signals originate from MSL and stock position.</p></Link><Link to="/command/component-control" className="rounded-xl border border-border p-4 hover:border-accent"><p className="font-semibold">Component Control</p><p className="mt-1 text-xs text-muted">Component identity and configuration remain anchored to Inventory Master.</p></Link></div>
  </main>;
}
