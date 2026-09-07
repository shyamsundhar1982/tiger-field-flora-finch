import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, Kpi } from "@/components/kpi";
import { InventoryWorkspaceNav } from "@/components/inventory-workspace-nav";
import { inr } from "@/lib/format";
import { getInventoryControlSummary } from "@/lib/inventory-authority";
import { INVENTORY_LEDGER_PAGES } from "@/lib/inventory-navigation";

export const Route = createFileRoute("/command/inventory-ledgers")({
  loader: async () => {
    return { summary: await getInventoryControlSummary() };
  },
  component: LedgerIndex,
});

function LedgerIndex() {
  const d = Route.useLoaderData();
  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] uppercase tracking-[0.22em] text-green">Inventory · ledger navigation</p><h1 className="mt-2 text-4xl font-bold text-accent">Ledger Control</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">Navigation index for authoritative stock projections and separate support-asset planning views. Posted balances and movements are owned by Inventory Truth.</p></div><Link to="/command/inventory" className="rounded-lg border border-border px-4 py-2.5 text-sm">← Inventory Hub</Link></header>
    <InventoryWorkspaceNav active="stock" />
    <div className="grid gap-3 sm:grid-cols-3"><Kpi label="Authoritative SKUs" value={String(d.summary.skuCount)} /><Kpi label="Units" value={String(d.summary.totalUnits)} /><Kpi label="Inventory value" value={inr(d.summary.inventoryValueInr)} /></div>
    <Panel title="Stock & replenishment" kicker="Authoritative projections over the posted ERP ledger"><div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs"><span className="text-muted">For balances, valuation, MSL warnings, FIFO layers, and movements, use the canonical read model.</span><Link to="/command/inventory-truth" className="font-semibold text-accent">Open Inventory Truth →</Link></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{INVENTORY_LEDGER_PAGES.filter(page => page.group === "Stock & replenishment").map((page, i) => <Link key={page.id} to={("/command/inventory-ledgers/" + page.id) as never} className="rounded-xl border border-border p-4 hover:border-accent hover:bg-surface"><div className="flex justify-between gap-3"><span className="text-[10px] uppercase tracking-[0.14em] text-subtle">{String(i + 1).padStart(2, "0")}</span><span className="text-xs text-accent">Open →</span></div><p className="mt-3 font-semibold">{page.label}</p><p className="mt-1 text-xs leading-5 text-muted">{page.detail}</p></Link>)}</div></Panel>
    <Panel title="Support assets" kicker="Planning views kept separate from stock truth"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{INVENTORY_LEDGER_PAGES.filter(page => page.group === "Support assets").map((page, i) => <Link key={page.id} to={("/command/inventory-ledgers/" + page.id) as never} className="rounded-xl border border-border p-4 hover:border-accent hover:bg-surface"><div className="flex justify-between gap-3"><span className="text-[10px] uppercase tracking-[0.14em] text-subtle">{String(i + 1).padStart(2, "0")}</span><span className="text-xs text-accent">Open →</span></div><p className="mt-3 font-semibold">{page.label}</p><p className="mt-1 text-xs leading-5 text-muted">{page.detail}</p></Link>)}</div></Panel>
    <div className="rounded-xl border border-border bg-surface/30 p-4 text-sm"><p className="font-semibold text-fg">Need posted stock detail?</p><p className="mt-1 text-xs leading-5 text-muted">The full authoritative balance, movement, FIFO and MSL tables live in one canonical read model to prevent conflicting inventory displays.</p><Link to="/command/inventory-truth" className="mt-3 inline-flex rounded-lg border border-accent/40 px-3 py-2 text-xs font-semibold text-accent">Open Inventory Truth →</Link></div>
    <div className="flex flex-wrap gap-2"><Link to="/command/inventory-openings" className="rounded-lg border border-border px-4 py-2 text-sm">Opening Balances</Link><Link to="/command/inventory-master" className="rounded-lg border border-border px-4 py-2 text-sm">Inventory Master</Link><Link to="/command/bom-inventory-mapping" className="rounded-lg border border-border px-4 py-2 text-sm">BOM → Inventory</Link><Link to="/command/inventory-control-audit" className="rounded-lg border border-border px-4 py-2 text-sm">MSL & FIFO Audit</Link></div>
  </main>;
}
