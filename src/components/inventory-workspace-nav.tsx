import { Link } from "@tanstack/react-router";
import { INVENTORY_CONTROL_PAGES, INVENTORY_LEDGER_PAGES } from "@/lib/inventory-navigation";

export function InventoryWorkspaceNav({ active }: { active?: string }) {
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2" aria-label="Inventory control pages">
      {INVENTORY_CONTROL_PAGES.map(page => <Link key={page.id} to={page.route as never} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${active === page.id ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-accent/50"}`}>{page.label}</Link>)}
    </div>
    <div className="flex flex-wrap gap-2" aria-label="Inventory ledgers">
      {INVENTORY_LEDGER_PAGES.map(page => <Link key={page.id} to={`/command/inventory-ledgers/${page.id}` as never} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${active === page.id ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-accent/50"}`}>{page.label}</Link>)}
    </div>
  </div>;
}
