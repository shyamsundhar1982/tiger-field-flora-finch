export type EquipmentLedgerId =
  | "manufacturing"
  | "qualitySupport"
  | "officeAdmin"
  | "deadIdle"
  | "consumables";

export type EquipmentLedgerCategory = {
  id: string;
  ledger: EquipmentLedgerId;
  name: string;
  description?: string;
  sortOrder?: number;
};

export type EquipmentLedgerItem = {
  id: string;
  name: string;
  ledger: EquipmentLedgerId;
  category: string;
  categoryId?: string;
  details?: string;
  costLakh: number;
  monthlyCostLakh: number;
  purchaseMonth: number;
  usefulLifeMonths: number;
  allocationPct: number;
};

export const EQUIPMENT_LEDGER_META: Record<EquipmentLedgerId, { label: string; treatment: string }> = {
  manufacturing: { label: "Manufacturing Equipment & Tooling", treatment: "Manufacturing CAPEX / product-cost burden" },
  qualitySupport: { label: "Quality & Manufacturing Support Equipment", treatment: "Manufacturing support overhead" },
  officeAdmin: { label: "Office & Administration Equipment", treatment: "Administration overhead" },
  deadIdle: { label: "Dead / Idle Assets", treatment: "Excluded from active product costing" },
  consumables: { label: "Consumables", treatment: "Expense according to actual use" },
};

const DEFAULT_CATEGORY_ROWS: [string, EquipmentLedgerId, string][] = [
  ["mfg-jigs", "manufacturing", "Jigs"],
  ["mfg-moulds", "manufacturing", "Moulds"],
  ["mfg-processing", "manufacturing", "Composite processing"],
  ["mfg-tables", "manufacturing", "Production tables"],
  ["mfg-finishing", "manufacturing", "Finishing"],
  ["mfg-storage", "manufacturing", "Material storage"],
  ["mfg-tools", "manufacturing", "Tooling"],
  ["quality-testing", "qualitySupport", "Quality & testing"],
  ["quality-inspection", "qualitySupport", "Inspection"],
  ["quality-storage", "qualitySupport", "Storage"],
  ["quality-workshop", "qualitySupport", "Workshop"],
  ["quality-tool-management", "qualitySupport", "Tool management"],
  ["quality-stores", "qualitySupport", "Stores"],
  ["office-it", "officeAdmin", "IT"],
  ["office-furniture", "officeAdmin", "Furniture"],
  ["office-facilities", "officeAdmin", "Facilities"],
  ["office-other", "officeAdmin", "Other office equipment"],
  ["dead-nonproductive", "deadIdle", "Non-productive"],
  ["cons-production", "consumables", "Production"],
  ["cons-workshop", "consumables", "Workshop"],
  ["cons-operations", "consumables", "Operations"],
  ["cons-administration", "consumables", "Administration"],
];

export const DEFAULT_EQUIPMENT_LEDGER_CATEGORIES: EquipmentLedgerCategory[] = DEFAULT_CATEGORY_ROWS.map(([id, ledger, name], i) => ({ id, ledger, name, sortOrder: i }));

const DEFAULT_ITEM_ROWS: [string, string, EquipmentLedgerId, string][] = [
  ["manufacturing-jigs", "Manufacturing jigs", "manufacturing", "Jigs"],
  ["aluminium-moulds", "Aluminium moulds", "manufacturing", "Moulds"],
  ["autoclave", "Autoclave", "manufacturing", "Composite processing"],
  ["drag-tables", "Drag tables", "manufacturing", "Production tables"],
  ["painting-equipment", "Painting equipment", "manufacturing", "Finishing"],
  ["cooled-storage", "Cooled storage containers", "manufacturing", "Material storage"],
  ["production-tools", "Production-specific tools", "manufacturing", "Tooling"],
  ["quality-test", "Quality / test equipment", "qualitySupport", "Quality & testing"],
  ["inspection-equipment", "Inspection equipment", "qualitySupport", "Inspection"],
  ["racks", "Racks", "qualitySupport", "Storage"],
  ["bins", "Bins", "qualitySupport", "Storage"],
  ["workshop-tools", "Workshop tools", "qualitySupport", "Workshop"],
  ["tool-crib", "Tool crib", "qualitySupport", "Tool management"],
  ["material-storage", "Material / storage equipment", "qualitySupport", "Stores"],
  ["computers", "Computers", "officeAdmin", "IT"],
  ["tables-desks", "Tables / desks", "officeAdmin", "Furniture"],
  ["chairs", "Chairs", "officeAdmin", "Furniture"],
  ["ac", "Air conditioners", "officeAdmin", "Facilities"],
  ["water-dispenser", "Water dispenser", "officeAdmin", "Facilities"],
  ["sofa", "Sofa", "officeAdmin", "Furniture"],
  ["idle-assets", "Idle / obsolete / damaged / retired assets", "deadIdle", "Non-productive"],
  ["manufacturing-consumables", "Manufacturing consumables", "consumables", "Production"],
  ["workshop-consumables", "Workshop consumables", "consumables", "Workshop"],
  ["ppe-cleaning", "PPE / cleaning materials", "consumables", "Operations"],
  ["office-consumables", "Office consumables", "consumables", "Administration"],
];

export const DEFAULT_EQUIPMENT_LEDGER: EquipmentLedgerItem[] = DEFAULT_ITEM_ROWS.map(([id, name, ledger, category]) => ({
  id,
  name,
  ledger,
  category,
  categoryId: DEFAULT_CATEGORY_ROWS.find(([, l, n]) => l === ledger && n === category)?.[0],
  details: "",
  costLakh: 0,
  monthlyCostLakh: 0,
  purchaseMonth: 1,
  usefulLifeMonths: 60,
  allocationPct: 100,
}));

export type EquipmentLedgerSummary = {
  manufacturingCapex: number;
  supportCapex: number;
  officeCapex: number;
  deadIdleValue: number;
  consumablesMonthly: number;
};

export function equipmentSummary(items: EquipmentLedgerItem[]): EquipmentLedgerSummary {
  return items.reduce<EquipmentLedgerSummary>((sum, item) => {
    if (item.ledger === "manufacturing") sum.manufacturingCapex += Math.max(0, item.costLakh);
    if (item.ledger === "qualitySupport") sum.supportCapex += Math.max(0, item.costLakh);
    if (item.ledger === "officeAdmin") sum.officeCapex += Math.max(0, item.costLakh);
    if (item.ledger === "deadIdle") sum.deadIdleValue += Math.max(0, item.costLakh);
    if (item.ledger === "consumables") sum.consumablesMonthly += Math.max(0, item.monthlyCostLakh);
    return sum;
  }, { manufacturingCapex: 0, supportCapex: 0, officeCapex: 0, deadIdleValue: 0, consumablesMonthly: 0 });
}

function depreciationForLedger(items: EquipmentLedgerItem[], month: number, ledgers: EquipmentLedgerId[]) {
  return items.reduce((sum, item) => {
    if (!ledgers.includes(item.ledger) || month < item.purchaseMonth || item.usefulLifeMonths <= 0 || item.costLakh <= 0) return sum;
    const elapsed = month - item.purchaseMonth;
    if (elapsed >= item.usefulLifeMonths) return sum;
    return sum + (item.costLakh / item.usefulLifeMonths) * Math.max(0, item.allocationPct) / 100;
  }, 0);
}

export function equipmentMonthlyDepreciation(items: EquipmentLedgerItem[], month: number) { return depreciationForLedger(items, month, ["manufacturing", "qualitySupport", "officeAdmin"]); }
export function equipmentDirectManufacturingDepreciationForMonth(items: EquipmentLedgerItem[], month: number) { return depreciationForLedger(items, month, ["manufacturing"]); }
export function equipmentManufacturingSupportDepreciationForMonth(items: EquipmentLedgerItem[], month: number) { return depreciationForLedger(items, month, ["qualitySupport"]); }
export function equipmentOfficeDepreciationForMonth(items: EquipmentLedgerItem[], month: number) { return depreciationForLedger(items, month, ["officeAdmin"]); }

export function equipmentCapexForMonth(items: EquipmentLedgerItem[], month: number) {
  return items.reduce((sum, item) => item.ledger === "deadIdle" || item.ledger === "consumables" ? sum : sum + (item.purchaseMonth === month ? Math.max(0, item.costLakh) : 0), 0);
}

export function equipmentConsumablesForMonth(items: EquipmentLedgerItem[], month: number, ledger: EquipmentLedgerId) {
  if (ledger !== "consumables") return 0;
  return items.reduce((sum, item) => item.ledger !== "consumables" || item.id === "office-consumables" || month < item.purchaseMonth ? sum : sum + Math.max(0, item.monthlyCostLakh) * Math.max(0, item.allocationPct) / 100, 0);
}

export function equipmentOfficeConsumablesForMonth(items: EquipmentLedgerItem[], month: number) {
  return items.reduce((sum, item) => item.ledger !== "consumables" || item.id !== "office-consumables" || month < item.purchaseMonth ? sum : sum + Math.max(0, item.monthlyCostLakh) * Math.max(0, item.allocationPct) / 100, 0);
}
