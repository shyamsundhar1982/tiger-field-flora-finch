import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Panel, Kpi } from "@/components/kpi";
import { InventoryWorkspaceNav } from "@/components/inventory-workspace-nav";
import { INVENTORY_LEDGER_PAGES, type InventoryLedgerId } from "@/lib/inventory-navigation";
import { availableQuantity, forecastLedger, type MasterLedgerRow } from "@/lib/master-ledger";
import { getAuthoritativeInventory, getInventoryControlSummary } from "@/lib/inventory-authority";
import { inr } from "@/lib/format";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/inventory-ledgers/$ledger")({
  loader: async ({ params }) => {
    if (!INVENTORY_LEDGER_PAGES.some((page) => page.id === params.ledger)) {
      throw redirect({ to: "/command/inventory-ledgers" });
    }
    const [summary, balances] = await Promise.all([getInventoryControlSummary(), getAuthoritativeInventory()]);
    return { summary, balances };
  },
  component: LedgerPage,
});

const blank = { serialNo: "", description: "", purchasePrice: 0, purchaseDate: "", expiryDate: "", nextInspectionDate: "", quantity: 1, mslLevel: 0 };

function LedgerPage() {
  const { summary, balances } = Route.useLoaderData();
  const ledger = Route.useParams().ledger as InventoryLedgerId;
  const page = INVENTORY_LEDGER_PAGES.find((item) => item.id === ledger) ?? INVENTORY_LEDGER_PAGES[0];
  const localRows = useVeloxis((state) => state.masterLedgerRows);
  const addRow = useVeloxis((state) => state.addMasterLedgerRow);
  const issue = useVeloxis((state) => state.issueMasterLedger);
  const [draft, setDraft] = useState(blank);
  const [issueQty, setIssueQty] = useState(1);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const seededRows = useMemo<MasterLedgerRow[]>(() => (balances as any[]).map((item) => ({ id: `server-${item.venture}-${item.sku}-${item.unit}`, ledgerId: "stock", serialNo: item.sku, description: `${item.venture} · ${item.sku}`, purchasePrice: Number(item.weighted_average_cost_inr ?? 0), purchaseDate: "", expiryDate: "", nextInspectionDate: "", quantity: Number(item.quantity_balance ?? 0), mslLevel: 0, issues: [] })), [balances]);
  const rows = ledger === "stock" && localRows.filter((row) => row.ledgerId === ledger).length === 0 ? seededRows : localRows.filter((row) => row.ledgerId === ledger);
  const forecast = forecastLedger(rows, ledger);
  const canIssue = localRows.some((row) => row.ledgerId === ledger && availableQuantity(row) > 0);

  function addItem() {
    if (!draft.description.trim() || draft.quantity < 1) return;
    addRow({ ...draft, ledgerId: ledger, description: draft.description.trim() });
    setDraft(blank);
  }

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
    <header className="flex flex-col gap-4"><div><p className="text-[10px] uppercase tracking-[0.22em] text-green">Planning projection · {page.group}</p><h1 className="mt-2 text-3xl font-bold text-accent sm:text-4xl">{page.label}</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">{page.detail}. This compatibility view stores local planning rows; posted ERP stock remains authoritative only in Inventory Truth.</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><Link to="/command/inventory-truth" className="rounded-md border border-accent/40 px-3 py-1.5 font-semibold text-accent">Open authoritative truth →</Link><span className="rounded-md border border-border px-3 py-1.5 text-subtle">Local planning · not posted</span></div></div><InventoryWorkspaceNav active={ledger} /></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Kpi label="Available quantity" value={String(forecast.quantity)} /><Kpi label="MSL level" value={String(forecast.mslLevel)} /><Kpi label="Monthly plan" value={String(forecast.monthlyDemand)} /><Kpi label="36-mo purchase" value={String(forecast.plannedPurchaseQuantity)} hint={forecast.firstReplenishmentMonth ? `First replenishment: month ${forecast.firstReplenishmentMonth}` : "No purchase trigger in plan"} /><Kpi label="Authoritative value" value={ledger === "stock" ? inr(summary.inventoryValueInr) : "—"} /></div>
    <Panel title="Add purchase lot / item" kicker="New rows remain local planning records until they are posted through the authoritative workflow"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([["Serial no.", "serialNo", "text"], ["Item description", "description", "text"], ["Purchase price ₹", "purchasePrice", "number"], ["Purchase date", "purchaseDate", "date"], ["Expiry date", "expiryDate", "date"], ["Next inspection", "nextInspectionDate", "date"], ["Quantity", "quantity", "number"], ["MSL level", "mslLevel", "number"]] as const).map(([label, key, type]) => <label key={key} className="text-xs"><span className="mb-1 block text-subtle">{label}</span><input className="control" type={type} min={type === "number" ? 0 : undefined} value={String(draft[key])} onChange={(event) => setDraft({ ...draft, [key]: type === "number" ? Number(event.target.value) : event.target.value })} /></label>)}</div><button type="button" onClick={addItem} className="mt-4 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg">Add row</button></Panel>
    <Panel title="Issue / use quantity" kicker="FIFO uses the oldest purchase date first; blank dates fall behind dated lots"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="text-xs"><span className="mb-1 block text-subtle">Quantity used</span><input className="control w-40" type="number" min="1" value={issueQty} onChange={(event) => setIssueQty(Math.max(1, Number(event.target.value)))} /></label><label className="text-xs"><span className="mb-1 block text-subtle">Issue / used date</span><input className="control w-48" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></label><button type="button" disabled={!canIssue} onClick={() => issue(ledger, issueQty, issueDate)} className="rounded-lg border border-accent px-4 py-2.5 text-sm font-semibold text-accent disabled:opacity-40">Record FIFO issue</button></div></Panel>
    <Panel title="Ledger spreadsheet" kicker="Serial · description · purchase and inspection dates · quantity · MSL · usage"><div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-sm"><thead className="text-[10px] uppercase tracking-wider text-subtle"><tr>{["Serial no.", "Item description", "Purchase price", "Purchase date", "Expiry date", "Next inspection", "Quantity", "MSL", "MSL status", "Issue / used date"].map((heading) => <th key={heading} className="px-3 py-3 text-left">{heading}</th>)}</tr></thead><tbody>{rows.map((row) => { const available = availableQuantity(row); const status = row.mslLevel > 0 && available < row.mslLevel ? "Replenish" : "Healthy"; const lastIssue = row.issues[row.issues.length - 1]; return <tr key={row.id} className="border-t border-border/70"><td className="px-3 py-3 font-mono text-xs">{row.serialNo || "—"}</td><td className="px-3 py-3 font-semibold">{row.description}</td><td className="px-3 py-3 tabular-nums">{inr(row.purchasePrice)}</td><td className="px-3 py-3 text-xs">{row.purchaseDate || "—"}</td><td className="px-3 py-3 text-xs">{row.expiryDate || "—"}</td><td className="px-3 py-3 text-xs">{row.nextInspectionDate || "—"}</td><td className="px-3 py-3 tabular-nums">{available} <span className="text-xs text-subtle">/ {row.quantity}</span></td><td className="px-3 py-3 tabular-nums">{row.mslLevel}</td><td className={status === "Replenish" ? "px-3 py-3 font-semibold text-warn" : "px-3 py-3 font-semibold text-green"}>{status}</td><td className="px-3 py-3 text-xs">{lastIssue ? `${lastIssue.date} · ${lastIssue.quantity}` : "—"}</td></tr>; })}</tbody></table>{rows.length === 0 && <p className="p-8 text-center text-sm text-muted">No rows yet. Add the first purchase lot or item above.</p>}</div></Panel>
    <Link to="/command/inventory" className="inline-flex rounded-lg border border-border px-4 py-2.5 text-sm text-muted hover:border-accent hover:text-accent">← Back to Master Ledger</Link>
  </main>;
}
