import { Link } from "@tanstack/react-router";
import { MASTER_INVENTORY_LEDGER_PAGES } from "@/lib/inventory-navigation";

export function InventoryWorkspaceNav({ active }: { active?: string }) {
  const stockLedgers = MASTER_INVENTORY_LEDGER_PAGES.filter((page) => page.group === "Stock");
  const assetLedgers = MASTER_INVENTORY_LEDGER_PAGES.filter((page) => page.group === "Assets");

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle">
        <Link to="/command/inventory" className="hover:text-accent">
          Master Inventory
        </Link>
      </div>
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-subtle">
          Stock & replenishment
        </p>
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          aria-label="Stock and replenishment ledgers"
        >
          {stockLedgers.map((page) => (
            <Link
              key={page.id}
              to={`/command/inventory-ledgers/${page.id}` as never}
              className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold ${active === page.id ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-accent/50"}`}
            >
              {page.label}
            </Link>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-subtle">Support assets</p>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Support asset ledgers">
          {assetLedgers.map((page) => (
            <Link
              key={page.id}
              to={`/command/inventory-ledgers/${page.id}` as never}
              className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold ${active === page.id ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-accent/50"}`}
            >
              {page.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
