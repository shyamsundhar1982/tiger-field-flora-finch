import { useEffect } from "react";
import { getOperatingPlanState, saveOperatingPlanDraft } from "@/lib/operating-plan-authority";
import { listOperatingActionStatus, saveOperatingActionStatus } from "@/lib/operating-action-authority";
import { useVeloxis } from "@/lib/store";

const planSnapshot = (state: ReturnType<typeof useVeloxis.getState>) => ({
  scenario: state.scenario,
  drawStandby: state.drawStandby,
  horizonMonths: 36 as const,
  finance: state.finance,
  accounting: state.accounting,
  changeReason: "",
});

/** Browser Zustand is an editing cache. Server revisions remain business truth. */
export function useOperatingPlanSync() {
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    let planTimer: ReturnType<typeof setTimeout> | undefined;
    let lastPlan = "";
    let lastActions: Record<string, "open" | "doing" | "done"> = {};

    void (async () => {
      const [authority, actionStatus] = await Promise.all([
        getOperatingPlanState(),
        listOperatingActionStatus(),
      ]);
      if (!active) return;

      const source = authority.draft ?? authority.approved;
      const current = useVeloxis.getState();
      useVeloxis.setState({
        ...(source
          ? {
              scenario: source.scenario,
              drawStandby: source.drawStandby,
              finance: source.finance,
              accounting: source.accounting,
            }
          : {}),
        actions: { ...current.actions, ...actionStatus },
      });

      if (!source) {
        await saveOperatingPlanDraft({ data: planSnapshot(useVeloxis.getState()) });
      }

      lastPlan = JSON.stringify(planSnapshot(useVeloxis.getState()));
      lastActions = { ...useVeloxis.getState().actions };

      unsubscribe = useVeloxis.subscribe((state) => {
        const nextPlan = planSnapshot(state);
        const serialized = JSON.stringify(nextPlan);
        if (serialized !== lastPlan) {
          lastPlan = serialized;
          if (planTimer) clearTimeout(planTimer);
          planTimer = setTimeout(() => {
            void saveOperatingPlanDraft({ data: nextPlan }).catch((error) => {
              console.error("[operating-plan] central draft sync failed", error);
            });
          }, 600);
        }

        for (const [actionId, status] of Object.entries(state.actions)) {
          if (lastActions[actionId] === status) continue;
          lastActions[actionId] = status;
          void saveOperatingActionStatus({ data: { actionId, status } }).catch((error) => {
            console.error(`[operating-action] ${actionId} sync failed`, error);
          });
        }
      });
    })().catch((error) => {
      console.error("[operating-plan] authority hydration failed", error);
    });

    return () => {
      active = false;
      if (planTimer) clearTimeout(planTimer);
      unsubscribe?.();
    };
  }, []);
}
