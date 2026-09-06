import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/command/component-control")({
  component: ComponentControlRedirect,
});

function ComponentControlRedirect() {
  return <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-4">
    <p className="text-[10px] uppercase tracking-[0.22em] text-green">Inventory · component control</p>
    <h1 className="text-3xl font-bold text-accent">Component Control</h1>
    <p className="text-sm text-muted">Component control is anchored in the Inventory engine. Use the controlled inventory chain to select the component and open its authoritative ledger.</p>
    <div className="flex flex-wrap gap-2">
      <Link to="/command/inventory" className="rounded-lg border border-accent px-4 py-2.5 text-sm font-semibold text-accent">Open Inventory</Link>
      <Link to="/command/inventory-ledgers" className="rounded-lg border border-border px-4 py-2.5 text-sm">Open Ledger Control</Link>
    </div>
  </main>;
}
