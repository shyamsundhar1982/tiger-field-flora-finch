import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FinanceAssumptions, ProductLineId, ScenarioId } from "@/lib/finance/model";
import { DEFAULT_FINANCE_ASSUMPTIONS } from "@/lib/finance/model";
import { DEFAULT_ACCOUNTING_ASSUMPTIONS, type AccountingAssumptions, type FundingType } from "@/lib/finance/accounting";
import type { BomCostSource, BomTier } from "@/lib/finance/bom-engine";
import type { CompanyOpex, PeopleRole } from "@/lib/finance/people-opex-engine";
import { ACTIONS } from "@/lib/data/actions";

type ActionState = Record<string, "open" | "doing" | "done">;
type NumericAccountingKey = Exclude<keyof AccountingAssumptions, "fundingTypeByMonth">;
const initialActions: ActionState = Object.fromEntries(ACTIONS.map((a) => [a.id, "open"]));

type Store = {
  scenario: ScenarioId; drawStandby: boolean; actions: ActionState; finance: FinanceAssumptions; accounting: AccountingAssumptions;
  setScenario: (s: ScenarioId) => void; setDrawStandby: (v: boolean) => void; setAction: (id: string, s: "open" | "doing" | "done") => void; setFinance: (finance: FinanceAssumptions) => void;
  updateGlobalFinance: (key: keyof Omit<FinanceAssumptions, "productLines" | "aluminiumVertical" | "bomOverrides" | "bomCostSource" | "bomTierByProduct" | "peopleOpex">, value: number) => void;
  updateProductLine: (id: ProductLineId, key: "aspLakh" | "cogsLakh" | "mixPct" | "launchMonth", value: number) => void;
  updateProductCostSource: (id: ProductLineId, value: BomCostSource) => void; updateProductBomTier: (id: ProductLineId, value: BomTier) => void; updateBomLine: (item: string, tier: BomTier, field: "quantity" | "unitCostInr", value: number) => void;
  updateAluminiumVertical: (key: keyof FinanceAssumptions["aluminiumVertical"], value: number) => void;
  updatePeopleRole: (id: string, key: keyof Omit<PeopleRole, "id" | "role" | "department">, value: number) => void;
  updateCompanyOpex: (id: string, key: keyof Omit<CompanyOpex, "id" | "category">, value: number) => void;
  updatePeopleOpexMultiplier: (value: number) => void;
  updateAccounting: (key: NumericAccountingKey, value: number) => void; setFundingType: (month: number, value: FundingType) => void; resetFinance: () => void;
};

export const useVeloxis = create<Store>()(persist((set) => ({
  scenario: "base", drawStandby: true, actions: initialActions, finance: DEFAULT_FINANCE_ASSUMPTIONS, accounting: DEFAULT_ACCOUNTING_ASSUMPTIONS,
  setScenario: (scenario) => set({ scenario }), setDrawStandby: (drawStandby) => set({ drawStandby }), setAction: (id, status) => set((state) => ({ actions: { ...state.actions, [id]: status } })), setFinance: (finance) => set({ finance }),
  updateGlobalFinance: (key, value) => set((state) => ({ finance: { ...state.finance, [key]: value } })),
  updateProductLine: (id, key, value) => set((state) => ({ finance: { ...state.finance, productLines: state.finance.productLines.map((line) => line.id === id ? { ...line, [key]: value } : line) } })),
  updateProductCostSource: (id, value) => set((state) => ({ finance: { ...state.finance, bomCostSource: { ...(state.finance.bomCostSource ?? {}), [id]: value } } })), updateProductBomTier: (id, value) => set((state) => ({ finance: { ...state.finance, bomTierByProduct: { ...(state.finance.bomTierByProduct ?? {}), [id]: value } } })),
  updateBomLine: (item, tier, field, value) => set((state) => ({ finance: { ...state.finance, bomOverrides: { ...(state.finance.bomOverrides ?? {}), [item]: { ...(state.finance.bomOverrides?.[item] ?? {}), [tier]: { ...(state.finance.bomOverrides?.[item]?.[tier] ?? {}), [field]: value } } } } })),
  updateAluminiumVertical: (key, value) => set((state) => ({ finance: { ...state.finance, aluminiumVertical: { ...state.finance.aluminiumVertical, [key]: value } } })),
  updatePeopleRole: (id, key, value) => set((state) => ({ finance: { ...state.finance, peopleOpex: { ...(state.finance.peopleOpex ?? DEFAULT_FINANCE_ASSUMPTIONS.peopleOpex!), people: (state.finance.peopleOpex ?? DEFAULT_FINANCE_ASSUMPTIONS.peopleOpex!).people.map((p) => p.id === id ? { ...p, [key]: value } : p) } } })),
  updateCompanyOpex: (id, key, value) => set((state) => ({ finance: { ...state.finance, peopleOpex: { ...(state.finance.peopleOpex ?? DEFAULT_FINANCE_ASSUMPTIONS.peopleOpex!), companyOpex: (state.finance.peopleOpex ?? DEFAULT_FINANCE_ASSUMPTIONS.peopleOpex!).companyOpex.map((c) => c.id === id ? { ...c, [key]: value } : c) } } })),
  updatePeopleOpexMultiplier: (value) => set((state) => ({ finance: { ...state.finance, peopleOpex: { ...(state.finance.peopleOpex ?? DEFAULT_FINANCE_ASSUMPTIONS.peopleOpex!), opexMultiplier: value } } })),
  updateAccounting: (key, value) => set((state) => ({ accounting: { ...state.accounting, [key]: value } })), setFundingType: (month, value) => set((state) => ({ accounting: { ...state.accounting, fundingTypeByMonth: { ...(state.accounting.fundingTypeByMonth ?? {}), [month]: value } } })), resetFinance: () => set({ finance: DEFAULT_FINANCE_ASSUMPTIONS, accounting: DEFAULT_ACCOUNTING_ASSUMPTIONS }),
}), { name: "veloxis-planning-state", partialize: (state) => ({ scenario: state.scenario, drawStandby: state.drawStandby, actions: state.actions, finance: state.finance, accounting: state.accounting }) }));
