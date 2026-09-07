import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { COMPANY, TRANCHES } from "@/lib/data/company";
import { getCommandRole } from "@/lib/command-access";
import { canAccessRoute } from "@/lib/page-access";
import { resolveFounderActions } from "@/lib/data/founder-command";
import { useVeloxis } from "@/lib/store";
import { DECISION_PACKETS, DECISION_STATE_LABELS, decisionPriorityRank } from "@/lib/data/decision-engine";

export const Route = createFileRoute("/command/planning")({
  loader: () => getCommandRole(),
  component: MasterPlan,
});

type PlanTab = { label: string; note: string; to: string };
const PLAN_TABS: PlanTab[] = [
  { label: "Roadmap", note: "36-month integrated plan", to: "/command/planning" },
  { label: "Demand", note: "Demand and order-book plan", to: "/command/sales" },
  {
    label: "Procurement",
    note: "Requirements, MSL and lead time",
    to: "/command/procurement-planning",
  },
  { label: "Production", note: "Volume, mix and capacity", to: "/command/production" },
  { label: "Finance", note: "Assumptions, funding and timing", to: "/command/finance-assumptions" },
  { label: "Scenarios", note: "Base, delayed and stress cases", to: "/command/scenarios" },
];

const ROADMAP = [
  {
    phase: "Foundation",
    month: "M1",
    owner: "Founder",
    due: "Month 1",
    status: "Current control",
    dependency: "Incorporation + banking",
    evidence: "Foundation execution",
    to: "/command/founder-command",
    actionIds: ["FC-01", "FC-04", "FC-05"],
  },
  {
    phase: "Engineering baseline",
    month: "M3",
    owner: "Engineering",
    due: "Month 3",
    status: "Blocked",
    dependency: "VEDM reconciliation + 700×40 evidence",
    evidence: "Controlled geometry baseline",
    to: "/command/engineering",
    actionIds: ["FC-02", "FC-03"],
  },
  {
    phase: "Prototype & validation",
    month: "M6",
    owner: "Engineering + QA",
    due: "Month 6",
    status: "Gate",
    dependency: "Design freeze",
    evidence: "Prototype / NDT / ISO evidence",
    to: "/command/qa-verification",
    actionIds: ["FC-08"],
  },
  {
    phase: "Tooling & pilot",
    month: "M10",
    owner: "Operations",
    due: "Month 10",
    status: "Planned",
    dependency: "Validation release",
    evidence: "Tooling + pilot release",
    to: "/command/manufacturing",
    actionIds: ["FC-07"],
  },
  {
    phase: "Launch readiness",
    month: "M14",
    owner: "Founder + Commercial",
    due: "Month 14",
    status: "Planned",
    dependency: "Inventory + working capital",
    evidence: "First 100 customer readiness",
    to: "/command/sales",
    actionIds: ["FC-09"],
  },
  {
    phase: "Scale",
    month: "M15–36",
    owner: "Leadership",
    due: "Months 15–36",
    status: "Planned",
    dependency: "Validated demand + funded capacity",
    evidence: "Monthly operating reviews",
    to: "/command/financial-cockpit",
    actionIds: ["FC-10"],
  },
] as const;

const QUARTERS = Array.from({ length: 12 }, (_, index) => {
  const start = index * 3 + 1;
  const end = start + 2;
  const gates = TRANCHES.filter((tranche) => tranche.month >= start && tranche.month <= end);
  return { quarter: `Q${index + 1}`, months: `M${start}–M${end}`, gates };
});

const capitalLadder = TRANCHES.filter((tranche) => tranche.id !== "STBY").reduce((sum, tranche) => sum + tranche.amount, 0);

function statusClass(status: string) {
  if (status === "Blocked") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (status === "Current control") return "border-green/30 bg-green/10 text-green";
  if (status === "Gate") return "border-accent/30 bg-accent/10 text-accent";
  return "border-border bg-bg-elevated/40 text-muted";
}

function MasterPlan() {
  const role = Route.useLoaderData();
  const actionProgress = useVeloxis((state) => state.actions);
  const founderActions = resolveFounderActions(actionProgress);
  const accessible = (to: string) => canAccessRoute(role, to);
  const planTabs = PLAN_TABS.filter((tab) => accessible(tab.to));
  const visibleDecisions = DECISION_PACKETS.filter((packet) => accessible(packet.source));
  const attention = [...visibleDecisions]
    .filter((packet) => packet.state === "blocked" || packet.state === "approval" || packet.priority === "critical")
    .sort((a, b) => decisionPriorityRank[a.priority] - decisionPriorityRank[b.priority])
    .slice(0, 4);
  const blockedCount = visibleDecisions.filter((packet) => packet.state === "blocked").length;
  const approvalCount = visibleDecisions.filter((packet) => packet.state === "approval").length;
  const criticalCount = visibleDecisions.filter((packet) => packet.priority === "critical").length;
  const roadmap = ROADMAP.map((row) => {
    const actions = founderActions.filter((action) => row.actionIds.some((id) => id === action.id));
    const status = actions.length && actions.every((action) => action.status === "complete") ? "Complete" : actions.some((action) => action.status === "blocked") ? "Blocked" : actions.some((action) => action.status === "active") ? "Current control" : row.status;
    return { ...row, status };
  });
  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Planning · canonical operating plan</p>
          <h1 className="mt-1 font-display text-4xl text-accent">Master Plan</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">One 36-month planning surface for {COMPANY.brand}. Keep modeled intent here; orders, receipts, job cards, inventory movements and actuals stay in their operating workspaces.</p>
        </div>
        <Link to="/command" className="w-fit rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-fg">
          Command Centre →
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Planning status">
        <Kpi label="Planning horizon" value="36 months" hint="Quarter view by default" />
        <Kpi label="Critical decisions" value={String(criticalCount)} hint="Only decision-grade exceptions" tone={criticalCount ? "warn" : "ok"} />
        <Kpi label="Blocked items" value={String(blockedCount)} hint="Resolve before dependent release" tone={blockedCount ? "danger" : "ok"} />
        <Kpi label="Capital ladder" value={`₹${capitalLadder}L`} hint={`${approvalCount} approvals currently flagged`} />
      </section>

      <nav className="overflow-x-auto rounded-xl border border-border bg-surface/40 p-1 [scrollbar-width:thin]" aria-label="Master Plan sections">
        <div className="flex min-w-max gap-1">
          {planTabs.map((tab) => (
            <Link key={tab.label} to={tab.to as never} className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${tab.to === "/command/planning" ? "bg-accent text-accent-fg" : "text-muted hover:bg-bg/60 hover:text-fg"}`}>
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>

      <Panel title="Needs attention" kicker="Exceptions only · no duplicate dashboard noise">
        <div className="divide-y divide-border rounded-xl border border-border">
          {attention.map((packet) => (
            <div key={packet.id} className="grid gap-3 p-4 lg:grid-cols-[120px_1fr_180px_auto] lg:items-center">
              <div>
                <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${packet.state === "blocked" ? "border-red-500/30 bg-red-500/10 text-red-300" : packet.state === "approval" ? "border-accent/30 bg-accent/10 text-accent" : "border-green/30 bg-green/10 text-green"}`}>{DECISION_STATE_LABELS[packet.state]}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-fg">{packet.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{packet.nextAction}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-green">Owner</p>
                <p className="mt-1 text-xs text-fg">{packet.owner}</p>
              </div>
              <Link to={packet.source as never} className="w-fit rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-fg">
                Open evidence →
              </Link>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Master milestones" kicker="Phase · owner · dependency · evidence">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="border-b border-border bg-bg-elevated/60 text-[10px] uppercase tracking-[0.13em] text-subtle">
              <tr>
                <th className="px-4 py-3">Milestone</th>
                <th className="px-4 py-3">Phase</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Dependency</th>
                <th className="px-4 py-3">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roadmap.map((row) => (
                <tr key={row.month} className="bg-surface/20 transition-colors hover:bg-surface/50">
                  <td className="px-4 py-3 font-semibold text-accent">{row.month}</td>
                  <td className="px-4 py-3 font-semibold text-fg">{row.phase}</td>
                  <td className="px-4 py-3 text-muted">{row.owner}</td>
                  <td className="px-4 py-3 text-muted">{row.due}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(row.status)}`}>{row.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs leading-5 text-muted">{row.dependency}</td>
                  <td className="px-4 py-3">
                    {accessible(row.to) ? (
                      <Link to={row.to as never} className="text-xs font-semibold text-fg hover:text-accent">
                        {row.evidence} →
                      </Link>
                    ) : (
                      <span className="text-xs text-subtle">{row.evidence}</span>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-green">Quarter view · M1–M36</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-accent">36-month timeline</h2>
          </div>
          <span className="shrink-0 text-xs font-semibold text-muted">12 quarters · expand</span>
        </summary>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {QUARTERS.map((quarter) => (
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
                      <p className="mt-1 text-[10px] leading-4 text-muted">{gate.name}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted">Execution and evidence period. No new capital gate defined.</p>
              )}
            </div>
          ))}
        </div>
      </details>

      <details className="rounded-xl border border-border bg-surface/20 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-accent">Help & methodology</summary>
        <div className="mt-3 grid gap-3 text-xs leading-5 text-muted md:grid-cols-2">
          <p>
            <span className="font-semibold text-green">Planning:</span> demand, timing, assumptions, dependencies, funding gates and expected capacity.
          </p>
          <p>
            <span className="font-semibold text-green">Operate:</span> purchase orders, receipts, inventory issues, production job cards, quality records and actual transactions.
          </p>
          <p>
            <span className="font-semibold text-green">Exception rule:</span> if a metric does not change a decision, trigger an action, document evidence or explain a material deviation, it stays off this screen.
          </p>
          <p>
            <span className="font-semibold text-green">Detail rule:</span> use the six plan sections above for specialist work; return here for the integrated roadmap and exceptions.
          </p>
        </div>
      </details>
    </main>
  );
}
