import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, FileCheck2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import {
  createPurchaseOrder,
  getPurchaseExecutionData,
  saveSupplier,
  transitionPurchaseOrder,
} from "@/lib/procure-to-pay-authority";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/command/purchase-execution")({
  loader: () => getPurchaseExecutionData(),
  component: PurchaseExecution,
});

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
const rowNumber = (row: Record<string, unknown>, key: string) => Number(row[key] ?? 0);
const rowText = (row: Record<string, unknown>, key: string) => String(row[key] ?? "");

function Status({ value }: { value: string }) {
  const good = ["approved", "issued", "received"].includes(value);
  const warn = ["pending", "pending_approval", "part_received"].includes(value);
  return (
    <span
      className={cn(
        "text-xs font-semibold uppercase tracking-wide",
        good && "text-ok",
        warn && "text-warn",
        !good && !warn && "text-muted",
      )}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

function PurchaseExecution() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const approvedSuppliers = data.suppliers.filter(
    (row) => rowText(row, "approval_status") === "approved" && row.active !== false,
  );
  const openOrders = data.purchaseOrders.filter(
    (row) => !["received", "cancelled"].includes(rowText(row, "status")),
  );
  const pendingApprovals = data.purchaseOrders.filter(
    (row) => rowText(row, "status") === "pending_approval",
  ).length;
  const openValue = openOrders.reduce((sum, row) => sum + rowNumber(row, "order_value_inr"), 0);
  const [supplier, setSupplier] = useState({
    id: "",
    name: "",
    paymentTermsDays: 30,
    leadTimeDays: 30,
    sourceReference: "",
  });
  const [purchase, setPurchase] = useState({
    id: "",
    supplierId: "",
    sourceActionId: "",
    requirementMonth: 1,
    sku: "",
    unit: "ea",
    quantity: 1,
    unitPriceInr: 0,
    orderDate: today(),
    expectedReceiptOn: today(),
    paymentTermsDays: 30,
    sourceReference: "",
    notes: "",
  });

  const recommendations = useMemo(
    () =>
      data.recommendations.filter(
        (row) => rowNumber(row, "quantity") > rowNumber(row, "committed_quantity"),
      ),
    [data.recommendations],
  );

  async function run(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      await task();
      setMessage(success);
      await router.invalidate();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The transaction could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function addSupplier() {
    if (!supplier.id || !supplier.name || !supplier.sourceReference) {
      setMessage("Supplier ID, name and evidence reference are required.");
      return;
    }
    await run(
      () =>
        saveSupplier({
          data: {
            ...supplier,
            currency: "INR",
            approvalStatus: "pending",
            qualityRating: null,
            deliveryRating: null,
          },
        }),
      `${supplier.id.toUpperCase()} saved for approval.`,
    );
  }

  async function approveSupplier(row: Record<string, unknown>) {
    await run(
      () =>
        saveSupplier({
          data: {
            id: rowText(row, "id"),
            name: rowText(row, "name"),
            currency: rowText(row, "currency") || "INR",
            paymentTermsDays: rowNumber(row, "payment_terms_days"),
            leadTimeDays: rowNumber(row, "lead_time_days"),
            approvalStatus: "approved",
            qualityRating: row.quality_rating == null ? null : rowNumber(row, "quality_rating"),
            deliveryRating: row.delivery_rating == null ? null : rowNumber(row, "delivery_rating"),
            sourceReference: rowText(row, "source_reference"),
          },
        }),
      `${rowText(row, "id")} approved for purchasing.`,
    );
  }

  function chooseRecommendation(id: string) {
    const row = data.recommendations.find((item) => rowText(item, "id") === id);
    if (!row) {
      setPurchase((current) => ({ ...current, sourceActionId: id }));
      return;
    }
    setPurchase((current) => ({
      ...current,
      sourceActionId: id,
      requirementMonth: rowNumber(row, "requirement_month"),
      sku: rowText(row, "sku"),
      unit: rowText(row, "unit"),
      quantity: Math.max(rowNumber(row, "quantity") - rowNumber(row, "committed_quantity"), 0),
    }));
  }

  async function submitPurchaseOrder() {
    if (!purchase.id || !purchase.supplierId || !purchase.sku || !purchase.sourceReference) {
      setMessage("PO number, approved supplier, SKU and evidence reference are required.");
      return;
    }
    await run(
      () => createPurchaseOrder({ data: purchase }),
      `${purchase.id.toUpperCase()} submitted for independent approval.`,
    );
  }

  async function transition(id: string, nextStatus: "approved" | "issued" | "cancelled") {
    const evidence = window.prompt(`Evidence / decision reference for ${nextStatus}`)?.trim();
    if (!evidence) return;
    await run(
      () => transitionPurchaseOrder({ data: { id, nextStatus, sourceReference: evidence } }),
      `${id} moved to ${nextStatus.replaceAll("_", " ")}.`,
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-green">
            Supply & Production · authorised transactions
          </p>
          <h1 className="mt-2 font-display text-4xl text-accent">Purchase Execution</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Convert an IBPE-backed requirement into a controlled supplier commitment. A
            recommendation never becomes a PO until it is submitted, independently approved and
            issued here.
          </p>
        </div>
        <Link
          to="/command/procurement-planning"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted hover:border-accent hover:text-accent"
        >
          Review material plan <ArrowRight className="size-4" />
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Recommendations ready"
          value={String(recommendations.length)}
          hint="Uncommitted action quantity"
        />
        <Kpi
          label="Pending approval"
          value={String(pendingApprovals)}
          hint="Independent release required"
          tone={pendingApprovals ? "warn" : "ok"}
        />
        <Kpi
          label="Open PO value"
          value={money(openValue)}
          hint={`${openOrders.length} open commitments`}
        />
        <Kpi
          label="Approved suppliers"
          value={String(approvedSuppliers.length)}
          hint={`${data.suppliers.length} supplier records`}
        />
      </div>
      {message ? (
        <div
          role="status"
          className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted"
        >
          {message}
        </div>
      ) : null}

      <Panel title="Raise purchase order" kicker="Recommendation → supplier → approval → issue">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Recommendation lineage">
            <select
              className="control mt-1.5"
              value={purchase.sourceActionId}
              onChange={(event) => chooseRecommendation(event.target.value)}
            >
              <option value="">Manual controlled need</option>
              {recommendations.map((row) => (
                <option key={rowText(row, "id")} value={rowText(row, "id")}>
                  M{rowNumber(row, "requirement_month")} · {rowText(row, "sku")} ·{" "}
                  {rowNumber(row, "quantity") - rowNumber(row, "committed_quantity")}{" "}
                  {rowText(row, "unit")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="PO number">
            <input
              className="control mt-1.5 uppercase"
              value={purchase.id}
              onChange={(e) => setPurchase({ ...purchase, id: e.target.value })}
              placeholder="PO-2026-001"
            />
          </Field>
          <Field label="Approved supplier">
            <select
              className="control mt-1.5"
              value={purchase.supplierId}
              onChange={(e) => {
                const selected = data.suppliers.find(
                  (row) => rowText(row, "id") === e.target.value,
                );
                setPurchase({
                  ...purchase,
                  supplierId: e.target.value,
                  paymentTermsDays: selected
                    ? rowNumber(selected, "payment_terms_days")
                    : purchase.paymentTermsDays,
                });
              }}
            >
              <option value="">Select supplier</option>
              {approvedSuppliers.map((row) => (
                <option key={rowText(row, "id")} value={rowText(row, "id")}>
                  {rowText(row, "name")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Requirement month">
            <input
              className="control mt-1.5"
              type="number"
              min="1"
              max="36"
              value={purchase.requirementMonth}
              onChange={(e) =>
                setPurchase({ ...purchase, requirementMonth: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Inventory SKU">
            <select
              className="control mt-1.5"
              value={purchase.sku}
              onChange={(e) => {
                const item = data.inventoryItems.find(
                  (row) => rowText(row, "sku") === e.target.value,
                );
                setPurchase({
                  ...purchase,
                  sku: e.target.value,
                  unit: item ? rowText(item, "unit") : purchase.unit,
                });
              }}
            >
              <option value="">Select controlled SKU</option>
              {data.inventoryItems.map((row) => (
                <option key={rowText(row, "sku")} value={rowText(row, "sku")}>
                  {rowText(row, "sku")} · {rowText(row, "name")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity">
            <input
              className="control mt-1.5"
              type="number"
              min="0.01"
              step="0.01"
              value={purchase.quantity}
              onChange={(e) => setPurchase({ ...purchase, quantity: Number(e.target.value) })}
            />
          </Field>
          <Field label="Unit price · INR">
            <input
              className="control mt-1.5"
              type="number"
              min="0"
              step="0.01"
              value={purchase.unitPriceInr}
              onChange={(e) => setPurchase({ ...purchase, unitPriceInr: Number(e.target.value) })}
            />
          </Field>
          <Field label="Payment terms · days">
            <input
              className="control mt-1.5"
              type="number"
              min="0"
              max="365"
              value={purchase.paymentTermsDays}
              onChange={(e) =>
                setPurchase({ ...purchase, paymentTermsDays: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Order date">
            <input
              className="control mt-1.5"
              type="date"
              value={purchase.orderDate}
              onChange={(e) => setPurchase({ ...purchase, orderDate: e.target.value })}
            />
          </Field>
          <Field label="Expected receipt">
            <input
              className="control mt-1.5"
              type="date"
              value={purchase.expectedReceiptOn}
              onChange={(e) => setPurchase({ ...purchase, expectedReceiptOn: e.target.value })}
            />
          </Field>
          <Field label="RFQ / quotation reference">
            <input
              className="control mt-1.5"
              value={purchase.sourceReference}
              onChange={(e) => setPurchase({ ...purchase, sourceReference: e.target.value })}
              placeholder="RFQ / quote / approval pack"
            />
          </Field>
          <Field label="Notes">
            <input
              className="control mt-1.5"
              value={purchase.notes}
              onChange={(e) => setPurchase({ ...purchase, notes: e.target.value })}
              placeholder="Commercial terms or exception"
            />
          </Field>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submitPurchaseOrder()}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"
        >
          <FileCheck2 className="size-4" />
          Submit for approval
        </button>
      </Panel>

      <Panel title="Purchase order register" kicker="Authorised commitments only">
        {data.purchaseOrders.length === 0 ? (
          <Empty text="No purchase orders have been raised." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle">
                <tr>
                  <th className="px-3 py-3 text-left">PO / supplier</th>
                  <th className="px-3 py-3 text-left">SKU</th>
                  <th className="px-3 py-3 text-right">Ordered</th>
                  <th className="px-3 py-3 text-right">Accepted</th>
                  <th className="px-3 py-3 text-right">Open</th>
                  <th className="px-3 py-3 text-right">Value</th>
                  <th className="px-3 py-3 text-left">Expected</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-left">Controlled action</th>
                </tr>
              </thead>
              <tbody>
                {data.purchaseOrders.map((row) => {
                  const status = rowText(row, "status");
                  return (
                    <tr key={rowText(row, "id")} className="border-t border-border/70">
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs text-fg">{rowText(row, "id")}</span>
                        <span className="block text-xs text-muted">
                          {rowText(row, "supplier_name")}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {rowText(row, "sku")}
                        <span className="block text-xs text-subtle">
                          M{rowNumber(row, "requirement_month")}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {rowNumber(row, "quantity")}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {rowNumber(row, "quantity_accepted")}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {rowNumber(row, "quantity_open")}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {money(row.order_value_inr)}
                      </td>
                      <td className="px-3 py-3">{rowText(row, "expected_receipt_on")}</td>
                      <td className="px-3 py-3">
                        <Status value={status} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-3">
                          {status === "pending_approval" ? (
                            <button
                              disabled={busy}
                              onClick={() => void transition(rowText(row, "id"), "approved")}
                              className="text-xs font-semibold text-accent"
                            >
                              Approve
                            </button>
                          ) : null}
                          {status === "approved" ? (
                            <button
                              disabled={busy}
                              onClick={() => void transition(rowText(row, "id"), "issued")}
                              className="text-xs font-semibold text-accent"
                            >
                              Issue
                            </button>
                          ) : null}
                          {!["received", "cancelled"].includes(status) ? (
                            <button
                              disabled={busy}
                              onClick={() => void transition(rowText(row, "id"), "cancelled")}
                              className="text-xs text-muted hover:text-danger"
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Supplier register" kicker="Qualified source control">
        <div className="grid gap-4 rounded-xl border border-border bg-bg-elevated/30 p-4 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Supplier ID">
            <input
              className="control mt-1.5 uppercase"
              value={supplier.id}
              onChange={(e) => setSupplier({ ...supplier, id: e.target.value })}
              placeholder="SUP-001"
            />
          </Field>
          <Field label="Supplier name">
            <input
              className="control mt-1.5"
              value={supplier.name}
              onChange={(e) => setSupplier({ ...supplier, name: e.target.value })}
            />
          </Field>
          <Field label="Lead time · days">
            <input
              className="control mt-1.5"
              type="number"
              value={supplier.leadTimeDays}
              onChange={(e) => setSupplier({ ...supplier, leadTimeDays: Number(e.target.value) })}
            />
          </Field>
          <Field label="Payment terms · days">
            <input
              className="control mt-1.5"
              type="number"
              value={supplier.paymentTermsDays}
              onChange={(e) =>
                setSupplier({ ...supplier, paymentTermsDays: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Evidence reference">
            <input
              className="control mt-1.5"
              value={supplier.sourceReference}
              onChange={(e) => setSupplier({ ...supplier, sourceReference: e.target.value })}
              placeholder="Vendor qualification file"
            />
          </Field>
          <button
            type="button"
            disabled={busy}
            onClick={() => void addSupplier()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg hover:border-accent disabled:opacity-50"
          >
            <Plus className="size-4" />
            Add for review
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.suppliers.map((row) => (
            <article
              key={rowText(row, "id")}
              className="rounded-xl border border-border bg-surface/30 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-subtle">{rowText(row, "id")}</p>
                  <h3 className="mt-1 font-semibold text-fg">{rowText(row, "name")}</h3>
                </div>
                <Status value={rowText(row, "approval_status")} />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted">
                {rowNumber(row, "lead_time_days")} day lead · {rowNumber(row, "payment_terms_days")}{" "}
                day payment · {rowText(row, "source_reference")}
              </p>
              {rowText(row, "approval_status") === "pending" ? (
                <button
                  disabled={busy}
                  onClick={() => void approveSupplier(row)}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-accent"
                >
                  <CheckCircle2 className="size-4" />
                  Approve supplier
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </Panel>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium text-muted">
      {label}
      {children}
    </label>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">
      {text}
    </div>
  );
}
