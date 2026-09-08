import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight, Banknote, FileText } from "lucide-react";
import { useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { issueInvoice, listShipmentRevenueLedger, postCollection } from "@/lib/shipment-authority";

export const Route = createFileRoute("/command/receivables")({
  loader: () => listShipmentRevenueLedger(),
  component: Receivables,
});
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value * 100_000);

function Receivables() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const activeInvoices = data.invoices.filter((invoice) => invoice.status === "issued");
  const postedCollections = data.collections.filter((collection) => collection.status === "posted");
  const collectedByInvoice = new Map<string, number>();
  for (const collection of postedCollections)
    collectedByInvoice.set(
      collection.invoiceId,
      (collectedByInvoice.get(collection.invoiceId) ?? 0) + collection.amountLakh,
    );
  const outstanding = activeInvoices.reduce(
    (sum, invoice) =>
      sum + Math.max(invoice.amountLakh - (collectedByInvoice.get(invoice.id) ?? 0), 0),
    0,
  );
  const uninvoiced = data.shipments.filter(
    (shipment) =>
      shipment.status === "posted" &&
      !activeInvoices.some((invoice) => invoice.shipmentId === shipment.id),
  );
  const [invoice, setInvoice] = useState({ id: "", shipmentId: "", sourceReference: "" });
  const [collection, setCollection] = useState({
    id: "",
    invoiceId: "",
    planMonth: 1,
    amountLakh: 0,
    sourceReference: "",
  });
  async function run(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      await task();
      setMessage(success);
      await router.invalidate();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Receivable transaction could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-green">
            Finance · order to cash
          </p>
          <h1 className="mt-2 font-display text-4xl text-accent">Accounts Receivable</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Revenue and receivables arise from posted shipments and issued invoices. Collections
            reduce the open balance with bank evidence; finance does not type over
            transaction-derived actuals.
          </p>
        </div>
        <Link
          to="/command/sales"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted hover:border-accent hover:text-accent"
        >
          Commercial orders <ArrowRight className="size-4" />
        </Link>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Open receivables"
          value={money(outstanding)}
          hint={`${activeInvoices.length} active invoices`}
          tone={outstanding ? "warn" : "ok"}
        />
        <Kpi
          label="Uninvoiced shipments"
          value={String(uninvoiced.length)}
          hint="Dispatch posted, invoice pending"
          tone={uninvoiced.length ? "warn" : "ok"}
        />
        <Kpi
          label="Collections posted"
          value={money(postedCollections.reduce((sum, row) => sum + row.amountLakh, 0))}
          hint={`${postedCollections.length} bank receipts`}
        />
        <Kpi
          label="Invoice register"
          value={String(data.invoices.length)}
          hint="Issued and voided records"
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
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Issue invoice" kicker="Posted shipment → transaction revenue">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Posted shipment">
              <select
                className="control mt-1.5"
                value={invoice.shipmentId}
                onChange={(e) => setInvoice({ ...invoice, shipmentId: e.target.value })}
              >
                <option value="">Select shipment</option>
                {uninvoiced.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.id} · {row.salesOrderId} · {row.units} units
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Invoice ID">
              <input
                className="control mt-1.5 uppercase"
                value={invoice.id}
                onChange={(e) => setInvoice({ ...invoice, id: e.target.value })}
                placeholder="INV-2026-001"
              />
            </Field>
            <Field label="Invoice evidence">
              <input
                className="control mt-1.5"
                value={invoice.sourceReference}
                onChange={(e) => setInvoice({ ...invoice, sourceReference: e.target.value })}
                placeholder="Tax invoice / dispatch file"
              />
            </Field>
          </div>
          <button
            type="button"
            disabled={busy || !invoice.id || !invoice.shipmentId || !invoice.sourceReference}
            onClick={() =>
              void run(
                () => issueInvoice({ data: invoice }),
                `${invoice.id.toUpperCase()} issued from controlled shipment value.`,
              )
            }
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40"
          >
            <FileText className="size-4" />
            Issue invoice
          </button>
        </Panel>
        <Panel title="Post collection" kicker="Invoice → bank receipt">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Open invoice">
              <select
                className="control mt-1.5"
                value={collection.invoiceId}
                onChange={(e) => {
                  const id = e.target.value;
                  const row = activeInvoices.find((item) => item.id === id);
                  setCollection({
                    ...collection,
                    invoiceId: id,
                    planMonth: row?.planMonth ?? collection.planMonth,
                    amountLakh: row
                      ? Math.max(row.amountLakh - (collectedByInvoice.get(id) ?? 0), 0)
                      : 0,
                  });
                }}
              >
                <option value="">Select invoice</option>
                {activeInvoices
                  .filter((row) => row.amountLakh - (collectedByInvoice.get(row.id) ?? 0) > 0)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.id} · open{" "}
                      {money(row.amountLakh - (collectedByInvoice.get(row.id) ?? 0))}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Collection ID">
              <input
                className="control mt-1.5 uppercase"
                value={collection.id}
                onChange={(e) => setCollection({ ...collection, id: e.target.value })}
                placeholder="COL-2026-001"
              />
            </Field>
            <Field label="Plan month">
              <input
                className="control mt-1.5"
                type="number"
                min="1"
                max="36"
                value={collection.planMonth}
                onChange={(e) =>
                  setCollection({ ...collection, planMonth: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Amount · ₹ lakh">
              <input
                className="control mt-1.5"
                type="number"
                min="0.01"
                step="0.01"
                value={collection.amountLakh}
                onChange={(e) =>
                  setCollection({ ...collection, amountLakh: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Bank reference">
              <input
                className="control mt-1.5"
                value={collection.sourceReference}
                onChange={(e) => setCollection({ ...collection, sourceReference: e.target.value })}
                placeholder="UTR / statement evidence"
              />
            </Field>
          </div>
          <button
            type="button"
            disabled={
              busy ||
              !collection.id ||
              !collection.invoiceId ||
              !collection.sourceReference ||
              collection.amountLakh <= 0
            }
            onClick={() =>
              void run(
                () => postCollection({ data: collection }),
                `${collection.id.toUpperCase()} posted against ${collection.invoiceId}.`,
              )
            }
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40"
          >
            <Banknote className="size-4" />
            Post collection
          </button>
        </Panel>
      </div>
      <Panel title="Receivable register" kicker="Shipment → invoice → collection">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-sm">
            <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle">
              <tr>
                <th className="px-3 py-3 text-left">Invoice</th>
                <th className="px-3 py-3 text-left">Order / shipment</th>
                <th className="px-3 py-3 text-right">Value</th>
                <th className="px-3 py-3 text-right">Collected</th>
                <th className="px-3 py-3 text-right">Open</th>
                <th className="px-3 py-3 text-left">Month</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((row) => {
                const collected = collectedByInvoice.get(row.id) ?? 0;
                return (
                  <tr key={row.id} className="border-t border-border/70">
                    <td className="px-3 py-3 font-mono text-xs">{row.id}</td>
                    <td className="px-3 py-3">
                      {row.salesOrderId}
                      <span className="block text-xs text-muted">{row.shipmentId}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(row.amountLakh)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ok">
                      {money(collected)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {money(Math.max(row.amountLakh - collected, 0))}
                    </td>
                    <td className="px-3 py-3">M{row.planMonth}</td>
                    <td
                      className={
                        row.status === "issued"
                          ? "px-3 py-3 text-xs font-semibold uppercase text-ok"
                          : "px-3 py-3 text-xs font-semibold uppercase text-muted"
                      }
                    >
                      {row.status}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">{row.sourceReference}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.invoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No invoices have been issued.</p>
          ) : null}
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
