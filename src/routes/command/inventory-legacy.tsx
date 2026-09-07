import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, ChevronRight } from "lucide-react";
import { INVENTORY_CONTROL_PAGES } from "@/lib/inventory-navigation";

export const Route = createFileRoute("/command/inventory-legacy")({
  component: InventoryLegacy,
});

function InventoryLegacy() {
  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-subtle">
            <Archive className="size-3.5" />
            Admin · archived workflow
          </p>
          <h1 className="mt-2 font-display text-4xl text-accent">Legacy Inventory Controls</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            The previous specialist screens remain available for migration and historical
            verification. They are hidden from normal navigation and restricted to administrators.
          </p>
        </div>
        <Link
          to="/command/inventory"
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold"
        >
          ← Master Inventory
        </Link>
      </header>

      <section className="rounded-xl border border-warn/30 bg-warn/5 p-4 text-xs leading-5 text-muted">
        <strong className="text-fg">Legacy only.</strong> Do not create parallel inventory truth
        here. New items, MSL controls, demand plans, receipts and FIFO issues belong in Master
        Inventory.
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {INVENTORY_CONTROL_PAGES.map((page) => (
          <Link
            key={page.id}
            to={page.route as never}
            className="group rounded-xl border border-border bg-bg-elevated p-5 transition-colors hover:border-accent/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-fg">{page.label}</p>
                <p className="mt-2 text-xs leading-5 text-muted">{page.detail}</p>
              </div>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
            </div>
          </Link>
        ))}
      </section>

      <div className="flex justify-end">
        <a href="/inventory" className="text-xs text-subtle hover:text-accent">
          Open legacy public component reference →
        </a>
      </div>
    </main>
  );
}
