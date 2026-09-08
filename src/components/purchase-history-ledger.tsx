import { Link } from "@tanstack/react-router";
import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Panel } from "@/components/kpi";
import { cn } from "@/lib/utils";

type LedgerRow = Record<string, unknown>;

const money = (value: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
const number = (row: LedgerRow, key: string) => Number(row[key] ?? 0);
const text = (row: LedgerRow, key: string) => String(row[key] ?? "");

function csvCell(value: unknown) {
  const normalized = String(value ?? "");
  return `"${normalized.replaceAll('"', '""')}"`;
}

function exportLedger(rows: LedgerRow[]) {
  const columns: Array<[string, string]> = [
    ["PO", "id"],
    ["Supplier ID", "supplier_id"],
    ["Supplier", "supplier_name"],
    ["Order date", "order_date"],
    ["Requirement month", "requirement_month"],
    ["SKU", "sku"],
    ["Unit", "unit"],
    ["Ordered qty", "quantity"],
    ["Unit price INR", "unit_price_inr"],
    ["PO value INR", "order_value_inr"],
    ["PO status", "status"],
    ["Received qty", "quantity_received"],
    ["Accepted qty", "quantity_accepted"],
    ["Quarantined qty", "quantity_quarantined"],
    ["Rejected qty", "quantity_rejected"],
    ["GRNs", "grn_ids"],
    ["Inventory movements", "inventory_movement_ids"],
    ["Invoices", "invoice_numbers"],
    ["Invoice ex GST INR", "invoice_ex_gst_inr"],
    ["GST INR", "gst_inr"],
    ["Invoice total INR", "invoice_total_inr"],
    ["Paid INR", "amount_paid_inr"],
    ["Outstanding INR", "amount_open_inr"],
    ["Latest due", "latest_due_on"],
    ["Last paid", "last_paid_on"],
    ["Source reference", "source_reference"],
    ["Source action", "source_action_id"],
  ];
  const csv = [
    columns.map(([label]) => csvCell(label)).join(","),
    ...rows.map((row) => columns.map(([, key]) => csvCell(row[key])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vyndi-purchase-history-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Status({ value }: { value: string }) {
  const good = ["approved", "issued", "received", "paid"].includes(value);
  const warn = ["pending_approval", "part_received", "matched", "part_paid"].includes(value);
  return (
    <span
      className={cn(
        "text-[10px] font-semibold uppercase tracking-wide",
        good && "text-ok",
        warn && "text-warn",
        !good && !warn && "text-muted",
      )}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

export function PurchaseHistoryLedger({ rows }: { rows: LedgerRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== "all" && text(row, "status") !== status) return false;
      if (!needle) return true;
      return [
        "id",
        "supplier_id",
        "supplier_name",
        "sku",
        "grn_ids",
        "inventory_movement_ids",
        "invoice_numbers",
        "source_reference",
        "source_action_id",
      ].some((key) => text(row, key).toLowerCase().includes(needle));
    });
  }, [query, rows, status]);

  const totals = useMemo(
    () => ({
      po: filtered.reduce((sum, row) => sum + number(row, "order_value_inr"), 0),
      gst: filtered.reduce((sum, row) => sum + number(row, "gst_inr"), 0),
      paid: filtered.reduce((sum, row) => sum + number(row, "amount_paid_inr"), 0),
      open: filtered.reduce((sum, row) => sum + number(row, "amount_open_inr"), 0),
    }),
    [filtered],
  );

  const statuses = useMemo(
    () => [...new Set(rows.map((row) => text(row, "status")).filter(Boolean))].sort(),
    [rows],
  );

  return (
    <Panel title="Purchase History Ledger" kicker="PO → GRN → Inventory → Invoice / GST → Payment">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <LedgerMetric label="PO value" value={money(totals.po)} />
        <LedgerMetric label="GST recorded" value={money(totals.gst)} />
        <LedgerMetric label="Paid" value={money(totals.paid)} />
        <LedgerMetric label="Outstanding" value={money(totals.open)} tone={totals.open > 0 ? "warn" : "ok"} />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <input
              className="control w-full pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search PO, supplier, SKU, GRN, invoice or evidence"
            />
          </label>
          <select className="control sm:w-48" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All PO statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={filtered.length === 0}
          onClick={() => exportLedger(filtered)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg hover:border-accent hover:text-accent disabled:opacity-40"
        >
          <Download className="size-4" />
          Export CSV
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">
          Purchase history will populate automatically when the first governed PO is raised.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">
          No purchase-history rows match the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[1800px] text-sm">
            <thead className="bg-bg-elevated/50 text-[10px] uppercase tracking-wider text-subtle">
              <tr>
                <th className="px-3 py-3 text-left">PO / supplier</th>
                <th className="px-3 py-3 text-left">Order / need</th>
                <th className="px-3 py-3 text-left">SKU</th>
                <th className="px-3 py-3 text-right">Ordered</th>
                <th className="px-3 py-3 text-right">Received / accepted</th>
                <th className="px-3 py-3 text-left">GRN / inventory</th>
                <th className="px-3 py-3 text-right">PO value</th>
                <th className="px-3 py-3 text-left">Invoice</th>
                <th className="px-3 py-3 text-right">Ex GST / GST</th>
                <th className="px-3 py-3 text-right">Paid</th>
                <th className="px-3 py-3 text-right">Outstanding</th>
                <th className="px-3 py-3 text-left">Status / evidence</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={text(row, "id")} className="border-t border-border/70 align-top">
                  <td className="px-3 py-3">
                    <span className="font-mono text-xs text-fg">{text(row, "id")}</span>
                    <span className="block text-xs text-muted">{text(row, "supplier_name")}</span>
                    <span className="block font-mono text-[10px] text-subtle">{text(row, "supplier_id")}</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted">
                    <span className="block text-fg">{text(row, "order_date")}</span>
                    <span className="block">M{number(row, "requirement_month")} requirement</span>
                    <span className="block">Expected {text(row, "expected_receipt_on")}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-medium text-fg">{text(row, "sku")}</span>
                    <span className="block text-xs text-muted">{text(row, "unit")}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <span className="block">{number(row, "quantity")}</span>
                    <span className="block text-xs text-muted">@ {money(row.unit_price_inr)}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <span className="block">{number(row, "quantity_received")} / {number(row, "quantity_accepted")}</span>
                    {number(row, "quantity_quarantined") > 0 ? (
                      <span className="block text-xs text-warn">Q {number(row, "quantity_quarantined")}</span>
                    ) : null}
                    {number(row, "quantity_rejected") > 0 ? (
                      <span className="block text-xs text-danger">R {number(row, "quantity_rejected")}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <span className="block text-fg">{text(row, "grn_ids") || "No GRN"}</span>
                    <span className="block max-w-64 truncate font-mono text-[10px] text-muted" title={text(row, "inventory_movement_ids")}>
                      {text(row, "inventory_movement_ids") || "No stock posting"}
                    </span>
                    <span className="mt-1 block space-x-3">
                      <Link to="/command/receiving" className="font-semibold text-accent">Receiving</Link>
                      <Link to="/command/inventory" className="font-semibold text-accent">Inventory</Link>
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium">{money(row.order_value_inr)}</td>
                  <td className="px-3 py-3 text-xs">
                    <span className="block text-fg">{text(row, "invoice_numbers") || "Not invoiced"}</span>
                    <span className="block text-muted">{text(row, "invoice_statuses") || "—"}</span>
                    <span className="block text-subtle">Due {text(row, "latest_due_on") || "—"}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-xs">
                    <span className="block text-fg">{money(row.invoice_ex_gst_inr)}</span>
                    <span className="block text-muted">GST {money(row.gst_inr)}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <span className="block">{money(row.amount_paid_inr)}</span>
                    <span className="block text-xs text-muted">{text(row, "last_paid_on") || "—"}</span>
                  </td>
                  <td className={cn("px-3 py-3 text-right tabular-nums font-semibold", number(row, "amount_open_inr") > 0 ? "text-warn" : "text-ok")}>
                    {money(row.amount_open_inr)}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <Status value={text(row, "status")} />
                    <span className="mt-1 block max-w-72 text-muted">{text(row, "source_reference")}</span>
                    {text(row, "source_action_id") ? (
                      <span className="block font-mono text-[10px] text-subtle">{text(row, "source_action_id")}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs leading-5 text-subtle">
        This ledger is derived only from governed supplier, PO, GRN, inventory-movement, supplier-invoice and payment records. Editing remains in the owning transaction screens.
      </p>
    </Panel>
  );
}

function LedgerMetric({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated/30 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle">{label}</p>
      <p className={cn("mt-2 text-xl font-semibold tabular-nums text-fg", tone === "ok" && "text-ok", tone === "warn" && "text-warn")}>
        {value}
      </p>
    </div>
  );
}
