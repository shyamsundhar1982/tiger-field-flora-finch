import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, Kpi } from "@/components/kpi";
import { inr } from "@/lib/format";
import { getAuthoritativeInventory, getInventoryControlSummary, getInventoryMslWarnings, getInventoryFifoTrace } from "@/lib/inventory-authority";

export const Route = createFileRoute("/command/inventory")({ loader: async () => { const [summary, balances, msl, fifo] = await Promise.all([getInventoryControlSummary(), getAuthoritativeInventory(), getInventoryMslWarnings(), getInventoryFifoTrace()]); return { summary, balances, msl, fifo }; }, component: Inventory });

const LEDGER_PAGES = [
  ["stock", "Stock Ledger", "Authoritative balance + WAC"],
  ["movements", "Movement Ledger", "Every posted receipt / issue / return"],
  ["fifo", "FIFO Ledger", "Receipt layers and allocations"],
  ["msl", "MSL Ledger", "Minimum stock and replenishment"],
] as const;

function Inventory() {
  const { summary, balances, msl } = Route.useLoaderData();
  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[10px] uppercase tracking-[0.22em] text-green">Operations · inventory control</p><h1 className="mt-2 text-4xl font-bold text-accent">Inventory</h1><p className="mt-2 max-w-3xl text-sm text-muted">One operational inventory chain: controlled SKU identity → BOM requirement → posted stock → individual ledgers → production.</p></div>
      <div className="flex gap-2"><Link to="/command/inventory-master" className="rounded-lg border border-accent px-4 py-2.5 text-sm font-semibold text-accent">Manage SKUs</Link><Link to="/command/bom-control" className="rounded-lg border border-border px-4 py-2.5 text-sm">Manage BOM</Link></div>
    </header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Kpi label="Authoritative SKUs" value={String(summary.skuCount)} /><Kpi label="Units" value={String(summary.totalUnits)} /><Kpi label="Inventory value" value={inr(summary.inventoryValueInr)} /><Kpi label="FIFO layers" value={String(summary.fifoLayerCount)} /><Kpi label="MSL alerts" value={String(msl.length)} /></div>
    <Panel title="Ledger Engine" kicker="Direct, working pages — no dead links">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">{LEDGER_PAGES.map(([id, title, detail]) => <Link key={id} to={`/command/inventory-ledgers/${id}` as never} className="rounded-xl border border-border p-4 transition-colors hover:border-accent hover:bg-surface"><p className="font-semibold text-fg">{title}</p><p className="mt-1 text-xs text-muted">{detail}</p><span className="mt-4 inline-block text-xs font-semibold text-accent">Open ledger →</span></Link>)}</div>
      <Link to="/command/inventory-ledgers" className="mt-4 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-semibold">Ledger Control / Index →</Link>
    </Panel>
    <div className="grid gap-4 md:grid-cols-3"><Panel title="Inventory Master"><p className="text-sm text-muted">Add, submit and approve SKUs. Controlled identity remains separate from posted stock.</p><Link to="/command/inventory-master" className="mt-3 inline-block text-xs font-semibold text-accent">Open Inventory Master →</Link></Panel><Panel title="BOM Control"><p className="text-sm text-muted">Create BOM revisions and explicit component-to-SKU requirements. Approved mappings feed component control.</p><Link to="/command/bom-control" className="mt-3 inline-block text-xs font-semibold text-accent">Open BOM Control →</Link></Panel><Panel title="Opening Balance"><p className="text-sm text-muted">Use the controlled opening workflow to put starting stock into authoritative inventory.</p><Link to="/command/inventory-openings" className="mt-3 inline-block text-xs font-semibold text-accent">Open Opening Balance →</Link></Panel></div>
    <Panel title="Control chain"><div className="grid gap-3 md:grid-cols-6">{[["01","SKU","Identity"],["02","BOM","Requirement"],["03","Mapping","Approved relationship"],["04","Opening / receipt","Posted stock"],["05","Ledgers","Truth + trace"],["06","Production","Requirement / issue"]].map(([n,t,d]) => <div key={n} className="rounded-xl border border-border p-4"><span className="text-[10px] text-accent">{n}</span><p className="mt-2 text-sm font-semibold">{t}</p><p className="mt-1 text-xs text-muted">{d}</p></div>)}</div></Panel>
    <Panel title="Ledger access rule" kicker="Every SKU must be traceable"><p className="text-sm text-muted">Select an individual SKU from the Stock Ledger to trace its posted movements, FIFO layers and MSL position. The ledger pages are read from authoritative inventory data only.</p><Link to="/command/inventory-ledgers/stock" className="mt-3 inline-block text-xs font-semibold text-accent">Open Stock Ledger →</Link></Panel>
  </main>;
}
