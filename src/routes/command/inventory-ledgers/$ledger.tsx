import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Panel, Kpi } from "@/components/kpi";
import { InventoryWorkspaceNav } from "@/components/inventory-workspace-nav";
import { inr } from "@/lib/format";
import { getAuthoritativeInventory, getAuthoritativeInventoryMovements, getInventoryControlSummary, getInventoryFifoTrace, getInventoryMslWarnings } from "@/lib/inventory-authority";
import { useVeloxis } from "@/lib/store";
import type { EquipmentLedgerId, EquipmentLedgerItem } from "@/lib/finance/equipment-ledger";
import { DEFAULT_EQUIPMENT_LEDGER, DEFAULT_EQUIPMENT_LEDGER_CATEGORIES } from "@/lib/finance/equipment-ledger";
import { INVENTORY_LEDGER_PAGES, type InventoryLedgerId } from "@/lib/inventory-navigation";

const LEDGER_IDS = INVENTORY_LEDGER_PAGES.map(x => x.id) as readonly InventoryLedgerId[];
const EQUIPMENT_DEFS: Record<string, { source: EquipmentLedgerId; categories?: string[]; title: string; detail: string }> = {
  tooling: { source: "manufacturing", title: "Manufacturing Tooling Ledger", detail: "Jigs, aluminium moulds, composite processing, production tables, finishing, storage and production tools." },
  quality: { source: "qualitySupport", categories: ["quality-testing", "quality-inspection"], title: "Quality & Test Ledger", detail: "Quality/test and inspection equipment used to support release and verification." },
  "stores-tools": { source: "qualitySupport", categories: ["quality-storage", "quality-workshop", "quality-tool-management", "quality-stores"], title: "Stores & Tool Crib Ledger", detail: "Racks, bins, workshop tools, tool crib, material storage and stores equipment." },
};

export const Route = createFileRoute("/command/inventory-ledgers/$ledger")({
  loader: async ({ params }) => {
    if (EQUIPMENT_DEFS[params.ledger]) return { summary: null, balances: [], movements: [], msl: [], fifo: [] };
    const [summary, balances, movements, msl, fifo] = await Promise.all([getInventoryControlSummary(), getAuthoritativeInventory(), getAuthoritativeInventoryMovements(), getInventoryMslWarnings(), getInventoryFifoTrace()]);
    return { summary, balances, movements, msl, fifo };
  },
  component: LedgerPage,
});

function LedgerPage() {
  const d = Route.useLoaderData();
  const rawLedger = Route.useParams().ledger;
  const ledger = (LEDGER_IDS.includes(rawLedger as InventoryLedgerId) ? rawLedger : "stock") as InventoryLedgerId;
  const isEquipment = Boolean(EQUIPMENT_DEFS[ledger]);
  const titles: Record<InventoryLedgerId, [string, string]> = {
    stock: ["Stock Ledger", "Authoritative balance + WAC"],
    movements: ["Movement Ledger", "Append-only posted inventory events"],
    fifo: ["FIFO Ledger", "Oldest receipt layer first"],
    msl: ["MSL Ledger", "Minimum-stock and replenishment control"],
    tooling: ["Manufacturing Tooling Ledger", "Manufacturing equipment and tooling asset view"],
    quality: ["Quality & Test Ledger", "Quality and inspection equipment asset view"],
    "stores-tools": ["Stores & Tool Crib Ledger", "Stores, racks, bins and tool-management asset view"],
  };
  const title = titles[ledger][0];
  const kicker = titles[ledger][1];

  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] uppercase tracking-[0.22em] text-green">Inventory · ledger control</p><h1 className="mt-2 text-4xl font-bold text-accent">{title}</h1><p className="mt-2 max-w-4xl text-sm text-muted">{kicker}. {isEquipment ? "This is a controlled presentation view over the shared equipment ledger; edits remain in the existing planning state." : "This page reads only authoritative posted inventory data."}</p></div><div className="flex gap-2"><Link to="/command/inventory-ledgers" className="rounded-lg border border-border px-4 py-2.5 text-sm">← Ledger Control</Link><Link to="/command/inventory" className="rounded-lg border border-border px-4 py-2.5 text-sm">Inventory</Link></div></header>
    <InventoryWorkspaceNav active={ledger} />
    {!isEquipment && d.summary && <div className="grid gap-3 sm:grid-cols-3"><Kpi label="Authoritative SKUs" value={String(d.summary.skuCount)} /><Kpi label="Units" value={String(d.summary.totalUnits)} /><Kpi label="Inventory value" value={inr(d.summary.inventoryValueInr)} /></div>}
    {ledger === "stock" && <Panel title="Stock ledger" kicker="Authoritative balance + WAC"><Table h={["Venture","SKU","Unit","Balance","WAC","Value"]}>{(d.balances as any[]).map(x => <tr key={x.venture + "-" + x.sku + "-" + x.unit} className="border-t border-border/70"><td>{x.venture}</td><td><Link className="font-mono text-xs text-accent" to="/command/inventory-ledgers/movements" search={{ sku: x.sku } as never}>{x.sku}</Link></td><td>{x.unit}</td><td className="text-right">{Number(x.quantity_balance)}</td><td className="text-right">{inr(Number(x.weighted_average_cost_inr))}</td><td className="text-right">{inr(Number(x.inventory_value_inr))}</td></tr>)}</Table></Panel>}
    {ledger === "movements" && <Panel title="Movement ledger" kicker="Append-only posted events"><Table h={["Date","Type","SKU","Delta","Unit","Reference"]}>{(d.movements as any[]).map(x => <tr key={x.id} className="border-t border-border/70"><td>{new Date(x.created_at).toLocaleString()}</td><td className="uppercase text-xs">{x.movement_type}</td><td className="font-mono text-xs">{x.sku}</td><td className="text-right">{Number(x.quantity_delta)}</td><td>{x.unit}</td><td>{x.reference || "—"}</td></tr>)}</Table></Panel>}
    {ledger === "fifo" && <Panel title="FIFO ledger" kicker="Oldest receipt layer first"><Table h={["Received","SKU","Qty received","Remaining","Unit cost","Allocations"]}>{(d.fifo as any[]).map(x => <tr key={x.layer_id} className="border-t border-border/70"><td>{new Date(x.received_at).toLocaleDateString()}</td><td className="font-mono text-xs">{x.sku}</td><td className="text-right">{Number(x.quantity_received)}</td><td className="text-right font-semibold">{Number(x.quantity_remaining)}</td><td className="text-right">{inr(Number(x.unit_cost_inr))}</td><td className="text-right">{Number(x.allocation_count)}</td></tr>)}</Table></Panel>}
    {ledger === "msl" && <Panel title="MSL ledger" kicker="Minimum stock exceptions"><Table h={["Status","SKU","On hand","MSL","Shortfall","Reorder","Lead"]}>{(d.msl as any[]).map(x => <tr key={x.venture + "-" + x.sku + "-" + x.unit} className="border-t border-border/70"><td className="uppercase text-xs">{x.status}</td><td className="font-mono text-xs">{x.sku}</td><td className="text-right">{Number(x.quantity_balance)}</td><td className="text-right">{Number(x.minimum_stock_level)}</td><td className="text-right">{Number(x.shortage_quantity)}</td><td className="text-right">{Number(x.reorder_quantity)}</td><td>{Number(x.lead_time_days)} d</td></tr>)}</Table></Panel>}
    {isEquipment && <EquipmentLedgerView definition={EQUIPMENT_DEFS[ledger]} />}
  </main>;
}

function EquipmentLedgerView({ definition }: { definition: { source: EquipmentLedgerId; categories?: string[]; title: string; detail: string } }) {
  const items = useVeloxis(s => s.finance.equipmentLedger ?? DEFAULT_EQUIPMENT_LEDGER);
  const categories = useVeloxis(s => s.finance.equipmentLedgerCategories ?? DEFAULT_EQUIPMENT_LEDGER_CATEGORIES);
  const updateItem = useVeloxis(s => s.updateEquipmentItem);
  const addCategory = useVeloxis(s => s.addEquipmentCategory);
  const addItem = useVeloxis(s => s.addEquipmentItem);
  const [categoryName, setCategoryName] = useState("");
  const [itemName, setItemName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const visibleCategories = categories.filter(c => c.ledger === definition.source && (!definition.categories || definition.categories.includes(c.id)));
  const visibleItems = items.filter(i => i.ledger === definition.source && (!definition.categories || definition.categories.includes(i.categoryId || "")));
  const activeCategory = selectedCategory || visibleCategories[0]?.id || "";

  return <Panel title={definition.title} kicker={definition.detail}>
    <div className="mb-4 flex flex-wrap gap-2"><input className="control min-w-[220px]" placeholder="New category for this ledger" value={categoryName} onChange={e => setCategoryName(e.target.value)} /><button disabled={!categoryName.trim()} onClick={() => { addCategory(definition.source, categoryName.trim()); setCategoryName(""); }} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Add category</button><select className="control" value={activeCategory} onChange={e => setSelectedCategory(e.target.value)}>{visibleCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input className="control min-w-[220px]" placeholder="New item" value={itemName} onChange={e => setItemName(e.target.value)} /><button disabled={!itemName.trim() || !activeCategory} onClick={() => { addItem(definition.source, activeCategory, itemName.trim()); setItemName(""); }} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Add item</button></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="text-[10px] uppercase tracking-wider text-subtle"><tr>{["Category","Item","Details","Cost (₹L)","Monthly (₹L)","Purchase M","Life (mo)","Allocation %"].map(x => <th key={x} className="px-2 py-3 text-left">{x}</th>)}</tr></thead><tbody>
      {visibleItems.map((item: EquipmentLedgerItem) => <tr key={item.id} className="border-t border-border/70"><td className="px-2 py-2 text-xs">{item.category}</td><td className="px-2 py-2 font-semibold">{item.name}</td><td className="px-2 py-2"><input className="control min-w-[180px]" value={item.details || ""} onChange={e => updateItem(item.id, "details", e.target.value)} /></td><td className="px-2 py-2"><input className="control w-28" type="number" min="0" step="0.01" value={item.costLakh} onChange={e => updateItem(item.id, "costLakh", Number(e.target.value) || 0)} /></td><td className="px-2 py-2"><input className="control w-28" type="number" min="0" step="0.01" value={item.monthlyCostLakh} onChange={e => updateItem(item.id, "monthlyCostLakh", Number(e.target.value) || 0)} /></td><td className="px-2 py-2"><input className="control w-24" type="number" min="1" step="1" value={item.purchaseMonth} onChange={e => updateItem(item.id, "purchaseMonth", Number(e.target.value) || 1)} /></td><td className="px-2 py-2"><input className="control w-24" type="number" min="1" step="1" value={item.usefulLifeMonths} onChange={e => updateItem(item.id, "usefulLifeMonths", Number(e.target.value) || 1)} /></td><td className="px-2 py-2"><input className="control w-24" type="number" min="0" max="100" step="1" value={item.allocationPct} onChange={e => updateItem(item.id, "allocationPct", Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /></td></tr>)}
    </tbody></table></div>
    {visibleItems.length === 0 && <p className="mt-4 rounded-lg border border-dashed border-border p-5 text-sm text-muted">No items are currently defined for this ledger. Add a category and then add items. Future categories and details remain supported without changing the ledger structure.</p>}
  </Panel>;
}

function Table({ h, children }: { h: string[]; children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead className="text-[10px] uppercase tracking-wider text-subtle"><tr>{h.map(x => <th key={x} className="px-3 py-3 text-left">{x}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
