export type InventoryNavPage = { id: string; label: string; route: string; detail: string };

/**
 * The ledgers visible from Master Inventory. Report concepts such as MSL,
 * movements and FIFO are columns/rules inside each ledger, not separate places
 * for a user to navigate to.
 */
export const MASTER_INVENTORY_LEDGER_PAGES = [
  {
    id: "components",
    label: "Components",
    detail: "The complete 60+ component catalogue and purchase lots",
    group: "Stock",
  },
  {
    id: "raw-materials",
    label: "Raw materials",
    detail: "Carbon, aluminium, paint and production consumables",
    group: "Stock",
  },
  {
    id: "tooling",
    label: "Manufacturing tooling",
    detail: "Jigs, moulds and production tooling",
    group: "Assets",
  },
  {
    id: "quality",
    label: "Quality & test",
    detail: "Inspection, measurement and test equipment",
    group: "Assets",
  },
  {
    id: "stores-tools",
    label: "Stores & tools",
    detail: "Workshop tools, racks, bins and stores equipment",
    group: "Assets",
  },
] as const;

/** Existing persisted records may still use these IDs; keep them readable. */
export const LEGACY_INVENTORY_LEDGER_PAGES = [
  {
    id: "stock",
    label: "Legacy stock balance",
    detail: "Previous combined stock planning view",
    group: "Legacy",
  },
  {
    id: "movements",
    label: "Legacy movements",
    detail: "Previous movement report view",
    group: "Legacy",
  },
  { id: "fifo", label: "Legacy FIFO layers", detail: "Previous FIFO report view", group: "Legacy" },
  { id: "msl", label: "Legacy minimum stock", detail: "Previous MSL report view", group: "Legacy" },
] as const;

export const INVENTORY_LEDGER_PAGES = [
  ...MASTER_INVENTORY_LEDGER_PAGES,
  ...LEGACY_INVENTORY_LEDGER_PAGES,
] as const;

export type InventoryLedgerId = (typeof INVENTORY_LEDGER_PAGES)[number]["id"];
export type MasterInventoryLedgerId = (typeof MASTER_INVENTORY_LEDGER_PAGES)[number]["id"];

export function isMasterInventoryLedger(value: string): value is MasterInventoryLedgerId {
  return MASTER_INVENTORY_LEDGER_PAGES.some((page) => page.id === value);
}

export const INVENTORY_CONTROL_PAGES: InventoryNavPage[] = [
  {
    id: "master",
    label: "Controlled SKU master",
    route: "/command/inventory-master",
    detail: "Previous controlled SKU approval workflow",
  },
  {
    id: "mapping",
    label: "BOM → Inventory mapping",
    route: "/command/bom-inventory-mapping",
    detail: "Previous component-to-SKU mapping workflow",
  },
  {
    id: "openings",
    label: "Opening balances",
    route: "/command/inventory-openings",
    detail: "Previous opening stock workflow",
  },
  {
    id: "truth",
    label: "Posted inventory truth",
    route: "/command/inventory-truth",
    detail: "Previous server-backed balance and valuation read model",
  },
  {
    id: "audit",
    label: "MSL & FIFO audit",
    route: "/command/inventory-control-audit",
    detail: "Previous reconciliation and replenishment control view",
  },
  {
    id: "component",
    label: "Component control",
    route: "/command/component-control",
    detail: "Previous component compatibility screen",
  },
];

export const CORE_INVENTORY_LEDGER_IDS = ["components", "raw-materials"] as const;
export const ASSET_INVENTORY_LEDGER_IDS = ["tooling", "quality", "stores-tools"] as const;
