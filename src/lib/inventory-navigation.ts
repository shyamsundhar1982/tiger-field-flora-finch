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
  { id: "stock", label: "Stock Ledger", detail: "Authoritative balance, WAC and inventory value", group: "Inventory" },
  { id: "movements", label: "Movement Ledger", detail: "Posted receipts, issues, consumption and returns", group: "Inventory" },
  { id: "fifo", label: "FIFO Ledger", detail: "Receipt layers, remaining quantities and allocations", group: "Inventory" },
  { id: "msl", label: "MSL Ledger", detail: "Minimum stock, shortage, reorder and lead time", group: "Inventory" },
  { id: "tooling", label: "Manufacturing Tooling Ledger", detail: "Jigs, aluminium moulds, processing and production tooling", group: "Assets & Support" },
  { id: "quality", label: "Quality & Test Ledger", detail: "Quality/test and inspection equipment", group: "Assets & Support" },
  { id: "stores-tools", label: "Stores & Tool Crib Ledger", detail: "Racks, bins, workshop tools, tool crib and stores equipment", group: "Assets & Support" },
] as const;

export type InventoryLedgerId = typeof INVENTORY_LEDGER_PAGES[number]["id"];
export const CORE_INVENTORY_LEDGER_IDS = ["stock", "movements", "fifo", "msl"] as const;
export const ASSET_INVENTORY_LEDGER_IDS = ["tooling", "quality", "stores-tools"] as const;
