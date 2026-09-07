import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FinanceAssumptions, ProductLineId, ScenarioId } from "@/lib/finance/model";
import { DEFAULT_FINANCE_ASSUMPTIONS } from "@/lib/finance/model";
import { DEFAULT_ACCOUNTING_ASSUMPTIONS, type AccountingAssumptions, type FundingType } from "@/lib/finance/accounting";
import type { EquipmentLedgerId, EquipmentLedgerItem, EquipmentLedgerCategory } from "@/lib/finance/equipment-ledger";
import { DEFAULT_EQUIPMENT_LEDGER, DEFAULT_EQUIPMENT_LEDGER_CATEGORIES } from "@/lib/finance/equipment-ledger";
import type { BomCostSource, BomTier } from "@/lib/finance/bom-engine";
import { ACTIONS } from "@/lib/data/actions";
import type { MasterLedgerRow } from "@/lib/master-ledger";

type ActionState = Record<string, "open" | "doing" | "done">;
type NumericAccountingKey = Exclude<keyof AccountingAssumptions, "fundingTypeByMonth">;
type EquipmentEditableKey = Exclude<keyof EquipmentLedgerItem, "id">;
const initialActions: ActionState = Object.fromEntries(ACTIONS.map((a) => [a.id, "open"]));

function withEquipmentDefaults(finance: FinanceAssumptions): FinanceAssumptions {
  return {
    ...finance,
    equipmentLedger: finance.equipmentLedger ?? DEFAULT_EQUIPMENT_LEDGER,
    equipmentLedgerCategories: finance.equipmentLedgerCategories ?? DEFAULT_EQUIPMENT_LEDGER_CATEGORIES,
  };
}

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const SUPPORT_LEDGER_BY_EQUIPMENT: Record<EquipmentLedgerId, MasterLedgerRow["ledgerId"]> = {
  manufacturing: "tooling",
  qualitySupport: "quality",
  officeAdmin: "stores-tools",
  deadIdle: "stores-tools",
  consumables: "stores-tools",
};
const INITIAL_MASTER_LEDGER_ROWS: MasterLedgerRow[] = DEFAULT_EQUIPMENT_LEDGER.map((item) => ({
  id: `seed-${item.id}`,
  ledgerId: SUPPORT_LEDGER_BY_EQUIPMENT[item.ledger],
  serialNo: item.id.toUpperCase(),
  description: item.name,
  purchasePrice: Math.max(0, item.costLakh) * 100000,
  purchaseDate: "",
  expiryDate: "",
  nextInspectionDate: "",
  quantity: 1,
  mslLevel: 0,
  issues: [],
}));

type Store = {
  scenario: ScenarioId;
  drawStandby: boolean;
  actions: ActionState;
  finance: FinanceAssumptions;
  accounting: AccountingAssumptions;
  masterLedgerRows: MasterLedgerRow[];
  setScenario: (s: ScenarioId) => void;
  setDrawStandby: (v: boolean) => void;
  setAction: (id: string, s: "open" | "doing" | "done") => void;
  setFinance: (finance: FinanceAssumptions) => void;
  updateGlobalFinance: (key: keyof Omit<FinanceAssumptions, "productLines" | "aluminiumVertical" | "bomOverrides" | "bomCostSource" | "bomTierByProduct" | "equipmentLedger" | "equipmentLedgerCategories">, value: number) => void;
  updateProductLine: (id: ProductLineId, key: "aspLakh" | "cogsLakh" | "mixPct" | "launchMonth", value: number) => void;
  updateProductCostSource: (id: ProductLineId, value: BomCostSource) => void;
  updateProductBomTier: (id: ProductLineId, value: BomTier) => void;
  updateBomLine: (item: string, tier: BomTier, field: "quantity" | "unitCostInr", value: number) => void;
  updateAluminiumVertical: (key: keyof FinanceAssumptions["aluminiumVertical"], value: number) => void;
  updateAccounting: (key: NumericAccountingKey, value: number) => void;
  setFundingType: (month: number, value: FundingType) => void;
  updateEquipmentItem: (id: string, key: EquipmentEditableKey, value: string | number | EquipmentLedgerId) => void;
  addEquipmentCategory: (ledger: EquipmentLedgerId, name: string, description?: string) => void;
  updateEquipmentCategory: (id: string, key: "name" | "description", value: string) => void;
  addEquipmentItem: (ledger: EquipmentLedgerId, categoryId: string, name: string) => void;
  addMasterLedgerRow: (row: Omit<MasterLedgerRow, "id" | "issues">) => void;
  issueMasterLedger: (ledgerId: MasterLedgerRow["ledgerId"], quantity: number, date: string) => void;
  resetFinance: () => void;
};

export const useVeloxis = create<Store>()(
  persist(
    (set) => ({
      scenario: "base",
      drawStandby: true,
      actions: initialActions,
      finance: withEquipmentDefaults(DEFAULT_FINANCE_ASSUMPTIONS),
      accounting: DEFAULT_ACCOUNTING_ASSUMPTIONS,
      masterLedgerRows: INITIAL_MASTER_LEDGER_ROWS,
      setScenario: (scenario) => set({ scenario }),
      setDrawStandby: (drawStandby) => set({ drawStandby }),
      setAction: (id, status) => set((state) => ({ actions: { ...state.actions, [id]: status } })),
      setFinance: (finance) => set({ finance: withEquipmentDefaults(finance) }),
      updateGlobalFinance: (key, value) => set((state) => ({ finance: { ...state.finance, [key]: value } })),
      updateProductLine: (id, key, value) => set((state) => ({ finance: { ...state.finance, productLines: state.finance.productLines.map((line) => line.id === id ? { ...line, [key]: value } : line) } })),
      updateProductCostSource: (id, value) => set((state) => ({ finance: { ...state.finance, bomCostSource: { ...(state.finance.bomCostSource ?? {}), [id]: value } } })),
      updateProductBomTier: (id, value) => set((state) => ({ finance: { ...state.finance, bomTierByProduct: { ...(state.finance.bomTierByProduct ?? {}), [id]: value } } })),
      updateBomLine: (item, tier, field, value) => set((state) => ({ finance: { ...state.finance, bomOverrides: { ...(state.finance.bomOverrides ?? {}), [item]: { ...(state.finance.bomOverrides?.[item] ?? {}), [tier]: { ...(state.finance.bomOverrides?.[item]?.[tier] ?? {}), [field]: value } } } } })),
      updateAluminiumVertical: (key, value) => set((state) => ({ finance: { ...state.finance, aluminiumVertical: { ...state.finance.aluminiumVertical, [key]: value } } })),
      updateAccounting: (key, value) => set((state) => ({ accounting: { ...state.accounting, [key]: value } })),
      setFundingType: (month, value) => set((state) => ({ accounting: { ...state.accounting, fundingTypeByMonth: { ...(state.accounting.fundingTypeByMonth ?? {}), [month]: value } } })),
      updateEquipmentItem: (id, key, value) => set((state) => ({ finance: { ...state.finance, equipmentLedger: (state.finance.equipmentLedger ?? DEFAULT_EQUIPMENT_LEDGER).map((item) => item.id === id ? { ...item, [key]: value } : item) } })),
      addEquipmentCategory: (ledger, name, description = "") => set((state) => ({ finance: { ...state.finance, equipmentLedgerCategories: [...(state.finance.equipmentLedgerCategories ?? DEFAULT_EQUIPMENT_LEDGER_CATEGORIES), { id: newId("category"), ledger, name: name.trim() || "New category", description, sortOrder: (state.finance.equipmentLedgerCategories ?? []).filter((c) => c.ledger === ledger).length } as EquipmentLedgerCategory] } })),
      updateEquipmentCategory: (id, key, value) => set((state) => ({ finance: { ...state.finance, equipmentLedgerCategories: (state.finance.equipmentLedgerCategories ?? DEFAULT_EQUIPMENT_LEDGER_CATEGORIES).map((category) => category.id === id ? { ...category, [key]: value } : category) } })),
      addEquipmentItem: (ledger, categoryId, name) => set((state) => ({ finance: { ...state.finance, equipmentLedger: [...(state.finance.equipmentLedger ?? DEFAULT_EQUIPMENT_LEDGER), { id: newId("equipment"), name: name.trim() || "New item", ledger, category: (state.finance.equipmentLedgerCategories ?? DEFAULT_EQUIPMENT_LEDGER_CATEGORIES).find((c) => c.id === categoryId)?.name ?? "Other", categoryId, details: "", costLakh: 0, monthlyCostLakh: 0, purchaseMonth: 1, usefulLifeMonths: 60, allocationPct: 100 } as EquipmentLedgerItem] } })),
      addMasterLedgerRow: (row) => set((state) => ({ masterLedgerRows: [...state.masterLedgerRows, { ...row, id: newId("ledger-row"), issues: [] }] })),
      issueMasterLedger: (ledgerId, quantity, date) => set((state) => {
        let remaining = Math.max(0, quantity);
        const issueAmounts = new Map<string, number>();
        state.masterLedgerRows.filter((row) => row.ledgerId === ledgerId).sort((a, b) => (a.purchaseDate || "9999-12-31").localeCompare(b.purchaseDate || "9999-12-31")).forEach((row) => {
          if (remaining <= 0) return;
          const used = Math.min(Math.max(0, row.quantity - row.issues.reduce((sum, issue) => sum + issue.quantity, 0)), remaining);
          if (used > 0) {
            issueAmounts.set(row.id, used);
            remaining -= used;
          }
        });
        const rows = state.masterLedgerRows.map((row) => {
          const used = issueAmounts.get(row.id) ?? 0;
          return used > 0 ? { ...row, issues: [...row.issues, { id: newId("issue"), quantity: used, date }] } : row;
        });
        return { masterLedgerRows: rows };
      }),
      resetFinance: () => set({ finance: withEquipmentDefaults(DEFAULT_FINANCE_ASSUMPTIONS), accounting: DEFAULT_ACCOUNTING_ASSUMPTIONS }),
    }),
    {
      name: "veloxis-planning-state",
      partialize: (state) => ({ scenario: state.scenario, drawStandby: state.drawStandby, actions: state.actions, finance: state.finance, accounting: state.accounting, masterLedgerRows: state.masterLedgerRows }),
      onRehydrateStorage: () => (state) => { if (state) state.setFinance(withEquipmentDefaults(state.finance)); },
    },
  ),
);
