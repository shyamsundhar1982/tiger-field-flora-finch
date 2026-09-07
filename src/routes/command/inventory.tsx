import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, Kpi } from "@/components/kpi";
import { InventoryWorkspaceNav } from "@/components/inventory-workspace-nav";
import { inr } from "@/lib/format";
import { getAuthoritativeInventory, getInventoryControlSummary, getInventoryMslWarnings, getInventoryFifoTrace } from "@/lib/inventory-authority";
import { INVENTORY_CONTROL_PAGES, INVENTORY_LEDGER_PAGES } from "@/lib/inventory-navigation";
import { forecastLedger } from "@/lib/master-ledger";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/inventory")({
  loader: async () => {
    const [summary, balances, msl, fifo] = await Promise.all([getInventoryControlSummary(), getAuthoritativeInventory(), getInventoryMslWarnings(), getInventoryFifoTrace()]);
    return { summary, balances, msl, fifo };
  },
  component: Inventory,
});

function Inventory() {
  const { summary, msl } = Route.useLoaderData();
  const rows = useVeloxis((state) => state.masterLedgerRows);
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[10px] uppercase tracking-[0.22em] text-green">Operations · ERP inventory control</p><h1 className="mt-2 text-4xl font-bold text-accent">Inventory Control Hub</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">The ERP entry point for controlled inventory identity, openings, authoritative stock truth, and replenishment signals. Ledger projections below are local planning views and never replace posted ERP balances.</p></div>
      <Link to="/command" className="rounded-lg border border-border px-4 py-2.5 text-sm">← Command</Link>
    </header>
    <InventoryWorkspaceNav />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Kpi label="Authoritative SKUs" value={String(summary.skuCount)} /><Kpi label="Units on ERP ledger" value={String(summary.totalUnits)} /><Kpi label="Inventory value" value={inr(summary.inventoryValueInr)} /><Kpi label="FIFO layers" value={String(summary.fifoLayerCount)} /><Kpi label="MSL alerts" value={String(msl.length)} /></div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm"><div><p className="font-semibold text-fg">Authoritative read model</p><p className="mt-1 text-xs text-muted">Balances, valuation, movements, MSL and FIFO are posted and read from the server-backed ERP ledger.</p></div><Link to="/command/inventory-truth" className="rounded-lg border border-accent/40 px-3 py-2 text-xs font-semibold text-accent">Open Inventory Truth →</Link></div>
    <Panel title="Planning ledger register" kicker="Local planning projection · 36 months · not posted ERP inventory">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{INVENTORY_LEDGER_PAGES.map((page) => { const forecast = forecastLedger(rows, page.id); return <Link key={page.id} to={(`/command/inventory-ledgers/${page.id}`) as never} className="rounded-xl border border-border p-4 transition-colors hover:border-accent hover:bg-surface"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">{page.group}</p><p className="mt-1 font-semibold text-fg">{page.label}</p></div><span className={forecast.status === "Replenish" ? "text-xs font-semibold text-warn" : "text-xs font-semibold text-green"}>{forecast.status}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><p className="text-subtle">Available</p><p className="mt-1 font-semibold text-fg">{forecast.quantity}</p></div><div><p className="text-subtle">MSL</p><p className="mt-1 font-semibold text-fg">{forecast.mslLevel}</p></div><div><p className="text-subtle">Monthly plan</p><p className="mt-1 font-semibold text-fg">{forecast.monthlyDemand}</p></div><div><p className="text-subtle">36-mo purchase</p><p className="mt-1 font-semibold text-accent">{forecast.plannedPurchaseQuantity}</p></div></div><p className="mt-4 text-xs text-muted">{forecast.firstReplenishmentMonth ? `Replenish from month ${forecast.firstReplenishmentMonth}.` : "No purchase trigger in the 36-month plan."} Open ledger →</p></Link>; })}</div>
      <p className="mt-4 rounded-lg border border-border bg-bg-elevated/40 p-3 text-xs leading-5 text-muted">Planning rule: monthly demand is half the configured MSL, rounded up, with a minimum of one unit whenever a ledger has stock or an MSL configured. Purchase quantity restores MSL after each projected monthly draw.</p>
    </Panel>
    <div className="flex flex-wrap gap-2">{INVENTORY_CONTROL_PAGES.map((page) => <Link key={page.id} to={page.route as never} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted hover:border-accent hover:text-accent">{page.label}</Link>)}</div>
  </main>;
}
