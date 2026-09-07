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

/** Existing persisted records may still use these IDs; keep them readable but out of ordinary navigation. */
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

/**
 * Only provenance/audit controls remain in ordinary navigation. Previous SKU,
 * opening-balance, truth and component-control pages remain addressable for
 * legacy records but do not compete with Master Inventory.
 */
export const INVENTORY_CONTROL_PAGES: InventoryNavPage[] = [
  {
    id: "mapping",
    label: "BOM mapping audit",
    route: "/command/bom-inventory-mapping",
    detail: "Trace configured BOM requirements to controlled Master Inventory SKUs",
  },
  {
    id: "audit",
    label: "MSL & FIFO audit",
    route: "/command/inventory-control-audit",
    detail: "Reconciliation and replenishment control evidence",
  },
];

export const CORE_INVENTORY_LEDGER_IDS = ["components", "raw-materials"] as const;
export const ASSET_INVENTORY_LEDGER_IDS = ["tooling", "quality", "stores-tools"] as const;
