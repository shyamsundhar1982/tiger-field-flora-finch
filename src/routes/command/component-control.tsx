import { createFileRoute, Link } from "@tanstack/react-router";
import { InventoryWorkspaceNav } from "@/components/inventory-workspace-nav";

export const Route = createFileRoute("/command/component-control")({ component: ComponentControl });

function ComponentControl() {
  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-6">
    <header><p className="text-[10px] uppercase tracking-[0.22em] text-green">Inventory · component control</p><h1 className="mt-2 text-4xl font-bold text-accent">Component Control</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">Component control is not a second inventory system. Use the Inventory Hub as the navigation authority, then follow the controlled master → BOM → mapping → opening → ledger chain.</p></header>
    <InventoryWorkspaceNav />
    <div className="grid gap-3 md:grid-cols-2"><Link to="/command/inventory" className="rounded-xl border border-accent/50 bg-accent/5 p-5 hover:border-accent"><p className="font-semibold text-accent">Open Inventory Hub →</p><p className="mt-1 text-xs leading-5 text-muted">Start from the single inventory navigation surface.</p></Link><Link to="/command/inventory-ledgers" className="rounded-xl border border-border p-5 hover:border-accent"><p className="font-semibold">Open Ledger Control →</p><p className="mt-1 text-xs leading-5 text-muted">Review all seven operational ledgers without switching systems.</p></Link></div>
  </main>;
}
