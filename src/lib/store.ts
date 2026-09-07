import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FinanceAssumptions, ProductLineId, ScenarioId } from "@/lib/finance/model";
import { DEFAULT_FINANCE_ASSUMPTIONS } from "@/lib/finance/model";
import {
  DEFAULT_ACCOUNTING_ASSUMPTIONS,
  type AccountingAssumptions,
  type FundingType,
} from "@/lib/finance/accounting";
import type {
  EquipmentLedgerId,
  EquipmentLedgerItem,
  EquipmentLedgerCategory,
} from "@/lib/finance/equipment-ledger";
import {
  DEFAULT_EQUIPMENT_LEDGER,
  DEFAULT_EQUIPMENT_LEDGER_CATEGORIES,
} from "@/lib/finance/equipment-ledger";
import type { BomCostSource, BomTier } from "@/lib/finance/bom-engine";
import { ACTIONS } from "@/lib/data/actions";
import { SEED_INVENTORY } from "@/lib/data/inventory";
import { fifoIssue, mergeLedgerDefaults, type MasterLedgerRow } from "@/lib/master-ledger";

type ActionState = Record<string, "open" | "doing" | "done">;
type NumericAccountingKey = Exclude<keyof AccountingAssumptions, "fundingTypeByMonth">;
type EquipmentEditableKey = Exclude<keyof EquipmentLedgerItem, "id">;
const initialActions: ActionState = Object.fromEntries(ACTIONS.map((a) => [a.id, "open"]));

function withEquipmentDefaults(finance: FinanceAssumptions): FinanceAssumptions {
  return {
    ...finance,
    equipmentLedger: finance.equipmentLedger ?? DEFAULT_EQUIPMENT_LEDGER,
    equipmentLedgerCategories:
      finance.equipmentLedgerCategories ?? DEFAULT_EQUIPMENT_LEDGER_CATEGORIES,
  };
}

const newId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const SUPPORT_LEDGER_BY_EQUIPMENT: Record<EquipmentLedgerId, MasterLedgerRow["ledgerId"]> = {
  manufacturing: "tooling",
  qualitySupport: "quality",
  officeAdmin: "stores-tools",
  deadIdle: "stores-tools",
  consumables: "stores-tools",
};
const EQUIPMENT_MASTER_LEDGER_ROWS: MasterLedgerRow[] = DEFAULT_EQUIPMENT_LEDGER.map((item) => ({
  id: `seed-${item.id}`,
  ledgerId: SUPPORT_LEDGER_BY_EQUIPMENT[item.ledger],
  serialNo: item.id.toUpperCase(),
  description: item.name,
  category: item.category,
  unit: "ea",
  purchasePrice: Math.max(0, item.costLakh) * 100000,
  purchaseDate: "",
  expiryDate: "",
  nextInspectionDate: "",
  quantity: 1,
  mslLevel: 0,
  plannedMonthlyUse: 0,
  source: "equipment-register",
  issues: [],
}));

const COMPONENT_MASTER_LEDGER_ROWS: MasterLedgerRow[] = SEED_INVENTORY.map((item) => ({
  id: `component-${item.id}`,
  ledgerId: "components",
  serialNo: item.sku,
  description: `${item.brand} · ${item.model}`,
  category: item.category,
  unit: "ea",
  purchasePrice: Math.max(0, item.priceInr),
  purchaseDate: "",
  expiryDate: "",
  nextInspectionDate: "",
  quantity: Math.max(0, item.stockQty),
  mslLevel: Math.max(0, item.reorderLevel),
  plannedMonthlyUse: 0,
  source: "component-catalogue",
  issues: [],
}));

export const INITIAL_MASTER_LEDGER_ROWS: MasterLedgerRow[] = [
  ...COMPONENT_MASTER_LEDGER_ROWS,
  ...EQUIPMENT_MASTER_LEDGER_ROWS,
];

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
  updateGlobalFinance: (
    key: keyof Omit<
      FinanceAssumptions,
      | "productLines"
      | "aluminiumVertical"
      | "bomOverrides"
      | "bomCostSource"
      | "bomTierByProduct"
      | "equipmentLedger"
      | "equipmentLedgerCategories"
    >,
    value: number,
  ) => void;
  updateProductLine: (
    id: ProductLineId,
    key: "aspLakh" | "cogsLakh" | "mixPct" | "launchMonth",
    value: number,
  ) => void;
  updateProductCostSource: (id: ProductLineId, value: BomCostSource) => void;
  updateProductBomTier: (id: ProductLineId, value: BomTier) => void;
  updateBomLine: (
    item: string,
    tier: BomTier,
    field: "quantity" | "unitCostInr",
    value: number,
  ) => void;
  updateAluminiumVertical: (
    key: keyof FinanceAssumptions["aluminiumVertical"],
    value: number,
  ) => void;
  updateAccounting: (key: NumericAccountingKey, value: number) => void;
  setFundingType: (month: number, value: FundingType) => void;
  updateEquipmentItem: (
    id: string,
    key: EquipmentEditableKey,
    value: string | number | EquipmentLedgerId,
  ) => void;
  addEquipmentCategory: (ledger: EquipmentLedgerId, name: string, description?: string) => void;
  updateEquipmentCategory: (id: string, key: "name" | "description", value: string) => void;
  addEquipmentItem: (ledger: EquipmentLedgerId, categoryId: string, name: string) => void;
  saveMasterLedgerEntry: (row: Omit<MasterLedgerRow, "id" | "issues">) => void;
  issueMasterLedger: (
    ledgerId: MasterLedgerRow["ledgerId"],
    sku: string,
    quantity: number,
    date: string,
  ) => void;
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
      updateGlobalFinance: (key, value) =>
        set((state) => ({ finance: { ...state.finance, [key]: value } })),
      updateProductLine: (id, key, value) =>
        set((state) => ({
          finance: {
            ...state.finance,
            productLines: state.finance.productLines.map((line) =>
              line.id === id ? { ...line, [key]: value } : line,
            ),
          },
        })),
      updateProductCostSource: (id, value) =>
        set((state) => ({
          finance: {
            ...state.finance,
            bomCostSource: { ...(state.finance.bomCostSource ?? {}), [id]: value },
          },
        })),
      updateProductBomTier: (id, value) =>
        set((state) => ({
          finance: {
            ...state.finance,
            bomTierByProduct: { ...(state.finance.bomTierByProduct ?? {}), [id]: value },
          },
        })),
      updateBomLine: (item, tier, field, value) =>
        set((state) => ({
          finance: {
            ...state.finance,
            bomOverrides: {
              ...(state.finance.bomOverrides ?? {}),
              [item]: {
                ...(state.finance.bomOverrides?.[item] ?? {}),
                [tier]: { ...(state.finance.bomOverrides?.[item]?.[tier] ?? {}), [field]: value },
              },
            },
          },
        })),
      updateAluminiumVertical: (key, value) =>
        set((state) => ({
          finance: {
            ...state.finance,
            aluminiumVertical: { ...state.finance.aluminiumVertical, [key]: value },
          },
        })),
      updateAccounting: (key, value) =>
        set((state) => ({ accounting: { ...state.accounting, [key]: value } })),
      setFundingType: (month, value) =>
        set((state) => ({
          accounting: {
            ...state.accounting,
            fundingTypeByMonth: { ...(state.accounting.fundingTypeByMonth ?? {}), [month]: value },
          },
        })),
      updateEquipmentItem: (id, key, value) =>
        set((state) => ({
          finance: {
            ...state.finance,
            equipmentLedger: (state.finance.equipmentLedger ?? DEFAULT_EQUIPMENT_LEDGER).map(
              (item) => (item.id === id ? { ...item, [key]: value } : item),
            ),
          },
        })),
      addEquipmentCategory: (ledger, name, description = "") =>
        set((state) => ({
          finance: {
            ...state.finance,
            equipmentLedgerCategories: [
              ...(state.finance.equipmentLedgerCategories ?? DEFAULT_EQUIPMENT_LEDGER_CATEGORIES),
              {
                id: newId("category"),
                ledger,
                name: name.trim() || "New category",
                description,
                sortOrder: (state.finance.equipmentLedgerCategories ?? []).filter(
                  (c) => c.ledger === ledger,
                ).length,
              } as EquipmentLedgerCategory,
            ],
          },
        })),
      updateEquipmentCategory: (id, key, value) =>
        set((state) => ({
          finance: {
            ...state.finance,
            equipmentLedgerCategories: (
              state.finance.equipmentLedgerCategories ?? DEFAULT_EQUIPMENT_LEDGER_CATEGORIES
            ).map((category) => (category.id === id ? { ...category, [key]: value } : category)),
          },
        })),
      addEquipmentItem: (ledger, categoryId, name) =>
        set((state) => ({
          finance: {
            ...state.finance,
            equipmentLedger: [
              ...(state.finance.equipmentLedger ?? DEFAULT_EQUIPMENT_LEDGER),
              {
                id: newId("equipment"),
                name: name.trim() || "New item",
                ledger,
                category:
                  (
                    state.finance.equipmentLedgerCategories ?? DEFAULT_EQUIPMENT_LEDGER_CATEGORIES
                  ).find((c) => c.id === categoryId)?.name ?? "Other",
                categoryId,
                details: "",
                costLakh: 0,
                monthlyCostLakh: 0,
                purchaseMonth: 1,
                usefulLifeMonths: 60,
                allocationPct: 100,
              } as EquipmentLedgerItem,
            ],
          },
        })),
      saveMasterLedgerEntry: (entry) =>
        set((state) => {
          const sku = entry.serialNo.trim().toLocaleUpperCase();
          const matchesItem = (row: MasterLedgerRow) =>
            row.ledgerId === entry.ledgerId && row.serialNo.trim().toLocaleUpperCase() === sku;
          const controlledRows = state.masterLedgerRows.map((row) =>
            matchesItem(row)
              ? {
                  ...row,
                  description: entry.description,
                  category: entry.category,
                  unit: entry.unit,
                  mslLevel: Math.max(0, entry.mslLevel),
                  plannedMonthlyUse: Math.max(0, entry.plannedMonthlyUse ?? 0),
                }
              : row,
          );
          if (entry.quantity <= 0 && controlledRows.some(matchesItem))
            return { masterLedgerRows: controlledRows };
          return {
            masterLedgerRows: [
              ...controlledRows,
              { ...entry, serialNo: sku, id: newId("ledger-row"), issues: [] },
            ],
          };
        }),
      issueMasterLedger: (ledgerId, sku, quantity, date) =>
        set((state) => ({
          masterLedgerRows: fifoIssue(
            state.masterLedgerRows,
            ledgerId,
            sku,
            quantity,
            date,
            newId("issue"),
          ),
        })),
      resetFinance: () =>
        set({
          finance: withEquipmentDefaults(DEFAULT_FINANCE_ASSUMPTIONS),
          accounting: DEFAULT_ACCOUNTING_ASSUMPTIONS,
        }),
    }),
    {
      name: "veloxis-planning-state",
      partialize: (state) => ({
        scenario: state.scenario,
        drawStandby: state.drawStandby,
        actions: state.actions,
        finance: state.finance,
        accounting: state.accounting,
        masterLedgerRows: state.masterLedgerRows,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<Store>;
        return {
          ...current,
          ...saved,
          finance: withEquipmentDefaults(saved.finance ?? current.finance),
          masterLedgerRows: mergeLedgerDefaults(
            saved.masterLedgerRows ?? [],
            INITIAL_MASTER_LEDGER_ROWS,
          ),
        };
      },
    },
  ),
);
