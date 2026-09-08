import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  Archive,
  CheckCircle2,
  ChevronRight,
  PackagePlus,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Kpi } from "@/components/kpi";
import { getCommandRole } from "@/lib/command-access";
import {
  MASTER_INVENTORY_LEDGER_PAGES,
  type MasterInventoryLedgerId,
} from "@/lib/inventory-navigation";
import {
  forecastStock,
  stockHealth,
  type ForecastStatus,
  type StockHealth,
} from "@/lib/master-ledger";
import {
  getMasterInventoryData,
  saveMasterInventoryEntry,
  type MasterInventoryItemRecord,
} from "@/lib/master-inventory";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/command/inventory")({
  loader: async () => {
    const [inventory, role] = await Promise.all([getMasterInventoryData(), getCommandRole()]);
    return { ...inventory, role };
  },
  component: MasterInventory,
});

type InventoryViewItem = Omit<
  MasterInventoryItemRecord,
  "minimum_stock_level" | "planned_monthly_use" | "available_quantity" | "stock_value_inr"
> & {
  minimumStockLevel: number;
  plannedMonthlyUse: number;
  availableQuantity: number;
  stockValueInr: number;
  health: StockHealth;
  forecast: ReturnType<typeof forecastStock>;
};

const today = () => new Date().toISOString().slice(0, 10);
const blankEntry = {
  ledgerId: "components" as MasterInventoryLedgerId,
  sku: "",
  name: "",
  category: "",
  unit: "ea",
  minimumStockLevel: "0",
  plannedMonthlyUse: "0",
  quantityReceived: "0",
  unitCostInr: "0",
  receivedOn: today(),
  expiryOn: "",
  nextInspectionOn: "",
  reference: "",
  notes: "",
};

const suggestedCategories = [
  "groupset",
  "wheelset",
  "tyre",
  "handlebar",
  "stem",
  "saddle",
  "thruaxle",
  "bottom-bracket",
  "bottle-cage",
  "fastener",
  "carbon",
  "aluminium",
  "paint",
  "consumable",
  "jig",
  "mould",
  "inspection",
  "test-equipment",
  "workshop-tool",
];

function asNumber(value: number | string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function viewItem(item: MasterInventoryItemRecord): InventoryViewItem {
  const availableQuantity = asNumber(item.available_quantity);
  const minimumStockLevel = asNumber(item.minimum_stock_level);
  const plannedMonthlyUse = asNumber(item.planned_monthly_use);
  return {
    ...item,
    availableQuantity,
    minimumStockLevel,
    plannedMonthlyUse,
    stockValueInr: asNumber(item.stock_value_inr),
    health: stockHealth(availableQuantity, minimumStockLevel),
    forecast: forecastStock(availableQuantity, minimumStockLevel, plannedMonthlyUse),
  };
}

function healthClass(health: StockHealth) {
  if (health === "Sufficient") return "border-green/30 bg-green/10 text-green";
  if (health === "At MSL") return "border-accent/30 bg-accent/10 text-accent";
  return "border-warn/30 bg-warn/10 text-warn";
}

function forecastClass(status: ForecastStatus) {
  if (status === "On plan") return "text-green";
  if (status === "Replenish") return "text-warn";
  return "text-subtle";
}

function forecastLabel(item: InventoryViewItem) {
  if (item.forecast.status === "Plan missing") return "Plan missing";
  if (item.forecast.firstReplenishmentMonth === 0) return "Replenish now";
  if (item.forecast.firstReplenishmentMonth !== null)
    return `Replenish M${item.forecast.firstReplenishmentMonth}`;
  return "Covered · 36 mo";
}

function ledgerLabel(id: MasterInventoryLedgerId) {
  return MASTER_INVENTORY_LEDGER_PAGES.find((ledger) => ledger.id === id)?.label ?? id;
}

function MasterInventory() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const items = useMemo(() => data.items.map(viewItem), [data.items]);
  const [entryOpen, setEntryOpen] = useState(false);
  const [draft, setDraft] = useState(blankEntry);
  const [search, setSearch] = useState("");
  const [ledgerFilter, setLedgerFilter] = useState<"all" | MasterInventoryLedgerId>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category))].sort(),
    [items],
  );
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (ledgerFilter !== "all" && item.ledger_id !== ledgerFilter) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      return (
        !query || `${item.sku} ${item.name} ${item.category}`.toLocaleLowerCase().includes(query)
      );
    });
  }, [categoryFilter, items, ledgerFilter, search]);

  const onHand = items.reduce((sum, item) => sum + item.availableQuantity, 0);
  const sufficient = items.filter(
    (item) => item.health === "Sufficient" || item.health === "At MSL",
  ).length;
  const mslAlerts = items.filter(
    (item) => item.health === "Below MSL" || item.health === "Out of stock",
  ).length;
  const replenish = items.filter((item) => item.forecast.status === "Replenish").length;
  const planMissing = items.filter((item) => item.forecast.status === "Plan missing").length;

  async function saveEntry() {
    setMessage("");
    const quantityReceived = Number(draft.quantityReceived);
    if (!draft.sku.trim() || !draft.name.trim() || !draft.category.trim()) {
      setMessage("SKU, item name and category are required.");
      return;
    }
    if (quantityReceived > 0 && !draft.reference.trim()) {
      setMessage("A receipt reference is required when quantity is received.");
      return;
    }
    setBusy(true);
    try {
      await saveMasterInventoryEntry({
        data: {
          ledgerId: draft.ledgerId,
          sku: draft.sku,
          name: draft.name,
          category: draft.category,
          unit: draft.unit,
          minimumStockLevel: Number(draft.minimumStockLevel),
          plannedMonthlyUse: Number(draft.plannedMonthlyUse),
          quantityReceived,
          unitCostInr: Number(draft.unitCostInr),
          receivedOn: draft.receivedOn,
          expiryOn: draft.expiryOn,
          nextInspectionOn: draft.nextInspectionOn,
          reference: draft.reference,
          notes: draft.notes,
        },
      });
      setDraft({ ...blankEntry, ledgerId: draft.ledgerId, receivedOn: today() });
      setMessage("Saved. The item and receipt are now in the selected ledger.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Inventory entry could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-green">
            Operate · one inventory workspace
          </p>
          <h1 className="mt-2 font-display text-4xl text-accent">Master Inventory</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Stock health, MSL and 36-month demand coverage in one place. Every item is stored under
            one category and one auditable ledger.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/command/receiving" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg">
            <PackagePlus className="size-4" />
            Receive against PO
          </Link>
          <button
            type="button"
            onClick={() => setEntryOpen((open) => !open)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-fg hover:border-accent"
          >
            <PackagePlus className="size-4" />
            {entryOpen ? "Close entry" : "Item / manual receipt"}
          </button>
        </div>
      </header>

      {entryOpen ? (
        <section
          className="rounded-xl border border-accent/35 bg-bg-elevated p-5"
          aria-label="Single inventory entry"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                Single point entry
              </p>
              <h2 className="mt-1 font-display text-xl">Save to a ledger</h2>
            </div>
            <p className="max-w-md text-xs leading-5 text-muted">
              Use this for master-data setup and evidenced non-PO adjustments. Supplier deliveries
              should enter through Receiving so PO, inspection, FIFO and payables stay linked.
            </p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-medium text-muted">
              Ledger
              <select
                className="control mt-1.5"
                value={draft.ledgerId}
                onChange={(event) =>
                  setDraft({ ...draft, ledgerId: event.target.value as MasterInventoryLedgerId })
                }
              >
                {MASTER_INVENTORY_LEDGER_PAGES.map((ledger) => (
                  <option key={ledger.id} value={ledger.id}>
                    {ledger.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted">
              Category
              <input
                className="control mt-1.5"
                list="inventory-categories"
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                placeholder="e.g. wheelset"
              />
              <datalist id="inventory-categories">
                {[...new Set([...categories, ...suggestedCategories])].map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </label>
            <label className="text-xs font-medium text-muted">
              SKU / item code
              <input
                className="control mt-1.5 uppercase"
                value={draft.sku}
                onChange={(event) => setDraft({ ...draft, sku: event.target.value })}
                placeholder="SKU-001"
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Item name
              <input
                className="control mt-1.5"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Item description"
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Quantity received
              <input
                className="control mt-1.5"
                type="number"
                min="0"
                step="0.01"
                value={draft.quantityReceived}
                onChange={(event) => setDraft({ ...draft, quantityReceived: event.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Unit
              <select
                className="control mt-1.5"
                value={draft.unit}
                onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
              >
                <option value="ea">Each</option>
                <option value="pair">Pair</option>
                <option value="set">Set</option>
                <option value="kg">kg</option>
                <option value="m">metre</option>
                <option value="litre">litre</option>
              </select>
            </label>
            <label className="text-xs font-medium text-muted">
              MSL
              <input
                className="control mt-1.5"
                type="number"
                min="0"
                step="0.01"
                value={draft.minimumStockLevel}
                onChange={(event) => setDraft({ ...draft, minimumStockLevel: event.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Planned use / month
              <input
                className="control mt-1.5"
                type="number"
                min="0"
                step="0.01"
                value={draft.plannedMonthlyUse}
                onChange={(event) => setDraft({ ...draft, plannedMonthlyUse: event.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Unit cost · ₹
              <input
                className="control mt-1.5"
                type="number"
                min="0"
                step="0.01"
                value={draft.unitCostInr}
                onChange={(event) => setDraft({ ...draft, unitCostInr: event.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Receipt date
              <input
                className="control mt-1.5"
                type="date"
                value={draft.receivedOn}
                onChange={(event) => setDraft({ ...draft, receivedOn: event.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Receipt reference
              <input
                className="control mt-1.5"
                value={draft.reference}
                onChange={(event) => setDraft({ ...draft, reference: event.target.value })}
                placeholder="PO / invoice / opening ref"
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Notes
              <input
                className="control mt-1.5"
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                placeholder="Optional"
              />
            </label>
          </div>
          <details className="mt-4 rounded-lg border border-border px-4 py-3 text-xs text-muted">
            <summary className="cursor-pointer font-semibold text-fg">
              Expiry and inspection dates
            </summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label>
                Expiry date
                <input
                  className="control mt-1.5"
                  type="date"
                  value={draft.expiryOn}
                  onChange={(event) => setDraft({ ...draft, expiryOn: event.target.value })}
                />
              </label>
              <label>
                Next inspection
                <input
                  className="control mt-1.5"
                  type="date"
                  value={draft.nextInspectionOn}
                  onChange={(event) => setDraft({ ...draft, nextInspectionOn: event.target.value })}
                />
              </label>
            </div>
          </details>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveEntry()}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg disabled:opacity-50"
            >
              {busy ? "Saving…" : `Save to ${ledgerLabel(draft.ledgerId)}`}
            </button>
            {message ? (
              <p
                role="status"
                className={cn("text-xs", message.startsWith("Saved") ? "text-green" : "text-warn")}
              >
                {message}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Inventory health summary"
      >
        <Kpi
          label="Available quantity"
          value={onHand.toLocaleString("en-IN")}
          hint={`Across ${items.length} SKUs`}
        />
        <Kpi
          label="Sufficient stock"
          value={`${sufficient} / ${items.length}`}
          hint="At or above MSL"
          tone={sufficient === items.length ? "ok" : "warn"}
        />
        <Kpi
          label="MSL alerts"
          value={String(mslAlerts)}
          hint="Below minimum or out of stock"
          tone={mslAlerts ? "warn" : "ok"}
        />
        <Kpi
          label="Forecast status"
          value={`${replenish} due`}
          hint={`${planMissing} SKU${planMissing === 1 ? "" : "s"} missing a demand plan`}
          tone={replenish ? "warn" : planMissing ? "default" : "ok"}
        />
      </section>

      <section aria-labelledby="ledger-heading">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle">
              Audit spreadsheets
            </p>
            <h2 id="ledger-heading" className="mt-1 font-display text-2xl">
              Ledgers
            </h2>
          </div>
          <p className="hidden text-xs text-muted sm:block">
            Open any ledger for receipt lots and FIFO history
          </p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {MASTER_INVENTORY_LEDGER_PAGES.map((ledger) => {
            const ledgerItems = items.filter((item) => item.ledger_id === ledger.id);
            const ledgerAvailable = ledgerItems.reduce(
              (sum, item) => sum + item.availableQuantity,
              0,
            );
            const ledgerAlerts = ledgerItems.filter(
              (item) => item.health === "Below MSL" || item.health === "Out of stock",
            ).length;
            return (
              <Link
                key={ledger.id}
                to="/command/inventory-ledgers/$ledger"
                params={{ ledger: ledger.id }}
                search={{ sku: undefined }}
                className="group rounded-xl border border-border bg-bg-elevated p-4 transition-colors hover:border-accent/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-fg">{ledger.label}</p>
                  <ChevronRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                </div>
                <p className="mt-1 min-h-10 text-xs leading-5 text-muted">{ledger.detail}</p>
                <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-subtle">Available</p>
                    <p className="mt-1 font-display text-xl tabular-nums">
                      {ledgerAvailable.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      ledgerAlerts ? "text-warn" : "text-green",
                    )}
                  >
                    {ledgerAlerts
                      ? `${ledgerAlerts} alert${ledgerAlerts === 1 ? "" : "s"}`
                      : "Healthy"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section
        className="rounded-xl border border-border bg-bg-elevated"
        aria-labelledby="stock-heading"
      >
        <div className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle">
              Current position
            </p>
            <h2 id="stock-heading" className="mt-1 font-display text-2xl">
              Stock health
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="relative">
              <span className="sr-only">Search inventory</span>
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-subtle" />
              <input
                className="control min-w-56 pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search item or SKU"
              />
            </label>
            <select
              aria-label="Filter by ledger"
              className="control"
              value={ledgerFilter}
              onChange={(event) =>
                setLedgerFilter(event.target.value as "all" | MasterInventoryLedgerId)
              }
            >
              <option value="all">All ledgers</option>
              {MASTER_INVENTORY_LEDGER_PAGES.map((ledger) => (
                <option key={ledger.id} value={ledger.id}>
                  {ledger.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by category"
              className="control"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="text-[10px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="px-5 py-3 text-left">Item</th>
                <th className="px-3 py-3 text-left">Ledger</th>
                <th className="px-3 py-3 text-right">Available</th>
                <th className="px-3 py-3 text-right">MSL</th>
                <th className="px-3 py-3 text-left">Health</th>
                <th className="px-3 py-3 text-right">Plan / mo</th>
                <th className="px-3 py-3 text-left">36-mo forecast</th>
                <th className="px-5 py-3 text-right">Audit</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-t border-border/70 hover:bg-surface/50">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-fg">{item.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-subtle">
                      {item.sku} · {item.category}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted">{ledgerLabel(item.ledger_id)}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">
                    {item.availableQuantity.toLocaleString("en-IN")}{" "}
                    <span className="text-[10px] font-normal text-subtle">{item.unit}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {item.minimumStockLevel.toLocaleString("en-IN")}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold",
                        healthClass(item.health),
                      )}
                    >
                      {item.health}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {item.plannedMonthlyUse ? item.plannedMonthlyUse.toLocaleString("en-IN") : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-3 text-xs font-semibold",
                      forecastClass(item.forecast.status),
                    )}
                  >
                    {forecastLabel(item)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to="/command/inventory-ledgers/$ledger"
                      params={{ ledger: item.ledger_id }}
                      search={{ sku: item.sku } as never}
                      className="text-xs font-semibold text-accent"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredItems.length === 0 ? (
            <div className="p-10 text-center">
              <TriangleAlert className="mx-auto size-5 text-subtle" />
              <p className="mt-2 text-sm text-muted">No inventory items match these filters.</p>
            </div>
          ) : null}
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface/30 p-4 text-xs leading-5 text-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green" />
          <span>
            <strong className="text-fg">Rules:</strong> health compares available stock with MSL;
            forecast consumes the saved monthly demand plan for 36 months; issues allocate the
            oldest receipt lot first.
          </span>
        </p>
        <Link to="/command/production" className="shrink-0 font-semibold text-accent">
          Production plan →
        </Link>
      </div>

      {data.role === "admin" ? (
        <div className="flex justify-end">
          <Link
            to="/command/inventory-legacy"
            className="inline-flex items-center gap-2 text-xs text-subtle hover:text-accent"
          >
            <Archive className="size-3.5" />
            Legacy inventory controls
          </Link>
        </div>
      ) : null}
    </main>
  );
}
