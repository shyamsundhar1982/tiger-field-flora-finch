export type EquipmentLedgerId =
  | "manufacturing"
  | "qualitySupport"
  | "officeAdmin"
  | "deadIdle"
  | "consumables";

export type EquipmentLedgerItem = {
  id: string;
  name: string;
  ledger: EquipmentLedgerId;
  category: string;
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

export const DEFAULT_EQUIPMENT_LEDGER: EquipmentLedgerItem[] = [
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
].map(([id, name, ledger, category]) => ({
  id,
  name,
  ledger: ledger as EquipmentLedgerId,
  category,
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
  return items.reduce<EquipmentLedgerSummary>(
    (sum, item) => {
      if (item.ledger === "manufacturing") sum.manufacturingCapex += Math.max(0, item.costLakh);
      if (item.ledger === "qualitySupport") sum.supportCapex += Math.max(0, item.costLakh);
      if (item.ledger === "officeAdmin") sum.officeCapex += Math.max(0, item.costLakh);
      if (item.ledger === "deadIdle") sum.deadIdleValue += Math.max(0, item.costLakh);
      if (item.ledger === "consumables") sum.consumablesMonthly += Math.max(0, item.monthlyCostLakh);
      return sum;
    },
    { manufacturingCapex: 0, supportCapex: 0, officeCapex: 0, deadIdleValue: 0, consumablesMonthly: 0 },
  );
}

function depreciationForLedger(items: EquipmentLedgerItem[], month: number, ledgers: EquipmentLedgerId[]) {
  return items.reduce((sum, item) => {
    if (!ledgers.includes(item.ledger) || month < item.purchaseMonth || item.usefulLifeMonths <= 0 || item.costLakh <= 0) return sum;
    const elapsed = month - item.purchaseMonth;
    if (elapsed >= item.usefulLifeMonths) return sum;
    return sum + (item.costLakh / item.usefulLifeMonths) * Math.max(0, item.allocationPct) / 100;
  }, 0);
}

export function equipmentMonthlyDepreciation(items: EquipmentLedgerItem[], month: number) {
  return depreciationForLedger(items, month, ["manufacturing", "qualitySupport", "officeAdmin"]);
}

export function equipmentDirectManufacturingDepreciationForMonth(items: EquipmentLedgerItem[], month: number) {
  return depreciationForLedger(items, month, ["manufacturing"]);
}

export function equipmentManufacturingSupportDepreciationForMonth(items: EquipmentLedgerItem[], month: number) {
  return depreciationForLedger(items, month, ["qualitySupport"]);
}

export function equipmentOfficeDepreciationForMonth(items: EquipmentLedgerItem[], month: number) {
  return depreciationForLedger(items, month, ["officeAdmin"]);
}

export function equipmentCapexForMonth(items: EquipmentLedgerItem[], month: number) {
  return items.reduce((sum, item) => {
    if (item.ledger === "deadIdle" || item.ledger === "consumables") return sum;
    return sum + (item.purchaseMonth === month ? Math.max(0, item.costLakh) : 0);
  }, 0);
}

export function equipmentConsumablesForMonth(items: EquipmentLedgerItem[], month: number, ledger: EquipmentLedgerId) {
  if (ledger !== "consumables") return 0;
  return items.reduce((sum, item) => {
    if (item.ledger !== "consumables" || item.id === "office-consumables" || month < item.purchaseMonth) return sum;
    return sum + Math.max(0, item.monthlyCostLakh) * Math.max(0, item.allocationPct) / 100;
  }, 0);
}

export function equipmentOfficeConsumablesForMonth(items: EquipmentLedgerItem[], month: number) {
  return items.reduce((sum, item) => {
    if (item.ledger !== "consumables" || item.id !== "office-consumables" || month < item.purchaseMonth) return sum;
    return sum + Math.max(0, item.monthlyCostLakh) * Math.max(0, item.allocationPct) / 100;
  }, 0);
}
