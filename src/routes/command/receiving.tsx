import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight, ClipboardCheck, PackageCheck, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { GovernedLifecycle } from "@/components/governed-lifecycle";
import { Kpi, Panel } from "@/components/kpi";
import {
  getReceivingData,
  postGoodsReceipt,
  resolveGoodsReceipt,
} from "@/lib/procure-to-pay-authority";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/command/receiving")({
  loader: () => getReceivingData(),
  component: Receiving,
});
const today = () => new Date().toISOString().slice(0, 10);
const number = (row: Record<string, unknown>, key: string) => Number(row[key] ?? 0);
const text = (row: Record<string, unknown>, key: string) => String(row[key] ?? "");

function Receiving() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [resolutionReference, setResolutionReference] = useState("");
  const availableOrders = data.purchaseOrders.filter(
    (row) =>
      ["issued", "part_received"].includes(text(row, "status")) && number(row, "quantity_open") > 0,
  );
  const [draft, setDraft] = useState({
    id: "",
    purchaseOrderId: "",
    receivedOn: today(),
    quantityReceived: 1,
    quantityAccepted: 1,
    quantityRejected: 0,
    inspectionStatus: "accepted" as "accepted" | "quarantine" | "rejected",
    sourceReference: "",
    notes: "",
  });
  const quarantine = data.receipts.filter(
    (row) => text(row, "inspection_status") === "quarantine",
  ).length;
  const rejected = data.receipts.reduce((sum, row) => sum + number(row, "quantity_rejected"), 0);
  const accepted = data.receipts.reduce((sum, row) => sum + number(row, "quantity_accepted"), 0);

  function chooseOrder(id: string) {
    const po = data.purchaseOrders.find((row) => text(row, "id") === id);
    setDraft({
      ...draft,
      purchaseOrderId: id,
      quantityReceived: po ? number(po, "quantity_open") : draft.quantityReceived,
      quantityAccepted: po ? number(po, "quantity_open") : draft.quantityAccepted,
      quantityRejected: 0,
      inspectionStatus: "accepted",
    });
  }
  function changeInspection(value: "accepted" | "quarantine" | "rejected") {
    setDraft({
      ...draft,
      inspectionStatus: value,
      quantityAccepted: value === "accepted" ? draft.quantityReceived : 0,
      quantityRejected: value === "rejected" ? draft.quantityReceived : 0,
    });
  }
  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      await postGoodsReceipt({ data: draft });
      setMessage(
        `${draft.id.toUpperCase()} posted. ${draft.inspectionStatus === "accepted" ? "Accepted quantity is now a FIFO inventory layer." : "No inventory was posted; the exception remains visible."}`,
      );
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Goods receipt could not be posted.");
    } finally {
      setBusy(false);
    }
  }
  async function resolve(id: string, resolution: "accepted" | "rejected") {
    if (!resolutionReference.trim()) {
      setMessage("Disposition evidence is required before resolving quarantine.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await resolveGoodsReceipt({
        data: { id, resolution, resolvedOn: today(), sourceReference: resolutionReference.trim() },
      });
      setMessage(`${id} quarantine resolved as ${resolution}.`);
      setResolutionReference("");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Quarantine could not be resolved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-green">
            Supply & Production · inventory boundary
          </p>
          <h1 className="mt-2 font-display text-4xl text-accent">Receiving & Inspection</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Record one GRN against an issued PO. Only accepted incoming material becomes physical
            stock; quarantine and rejection remain exceptions with evidence.
          </p>
        </div>
        <Link
          to="/command/inventory"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted hover:border-accent hover:text-accent"
        >
          Open Master Inventory <ArrowRight className="size-4" />
        </Link>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Awaiting receipt"
          value={String(availableOrders.length)}
          hint="Issued or partly received POs"
          tone={availableOrders.length ? "warn" : "ok"}
        />
        <Kpi
          label="Accepted to stock"
          value={String(accepted)}
          hint="FIFO quantity posted"
          tone="ok"
        />
        <Kpi
          label="Quarantine"
          value={String(quarantine)}
          hint="Inspection decision required"
          tone={quarantine ? "warn" : "ok"}
        />
        <Kpi
          label="Rejected quantity"
          value={String(rejected)}
          hint="Never included in ATP"
          tone={rejected ? "danger" : "ok"}
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
      <Panel title="Post goods receipt" kicker="PO → incoming inspection → FIFO stock">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Issued purchase order">
            <select
              className="control mt-1.5"
              value={draft.purchaseOrderId}
              onChange={(e) => chooseOrder(e.target.value)}
            >
              <option value="">Select PO</option>
              {availableOrders.map((row) => (
                <option key={text(row, "id")} value={text(row, "id")}>
                  {text(row, "id")} · {text(row, "supplier_name")} · {text(row, "sku")} · open{" "}
                  {number(row, "quantity_open")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="GRN number">
            <input
              className="control mt-1.5 uppercase"
              value={draft.id}
              onChange={(e) => setDraft({ ...draft, id: e.target.value })}
              placeholder="GRN-2026-001"
            />
          </Field>
          <Field label="Received date">
            <input
              className="control mt-1.5"
              type="date"
              value={draft.receivedOn}
              onChange={(e) => setDraft({ ...draft, receivedOn: e.target.value })}
            />
          </Field>
          <Field label="Inspection decision">
            <select
              className="control mt-1.5"
              value={draft.inspectionStatus}
              onChange={(e) => changeInspection(e.target.value as typeof draft.inspectionStatus)}
            >
              <option value="accepted">Accepted</option>
              <option value="quarantine">Quarantine</option>
              <option value="rejected">Rejected</option>
            </select>
          </Field>
          <Field label="Quantity received">
            <input
              className="control mt-1.5"
              type="number"
              min="0.01"
              step="0.01"
              value={draft.quantityReceived}
              onChange={(e) => {
                const value = Number(e.target.value);
                setDraft({
                  ...draft,
                  quantityReceived: value,
                  quantityAccepted: draft.inspectionStatus === "accepted" ? value : 0,
                  quantityRejected: draft.inspectionStatus === "rejected" ? value : 0,
                });
              }}
            />
          </Field>
          <Field label="Quantity accepted">
            <input
              className="control mt-1.5"
              type="number"
              min="0"
              step="0.01"
              disabled={draft.inspectionStatus !== "accepted"}
              value={draft.quantityAccepted}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  quantityAccepted: Number(e.target.value),
                  quantityRejected: Math.max(draft.quantityReceived - Number(e.target.value), 0),
                })
              }
            />
          </Field>
          <Field label="Quantity rejected">
            <input
              className="control mt-1.5"
              type="number"
              min="0"
              step="0.01"
              disabled={draft.inspectionStatus === "quarantine"}
              value={draft.quantityRejected}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  quantityRejected: Number(e.target.value),
                  quantityAccepted: Math.max(draft.quantityReceived - Number(e.target.value), 0),
                })
              }
            />
          </Field>
          <Field label="Delivery / inspection reference">
            <input
              className="control mt-1.5"
              value={draft.sourceReference}
              onChange={(e) => setDraft({ ...draft, sourceReference: e.target.value })}
              placeholder="Delivery note + inspection report"
            />
          </Field>
          <Field label="Notes">
            <input
              className="control mt-1.5"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Lot, batch, NCR or observation"
            />
          </Field>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={busy || !draft.purchaseOrderId || !draft.id || !draft.sourceReference}
            onClick={() => void submit()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40"
          >
            <PackageCheck className="size-4" />
            Post controlled GRN
          </button>
          <p className="text-xs leading-5 text-muted">
            Accepted quantity posts at the PO unit cost. Rejected or quarantined quantity cannot
            enter ATP.
          </p>
        </div>
      </Panel>
      {quarantine ? (
        <Panel title="Quarantine disposition" kicker="Inspection hold → authorised outcome">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <Field label="Disposition evidence">
              <input
                className="control mt-1.5 min-w-72"
                value={resolutionReference}
                onChange={(e) => setResolutionReference(e.target.value)}
                placeholder="Inspection report / NCR / concession"
              />
            </Field>
            <p className="flex-1 text-xs leading-5 text-muted">
              Resolving as accepted posts the held quantity to FIFO at the PO cost. Resolving as
              rejected keeps it outside ATP.
            </p>
          </div>
          <div className="mt-4 space-y-3">
            {data.receipts
              .filter((row) => text(row, "inspection_status") === "quarantine")
              .map((row) => (
                <article
                  key={text(row, "id")}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-bg-elevated/30 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <p className="font-mono text-xs text-subtle">
                      {text(row, "id")} · {text(row, "purchase_order_id")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-fg">
                      {number(row, "quantity_quarantined")} {text(row, "unit")} · {text(row, "sku")}
                    </p>
                  </div>
                  <div className="min-w-[300px]">
                    <GovernedLifecycle
                      label="Inspection lifecycle"
                      status="quarantine"
                      tone="warn"
                      hint="Disposition evidence is mandatory."
                      actions={[
                        {
                          label: "Accept to stock",
                          onClick: () => void resolve(text(row, "id"), "accepted"),
                          disabled: busy,
                          tone: "ok",
                        },
                        {
                          label: "Reject material",
                          onClick: () => void resolve(text(row, "id"), "rejected"),
                          disabled: busy,
                          tone: "danger",
                        },
                      ]}
                    />
                  </div>
                </article>
              ))}
          </div>
        </Panel>
      ) : null}
      <Panel title="Receipt & inspection register" kicker="Auditable stock origin">
        {data.receipts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">
            No goods receipts have been posted.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle">
                <tr>
                  <th className="px-3 py-3 text-left">GRN / PO</th>
                  <th className="px-3 py-3 text-left">Supplier / SKU</th>
                  <th className="px-3 py-3 text-right">Received</th>
                  <th className="px-3 py-3 text-right">Accepted</th>
                  <th className="px-3 py-3 text-right">Quarantine</th>
                  <th className="px-3 py-3 text-right">Rejected</th>
                  <th className="px-3 py-3 text-left">Inspection</th>
                  <th className="px-3 py-3 text-left">Inventory posting</th>
                  <th className="px-3 py-3 text-left">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {data.receipts.map((row) => {
                  const status = text(row, "inspection_status");
                  return (
                    <tr key={text(row, "id")} className="border-t border-border/70">
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs">{text(row, "id")}</span>
                        <span className="block text-xs text-muted">
                          {text(row, "purchase_order_id")}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {text(row, "supplier_name")}
                        <span className="block font-mono text-xs text-subtle">
                          {text(row, "sku")}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {number(row, "quantity_received")}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-ok">
                        {number(row, "quantity_accepted")}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-warn">
                        {number(row, "quantity_quarantined")}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-danger">
                        {number(row, "quantity_rejected")}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-3 text-xs font-semibold uppercase",
                          status === "accepted"
                            ? "text-ok"
                            : status === "quarantine"
                              ? "text-warn"
                              : "text-danger",
                        )}
                      >
                        {status}
                      </td>
                      <td className="px-3 py-3">
                        {row.inventory_movement_id ? (
                          <span className="inline-flex items-center gap-2 text-xs text-ok">
                            <ClipboardCheck className="size-4" />
                            {text(row, "inventory_movement_id")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-xs text-warn">
                            <ShieldAlert className="size-4" />
                            Not in stock
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted">
                        {text(row, "source_reference")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
