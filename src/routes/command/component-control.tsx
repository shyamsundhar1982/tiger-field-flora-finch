import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useMemo, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { getComponentControl, type ComponentControlRow } from "@/lib/component-control";

export const Route = createFileRoute("/command/component-control")({
  validateSearch: z.object({ venture: z.enum(["carbon", "aluminium"]).default("carbon") }),
  loader: async ({ search }) => getComponentControl({ data: { venture: search.venture } }),
  component: ComponentControlPage,
});

function ComponentControlPage() {
  const search = Route.useSearch();
  const rows = Route.useLoaderData() as ComponentControlRow[];
  const [modelFilter, setModelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const models = useMemo(() => Array.from(new Set(rows.map((row) => row.modelId))).sort(), [rows]);
  const filtered = useMemo(
    () => rows.filter((row) => (modelFilter === "all" || row.modelId === modelFilter) && (statusFilter === "all" || row.status === statusFilter)),
    [rows, modelFilter, statusFilter],
  );
  const short = rows.filter((row) => row.status === "SHORT").length;
  const noStock = rows.filter((row) => row.status === "NO_STOCK").length;
  const belowMsl = rows.filter((row) => row.belowMsl).length;

  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-green">Inventory · operational component control</p>
        <h1 className="mt-2 text-4xl font-bold text-accent">Component Control</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Active BOM → inventory mappings checked against authoritative stock. No legacy catalogue quantities, seed inventory, or browser-local stock are used.</p>
      </div>
      <Link to="/command/inventory" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted">Back to Inventory Hub →</Link>
    </header>

    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">Venture</span>
      <Link to="/command/component-control" search={{ venture: "carbon" }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase ${search.venture === "carbon" ? "border-accent bg-accent/10 text-accent" : "border-border text-muted"}`}>Carbon</Link>
      <Link to="/command/component-control" search={{ venture: "aluminium" }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase ${search.venture === "aluminium" ? "border-accent bg-accent/10 text-accent" : "border-border text-muted"}`}>Aluminium</Link>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi label="Total active mappings" value={String(rows.length)} />
      <Kpi label="Short" value={String(short)} />
      <Kpi label="No stock" value={String(noStock)} />
      <Kpi label="Below MSL" value={String(belowMsl)} />
    </div>

    <Panel title="Control filters" kicker={`${search.venture} venture`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">Model</span><select className="control" value={modelFilter} onChange={(event) => setModelFilter(event.target.value)}><option value="all">All models</option>{models.map((model) => <option key={model} value={model}>{model.toUpperCase()}</option>)}</select></label>
        <label><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">Status</span><select className="control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="AVAILABLE">Available</option><option value="SHORT">Short</option><option value="NO_STOCK">No stock</option></select></label>
      </div>
    </Panel>

    <Panel title="Active component requirements" kicker={`${filtered.length} shown`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3">Model</th><th className="px-3 py-3">Component</th><th className="px-3 py-3 text-right">Required Qty</th><th className="px-3 py-3">SKU</th><th className="px-3 py-3">Unit</th><th className="px-3 py-3 text-right">Balance</th><th className="px-3 py-3 text-right">MSL</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Below MSL?</th><th className="px-3 py-3">Ledger</th></tr></thead>
          <tbody>{filtered.map((row) => <tr key={`${row.modelId}|${row.bomRevision}|${row.componentKey}|${row.sku}|${row.unit}`} className="border-t border-border/70"><td className="px-3 py-3 uppercase">{row.modelId}</td><td className="px-3 py-3 font-mono text-xs">{row.componentKey}</td><td className="px-3 py-3 text-right tabular-nums">{row.requiredQty}</td><td className="px-3 py-3 font-mono text-xs font-semibold">{row.sku}</td><td className="px-3 py-3">{row.unit}</td><td className="px-3 py-3 text-right tabular-nums">{row.balance}</td><td className="px-3 py-3 text-right tabular-nums">{row.msl ?? "—"}</td><td className="px-3 py-3"><StatusBadge status={row.status} /></td><td className="px-3 py-3">{row.belowMsl ? <span className="text-warn">Yes</span> : <span className="text-muted">No</span>}</td><td className="px-3 py-3"><span className="text-xs text-subtle" title="Inventory Ledgers does not yet accept an SKU query parameter.">SKU drill-down pending</span></td></tr>)}</tbody>
        </table>
        {filtered.length === 0 && <p className="py-10 text-center text-sm text-muted">No active component mappings match these filters.</p>}
      </div>
    </Panel>

    <div className="rounded-xl border border-border bg-bg-elevated/30 p-4 text-xs leading-5 text-muted"><strong className="text-fg">Control boundary:</strong> this page is read-only. BOM → SKU mapping remains controlled master data, while balance comes only from the authoritative inventory ledger/read model.</div>
  </main>;
}

function StatusBadge({ status }: { status: ComponentControlRow["status"] }) {
  return <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${status === "AVAILABLE" ? "border-green/40 text-green" : status === "SHORT" ? "border-warn/40 text-warn" : "border-red-400/40 text-red-400"}`}>{status.replace("_", " ")}</span>;
}
