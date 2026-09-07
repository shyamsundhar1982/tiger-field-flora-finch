export type InventoryNavPage = { id: string; label: string; route: string; detail: string };

export const INVENTORY_CONTROL_PAGES: InventoryNavPage[] = [
  { id: "master", label: "Inventory Master", route: "/command/inventory-master", detail: "Controlled SKU identity, approval and lifecycle" },
  { id: "bom", label: "BOM Control", route: "/command/bom-control", detail: "Controlled BOM revisions and component requirements" },
  { id: "mapping", label: "BOM → Inventory Mapping", route: "/command/bom-inventory-mapping", detail: "Approved BOM component to SKU relationship" },
  { id: "openings", label: "Opening Balances", route: "/command/inventory-openings", detail: "Draft → approve → post opening stock" },
  { id: "truth", label: "Inventory Truth", route: "/command/inventory-truth", detail: "Authoritative posted stock and valuation" },
  { id: "audit", label: "MSL & FIFO Audit", route: "/command/inventory-control-audit", detail: "Reconciliation and replenishment controls" },
];

export const INVENTORY_LEDGER_PAGES = [
  { id: "stock", label: "Stock balance", detail: "Authoritative balance, WAC and inventory value", group: "Stock & replenishment" },
  { id: "movements", label: "Posted movements", detail: "Receipts, issues, consumption and returns", group: "Stock & replenishment" },
  { id: "fifo", label: "FIFO layers", detail: "Receipt layers, remaining quantities and allocations", group: "Stock & replenishment" },
  { id: "msl", label: "Minimum stock", detail: "Minimum stock, shortage, reorder and lead time", group: "Stock & replenishment" },
  { id: "tooling", label: "Manufacturing tooling", detail: "Jigs, aluminium moulds, processing and production tooling", group: "Support assets" },
  { id: "quality", label: "Quality & test equipment", detail: "Quality, test and inspection equipment", group: "Support assets" },
  { id: "stores-tools", label: "Stores & tool crib", detail: "Racks, bins, workshop tools and stores equipment", group: "Support assets" },
] as const;

export type InventoryLedgerId = typeof INVENTORY_LEDGER_PAGES[number]["id"];
export const CORE_INVENTORY_LEDGER_IDS = ["stock", "movements", "fifo", "msl"] as const;
export const ASSET_INVENTORY_LEDGER_IDS = ["tooling", "quality", "stores-tools"] as const;
