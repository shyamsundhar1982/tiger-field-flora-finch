import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { Download, FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";
import { Kpi } from "@/components/kpi";
import { inr } from "@/lib/format";
import {
  isMasterInventoryLedger,
  MASTER_INVENTORY_LEDGER_PAGES,
  type MasterInventoryLedgerId,
} from "@/lib/inventory-navigation";
import { forecastStock, stockHealth } from "@/lib/master-ledger";
import { getMasterInventoryData, issueMasterInventoryFifo } from "@/lib/master-inventory";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/command/inventory-ledgers/$ledger")({
  validateSearch: (search: Record<string, unknown>) => ({
    sku: typeof search.sku === "string" ? search.sku : undefined,
  }),
  loader: async ({ params }) => {
    if (!isMasterInventoryLedger(params.ledger)) throw redirect({ to: "/command/inventory" });
    return getMasterInventoryData();
  },
  component: InventoryLedger,
});

function number(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function csvCell(value: string | number | null) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function InventoryLedger() {
  const ledgerId = Route.useParams().ledger as MasterInventoryLedgerId;
  const search = Route.useSearch();
  const data = Route.useLoaderData();
  const router = useRouter();
  const ledger = MASTER_INVENTORY_LEDGER_PAGES.find((item) => item.id === ledgerId)!;
  const items = useMemo(
    () => data.items.filter((item) => item.ledger_id === ledgerId),
    [data.items, ledgerId],
  );
  const lots = useMemo(
    () => data.lots.filter((lot) => lot.ledger_id === ledgerId),
    [data.lots, ledgerId],
  );
  const issueableItems = items.filter((item) => number(item.available_quantity) > 0);
  const initialItem = issueableItems.find((item) => item.sku === search.sku) ?? issueableItems[0];
  const [itemId, setItemId] = useState(initialItem?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [issuedOn, setIssuedOn] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selectedItem = items.find((item) => item.id === itemId);

  const available = items.reduce((sum, item) => sum + number(item.available_quantity), 0);
  const mslAlerts = items.filter((item) =>
    ["Below MSL", "Out of stock"].includes(
      stockHealth(number(item.available_quantity), number(item.minimum_stock_level)),
    ),
  ).length;
  const replenish = items.filter(
    (item) =>
      forecastStock(
        number(item.available_quantity),
        number(item.minimum_stock_level),
        number(item.planned_monthly_use),
      ).status === "Replenish",
  ).length;
  const value = items.reduce((sum, item) => sum + number(item.stock_value_inr), 0);

  async function recordIssue() {
    setMessage("");
    if (!itemId || !reference.trim()) {
      setMessage("Select an item and enter an issue reference.");
      return;
    }
    setBusy(true);
    try {
      await issueMasterInventoryFifo({
        data: { itemId, quantity: Number(quantity), issuedOn, reference, notes },
      });
      setQuantity("1");
      setReference("");
      setNotes("");
      setMessage("Issue saved. FIFO allocation is recorded in the spreadsheet below.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The FIFO issue could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    const headings = [
      "FIFO lot",
      "SKU",
      "Item",
      "Category",
      "Received",
      "Reference",
      "Received qty",
      "Issued qty",
      "Available qty",
      "Unit",
      "Unit cost INR",
      "Expiry",
      "Next inspection",
      "Last issue",
    ];
    const body = lots.map((lot, index) => [
      index + 1,
      lot.sku,
      lot.name,
      lot.category,
      lot.received_on,
      lot.reference,
      number(lot.quantity_received),
      number(lot.allocated_quantity),
      number(lot.quantity_remaining),
      lot.unit,
      number(lot.unit_cost_inr),
      lot.expiry_on,
      lot.next_inspection_on,
      lot.last_issue_on,
    ]);
    const csv = [headings, ...body].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${ledgerId}-ledger.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const fifoSequence = new Map<string, number>();

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-green">
            Master Inventory · audit ledger
          </p>
          <h1 className="mt-2 font-display text-4xl text-accent">{ledger.label}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            {ledger.detail}. Receipt lots are shown oldest first so quantity, MSL and FIFO
            allocation can be audited in one spreadsheet.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!lots.length}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold text-muted hover:border-accent hover:text-accent disabled:opacity-40"
          >
            <Download className="size-4" />
            CSV
          </button>
          <Link
            to="/command/inventory"
            className="rounded-lg border border-border px-3 py-2.5 text-sm font-semibold"
          >
            ← Master Inventory
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Available quantity"
          value={available.toLocaleString("en-IN")}
          hint={`${items.length} active SKU${items.length === 1 ? "" : "s"}`}
        />
        <Kpi label="Stock value" value={inr(value)} hint="Remaining FIFO lots at receipt cost" />
        <Kpi
          label="MSL alerts"
          value={String(mslAlerts)}
          hint="Below minimum or out of stock"
          tone={mslAlerts ? "warn" : "ok"}
        />
        <Kpi
          label="Forecast due"
          value={String(replenish)}
          hint="36-month saved demand plan"
          tone={replenish ? "warn" : "ok"}
        />
      </section>

      <section className="rounded-xl border border-border bg-bg-elevated p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle">
              Stock movement
            </p>
            <h2 className="mt-1 font-display text-xl">Record issue</h2>
          </div>
          <p className="max-w-md text-xs leading-5 text-muted">
            The database locks the selected SKU, checks availability, and allocates the oldest dated
            receipt lots first.
          </p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[2fr_0.7fr_1fr_1.2fr]">
          <label className="text-xs font-medium text-muted">
            Item
            <select
              className="control mt-1.5"
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
            >
              <option value="">Select item</option>
              {issueableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} · {item.name} · {number(item.available_quantity)} available
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted">
            Quantity
            <input
              className="control mt-1.5"
              type="number"
              min="0.01"
              step="0.01"
              max={selectedItem ? number(selectedItem.available_quantity) : undefined}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-muted">
            Issue date
            <input
              className="control mt-1.5"
              type="date"
              value={issuedOn}
              onChange={(event) => setIssuedOn(event.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-muted">
            Reference
            <input
              className="control mt-1.5"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Job card / department"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-xs font-medium text-muted">
            Notes
            <input
              className="control mt-1.5"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional issue note"
            />
          </label>
          <button
            type="button"
            disabled={busy || !issueableItems.length}
            onClick={() => void recordIssue()}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg disabled:opacity-40"
          >
            {busy ? "Allocating…" : "Record FIFO issue"}
          </button>
        </div>
        {message ? (
          <p
            role="status"
            className={cn(
              "mt-3 text-xs",
              message.startsWith("Issue saved") ? "text-green" : "text-warn",
            )}
          >
            {message}
          </p>
        ) : null}
      </section>

      <section
        className="rounded-xl border border-border bg-bg-elevated"
        aria-labelledby="spreadsheet-heading"
      >
        <div className="flex items-center gap-3 border-b border-border p-5">
          <FileSpreadsheet className="size-5 text-accent" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle">
              Receipt and issue audit
            </p>
            <h2 id="spreadsheet-heading" className="mt-1 font-display text-2xl">
              Ledger spreadsheet
            </h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] text-sm">
            <thead className="text-[10px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="px-4 py-3 text-left">FIFO</th>
                <th className="px-3 py-3 text-left">Item</th>
                <th className="px-3 py-3 text-left">Category</th>
                <th className="px-3 py-3 text-left">Received</th>
                <th className="px-3 py-3 text-left">Reference</th>
                <th className="px-3 py-3 text-right">Received</th>
                <th className="px-3 py-3 text-right">Issued</th>
                <th className="px-3 py-3 text-right">Available</th>
                <th className="px-3 py-3 text-right">Unit cost</th>
                <th className="px-3 py-3 text-right">MSL</th>
                <th className="px-3 py-3 text-right">Plan / mo</th>
                <th className="px-3 py-3 text-left">Expiry / inspection</th>
                <th className="px-4 py-3 text-left">Last issue</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => {
                const sequence = (fifoSequence.get(lot.item_id) ?? 0) + 1;
                fifoSequence.set(lot.item_id, sequence);
                return (
                  <tr key={lot.id} className="border-t border-border/70 hover:bg-surface/50">
                    <td className="px-4 py-3 font-mono text-xs text-subtle">#{sequence}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-fg">{lot.name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-subtle">{lot.sku}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">{lot.category}</td>
                    <td className="px-3 py-3 text-xs">{lot.received_on}</td>
                    <td
                      className="max-w-48 truncate px-3 py-3 text-xs text-muted"
                      title={lot.reference}
                    >
                      {lot.reference || "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {number(lot.quantity_received).toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">
                      {number(lot.allocated_quantity).toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {number(lot.quantity_remaining).toLocaleString("en-IN")}{" "}
                      <span className="text-[10px] font-normal text-subtle">{lot.unit}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {inr(number(lot.unit_cost_inr))}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {number(lot.minimum_stock_level).toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {number(lot.planned_monthly_use) || "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">
                      {lot.expiry_on || "—"} / {lot.next_inspection_on || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{lot.last_issue_on || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {lots.length === 0 ? (
            <div className="p-10 text-center">
              <FileSpreadsheet className="mx-auto size-6 text-subtle" />
              <p className="mt-2 text-sm text-muted">
                No receipt lots yet. Add the first item or receipt from Master Inventory.
              </p>
              <Link
                to="/command/inventory"
                className="mt-3 inline-flex text-xs font-semibold text-accent"
              >
                Open single point entry →
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
