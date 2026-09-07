import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { CommandShell } from "@/components/command-shell";
import { getCommandAccess, getCommandRole } from "@/lib/command-access";
import {
  DEFAULT_FINANCE_ASSUMPTIONS,
  DEFAULT_PRODUCT_LINES,
  PLAN_PRODUCT_BY_FINANCE_ID,
} from "@/lib/finance/model";
import { canAccessRoute } from "@/lib/page-access";
import { getRouteMeta } from "@/lib/page-metadata";
import { useVeloxis } from "@/lib/store";
import {
  DEFAULT_APPROVED_OPERATING_PLAN,
  type OperatingPlan,
} from "@/lib/planning/operating-plan";
import { getPublishedOperatingPlan } from "@/lib/planning/planning-control";

type OperatingPlanLoaderData = {
  plan: OperatingPlan;
  revisionNo: number | null;
};

export const Route = createFileRoute("/command")({
  beforeLoad: async ({ location }) => {
    const access = await getCommandAccess();
    if (!access) {
      throw redirect({ to: "/command-login" });
    }
    const role = await getCommandRole();
    if (!canAccessRoute(role, location.pathname)) {
      const page = getRouteMeta(location.pathname);
      throw redirect({
        to: page?.adminOnly && page.domain === "inventory" ? "/command/inventory" : "/command",
      });
    }
  },
  loader: async (): Promise<OperatingPlanLoaderData> => {
    try {
      const published = await getPublishedOperatingPlan();
      return { plan: published.plan, revisionNo: published.record?.revisionNo ?? null };
    } catch {
      // Fresh environments can render safely before migration 0023 is applied.
      return { plan: DEFAULT_APPROVED_OPERATING_PLAN, revisionNo: null };
    }
  },
  component: CommandRouteShell,
});

function CommandRouteShell() {
  const { plan } = Route.useLoaderData();

  useEffect(() => {
    const state = useVeloxis.getState();
    const savedById = new Map(state.finance.productLines.map((line) => [line.id, line]));
    const canonicalProductLines = DEFAULT_PRODUCT_LINES.map((canonical) => {
      const saved = savedById.get(canonical.id);
      return {
        ...canonical,
        // Preserve user-entered economics while replacing legacy commercial labels/timing.
        aspLakh: saved?.aspLakh ?? canonical.aspLakh,
        cogsLakh: saved?.cogsLakh ?? canonical.cogsLakh,
        mixPct: saved?.mixPct ?? canonical.mixPct,
        launchMonth: plan.productLaunchMonths[PLAN_PRODUCT_BY_FINANCE_ID[canonical.id]],
      };
    });

    state.setFinance({
      ...state.finance,
      productLines: canonicalProductLines,
      // These persisted fields belonged to the legacy product model. Canonical demand and launch
      // now come from the published Operating Plan, so stale local values cannot re-enter forecasts.
      unitMultiplier: 1,
      aluminiumVertical: {
        ...DEFAULT_FINANCE_ASSUMPTIONS.aluminiumVertical,
        inventoryCover: 1,
      },
      operatingPlan: plan,
    });
  }, [plan]);

  return <CommandShell />;
}
