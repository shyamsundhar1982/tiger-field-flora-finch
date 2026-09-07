import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { PlanningStudio } from "@/components/planning-studio";
import { COMPANY, TRANCHES } from "@/lib/data/company";
import { getCommandRole } from "@/lib/command-access";
import { canAccessRoute } from "@/lib/page-access";
import { resolveFounderActions } from "@/lib/data/founder-command";
import { useVeloxis } from "@/lib/store";
import {
  DECISION_PACKETS,
  DECISION_STATE_LABELS,
  decisionPriorityRank,
} from "@/lib/data/decision-engine";
import {
  DEFAULT_APPROVED_OPERATING_PLAN,
  MILESTONE_DEFINITIONS,
  calendarMonthForPlanMonth,
  fundingGateMonth,
  operatingPlanHorizonLabel,
  type OperatingPlanMilestoneId,
} from "@/lib/planning/operating-plan";

export const Route = createFileRoute("/command/planning")({
  loader: () => getCommandRole(),
  component: MasterPlan,
});

type PlanTab = { label: string; note: string; to: string };
const PLAN_TABS: PlanTab[] = [
  { label: "Roadmap", note: "Rolling 36-month integrated plan", to: "/command/planning" },
  { label: "Demand", note: "Demand and order-book plan", to: "/command/sales" },
  { label: "Procurement", note: "Requirements, MSL and lead time", to: "/command/procurement-planning" },
  { label: "Production", note: "Volume, mix and capacity", to: "/command/production" },
  { label: "Finance", note: "Financial assumptions and cash", to: "/command/finance-assumptions" },
  { label: "Scenarios", note: "Base, delayed and stress views", to: "/command/scenarios" },
];

const ROADMAP_ORDER: OperatingPlanMilestoneId[] = [
  "foundation",
  "engineeringBaseline",
  "prototypeValidation",
  "toolingPilot",
  "commercialLaunch",
];

function statusClass(status: string) {
  if (status === "Blocked") return "border-danger/30 bg-danger/10 text-danger";
  if (status === "Complete") return "border-ok/30 bg-ok/10 text-ok";
  if (status === "Current control") return "border-green/30 bg-green/10 text-green";
  if (status === "Gate") return "border-accent/30 bg-accent/10 text-accent";
  return "border-border bg-bg-elevated/40 text-muted";
}

function MasterPlan() {
  const role = Route.useLoaderData();
  const actions = useVeloxis((state) => state.actions);
  const finance = useVeloxis((state) => state.finance);
  const plan = finance.operatingPlan ?? DEFAULT_APPROVED_OPERATING_PLAN;
  const founderActions = resolveFounderActions(actions);
  const accessible = (to: string) => canAccessRoute(role, to);
  const planTabs = PLAN_TABS.filter((tab) => accessible(tab.to));
  const visibleDecisions = DECISION_PACKETS.filter((packet) => accessible(packet.source));
  const attention = [...visibleDecisions]
    .filter(
      (packet) =>
        packet.state === "blocked" || packet.state === "approval" || packet.priority === "critical",
    )
    .sort((left, right) => decisionPriorityRank[left.priority] - decisionPriorityRank[right.priority])
    .slice(0, 4);
  const blockedCount = visibleDecisions.filter((packet) => packet.state === "blocked").length;
  const criticalCount = visibleDecisions.filter((packet) => packet.priority === "critical").length;
  const capitalLadder = TRANCHES.filter((tranche) => tranche.id !== "STBY").reduce(
    (sum, tranche) => sum + tranche.amount,
    0,
  );

  const roadmap = ROADMAP_ORDER.map((milestoneId, index) => {
    const definition = MILESTONE_DEFINITIONS[milestoneId];
    const milestoneMonth = plan.milestoneMonths[milestoneId];
    const relatedActions = founderActions.filter((action) =>
      definition.actionIds.some((id) => id === action.id),
    );
    let status = index === 0 ? "Current control" : index === ROADMAP_ORDER.length - 1 ? "Gate" : "Planned";
    if (relatedActions.length && relatedActions.every((action) => action.status === "complete")) status = "Complete";
    else if (relatedActions.some((action) => action.status === "blocked")) status = "Blocked";
    else if (relatedActions.some((action) => action.status === "active")) status = "Current control";
    return { milestoneId, definition, milestoneMonth, status };
  });

  const quarters = Array.from({ length: 12 }, (_, index) => {
    const start = index * 3 + 1;
    const end = start + 2;
    const gates = TRANCHES.map((tranche) => ({
      ...tranche,
      effectiveMonth: fundingGateMonth(plan, tranche.id, "base"),
    })).filter((tranche) => tranche.effectiveMonth >= start && tranche.effectiveMonth <= end);
    return { quarter: `Q${index + 1}`, months: `M${start}–M${end}`, gates };
  });

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">
            Planning · canonical rolling operating plan
          </p>
          <h1 className="mt-1 font-display text-4xl text-accent">Master Plan</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            One approved rolling 36-month planning surface for {COMPANY.brand}. Working scenarios can be
            edited and simulated here, but only an Admin-approved publication changes the operating plan used
            by Finance, Commercial and Supply.
          </p>
        </div>
        <Link
          to="/command"
          className="w-fit rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-fg"
        >
          Command Centre →
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Planning status">
        <Kpi label="Rolling horizon" value="36 months" hint={operatingPlanHorizonLabel(plan)} />
        <Kpi
          label="Approved launch"
          value={`M${plan.milestoneMonths.commercialLaunch}`}
          hint={calendarMonthForPlanMonth(plan, plan.milestoneMonths.commercialLaunch)}
        />
        <Kpi
          label="Critical decisions"
          value={String(criticalCount)}
          hint="Decision-grade exceptions only"
          tone={criticalCount ? "warn" : "ok"}
        />
        <Kpi
          label="Strategic capital envelope"
          value={`₹${capitalLadder}L`}
          hint={`${blockedCount} blocked operating item${blockedCount === 1 ? "" : "s"}`}
        />
      </section>

      <nav
        className="overflow-x-auto rounded-xl border border-border bg-surface/40 p-1 [scrollbar-width:thin]"
        aria-label="Master Plan sections"
      >
        <div className="flex min-w-max gap-1">
          {planTabs.map((tab) => (
            <Link
              key={tab.label}
              to={tab.to as never}
              title={tab.note}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                tab.to === "/command/planning"
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:bg-bg/60 hover:text-fg"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>

      <PlanningStudio role={role} />

      <Panel title="Needs attention" kicker="Exceptions only · no duplicate dashboard noise">
        {attention.length ? (
          <div className="divide-y divide-border rounded-xl border border-border">
            {attention.map((packet) => (
              <div
                key={packet.id}
                className="grid gap-3 p-4 lg:grid-cols-[120px_1fr_180px_auto] lg:items-center"
              >
                <div>
                  <span
                    className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                      packet.state === "blocked"
                        ? "border-danger/30 bg-danger/10 text-danger"
                        : packet.state === "approval"
                          ? "border-accent/30 bg-accent/10 text-accent"
                          : "border-green/30 bg-green/10 text-green"
                    }`}
                  >
                    {DECISION_STATE_LABELS[packet.state]}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-fg">{packet.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{packet.nextAction}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-green">Owner</p>
                  <p className="mt-1 text-xs text-fg">{packet.owner}</p>
                </div>
                <Link
                  to={packet.source as never}
                  className="w-fit rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-fg"
                >
                  Open evidence →
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No critical planning exception is currently raised.</p>
        )}
      </Panel>

      <Panel title="Approved milestones" kicker="Published timing · owner · dependency · evidence">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="border-b border-border bg-bg-elevated/60 text-[10px] uppercase tracking-[0.13em] text-subtle">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Calendar</th>
                <th className="px-4 py-3">Milestone</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Dependency</th>
                <th className="px-4 py-3">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roadmap.map((row) => (
                <tr key={row.milestoneId} className="bg-surface/20 transition-colors hover:bg-surface/50">
                  <td className="px-4 py-3 font-semibold text-accent">M{row.milestoneMonth}</td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {calendarMonthForPlanMonth(plan, row.milestoneMonth)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-fg">{row.definition.phase}</td>
                  <td className="px-4 py-3 text-muted">{row.definition.owner}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs leading-5 text-muted">{row.definition.dependency}</td>
                  <td className="px-4 py-3">
                    {accessible(row.definition.route) ? (
                      <Link
                        to={row.definition.route as never}
                        className="text-xs font-semibold text-fg hover:text-accent"
                      >
                        {row.definition.evidence} →
                      </Link>
                    ) : (
                      <span className="text-xs text-subtle">{row.definition.evidence}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <details className="rounded-xl border border-border bg-surface/25 p-5 sm:p-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-green">
              Quarter view · published M1–M36
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-accent">36-month funding timeline</h2>
          </div>
          <span className="shrink-0 text-xs font-semibold text-muted">12 quarters · expand</span>
        </summary>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {quarters.map((quarter) => (
            <div key={quarter.quarter} className="rounded-xl border border-border bg-surface/25 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-fg">{quarter.quarter}</p>
                <span className="text-[10px] text-subtle">{quarter.months}</span>
              </div>
              {quarter.gates.length ? (
                <div className="mt-3 space-y-2">
                  {quarter.gates.map((gate) => (
                    <div key={gate.id} className="rounded-lg border border-accent/20 bg-accent/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-accent">{gate.id}</span>
                        <span className="text-xs font-semibold text-fg">₹{gate.amount}L</span>
                      </div>
                      <p className="mt-1 text-[10px] leading-4 text-muted">
                        M{gate.effectiveMonth} · {gate.name}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted">Execution period. No scheduled capital envelope gate.</p>
              )}
            </div>
          ))}
        </div>
      </details>

      <details className="rounded-xl border border-border bg-surface/20 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-accent">Help & methodology</summary>
        <div className="mt-3 grid gap-3 text-xs leading-5 text-muted md:grid-cols-2">
          <p>
            <span className="font-semibold text-green">Plan:</span> the Admin-approved version used as the
            canonical operating intent.
          </p>
          <p>
            <span className="font-semibold text-green">Forecast:</span> the calculated outcome produced by
            demand, product mix, BOM/cost, cash and the approved timeline.
          </p>
          <p>
            <span className="font-semibold text-green">Scenario:</span> an editable what-if case that cannot
            change operations until submitted, approved and published.
          </p>
          <p>
            <span className="font-semibold text-green">Actual:</span> real orders, receipts, inventory issues,
            job cards, collections and accounting transactions remain in operating workspaces.
          </p>
        </div>
      </details>
    </main>
  );
}
