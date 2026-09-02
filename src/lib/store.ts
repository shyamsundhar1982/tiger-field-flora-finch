import { create } from "zustand";
import type { ScenarioId } from "@/lib/finance/model";
import { ACTIONS } from "@/lib/data/actions";

type ActionState = Record<string, "open" | "doing" | "done">;

const initialActions: ActionState = Object.fromEntries(ACTIONS.map((a) => [a.id, "open"]));

type Store = {
  scenario: ScenarioId;
  drawStandby: boolean;
  actions: ActionState;
  setScenario: (s: ScenarioId) => void;
  setDrawStandby: (v: boolean) => void;
  setAction: (id: string, s: "open" | "doing" | "done") => void;
};

export const useVeloxis = create<Store>((set) => ({
  scenario: "base",
  drawStandby: true,
  actions: initialActions,
  setScenario: (scenario) => set({ scenario }),
  setDrawStandby: (drawStandby) => set({ drawStandby }),
  setAction: (id, s) => set((st) => ({ actions: { ...st.actions, [id]: s } })),
}));
