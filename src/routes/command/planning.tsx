import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { PlanningStudio } from "@/components/planning-studio";
import { COMPANY, TRANCHES } from "@/lib/data/company";
import { getCommandRole } from "@/lib/command-access";
import { approveOperatingPlan, getOperatingPlanState, submitOperatingPlan } from "@/lib/operating-plan-authority";
import { canPerform } from "@/lib/page-access";
import {
  DEFAULT_APPROVED_OPERATING_PLAN,
  calendarMonthForPlanMonth,
  normalizeOperatingPlan,
  operatingPlanHorizonLabel,
} from "@/lib/planning/operating-plan";

export const Route = createFileRoute("/command/planning")({
  loader: async () => {
    const [role, plan] = await Promise.all([getCommandRole(), getOperatingPlanState()]);
    return { role, plan };
  },
  component: MasterPlan,
});

const PLAN_TABS = [
  { label: "Roadmap", to: "/command/planning" },
  { label: "Demand", to: "/command/sales" },
  { label: "Procurement", to: "/command/procurement-planning" },
  { label: "Production", to: "/command/production" },
  { label: "Finance", to: "/command/finance-assumptions" },
  { label: "Scenarios", to: "/command/scenarios" },
] as const;

const ROADMAP_META = [
  { key: "foundation", phase: "Foundation", owner: "Founder", dependency: "Incorporation + banking", evidence: "Foundation execution", to: "/command/founder-command" },
  { key: "engineeringBaseline", phase: "Engineering baseline", owner: "Engineering", dependency: "Controlled VEDM + BOM baseline", evidence: "Engineering release", to: "/command/engineering" },
  { key: "prototypeValidation", phase: "Prototype & validation", owner: "Engineering + QA", dependency: "Design freeze", evidence: "Validation evidence", to: "/command/qa-verification" },
  { key: "toolingPilot", phase: "Tooling & pilot", owner: "Operations", dependency: "Validation release", evidence: "Pilot readiness", to: "/command/manufacturing" },
  { key: "commercialLaunch", phase: "Commercial launch", owner: "Commercial + Operations", dependency: "Inventory + working capital + committed demand", evidence: "Commercial readiness", to: "/command/sales" },
] as const;

const capitalLadder = TRANCHES.filter((t) => t.id !== "STBY").reduce((s, t) => s + t.amount, 0);

function MasterPlan() {
  const { role, plan } = Route.useLoaderData();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const canApprove = Boolean(role && canPerform(role, "approve"));
  const active = plan.draft ?? plan.approved;
  const approvedOperatingPlan = normalizeOperatingPlan(plan.approved?.finance.operatingPlan ?? DEFAULT_APPROVED_OPERATING_PLAN);
  const activeOperatingPlan = normalizeOperatingPlan(active?.finance.operatingPlan ?? approvedOperatingPlan);

  async function submit() {
    if (!plan.draft) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await submitOperatingPlan({ data: { planId: plan.draft.id } });
      setMessage(`Revision ${result.revision} submitted for approval.`);
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit plan.");
    } finally {
      setBusy(false);
    }
  }

  async function approve(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const result = await approveOperatingPlan({ data: { planId: id, decisionNote: "Approved from Master Plan control surface" } });
      setMessage(`Revision ${result.revision} is now the approved company plan.`);
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to approve plan.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="space-y-6">
    <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Planning · canonical rolling operating intent</p>
        <h1 className="mt-1 font-display text-4xl text-accent">Master Plan</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">One governed rolling 36-month plan for {COMPANY.brand}. Plan, forecast, scenario and actual remain distinct; only an approved revision becomes company planning truth.</p>
      </div>
      <Link to="/command" className="w-fit rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted hover:border-accent">Command Centre →</Link>
    </header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi label="Planning horizon" value="36 months" hint={operatingPlanHorizonLabel(approvedOperatingPlan)} />
      <Kpi label="Approved revision" value={plan.approved ? `R${plan.approved.revision}` : "None"} hint={plan.approved?.approvedAt ? `Approved ${plan.approved.approvedAt.slice(0, 10)}` : "Approval required"} tone={plan.approved ? "ok" : "warn"} />
      <Kpi label="Your draft" value={plan.draft ? `R${plan.draft.revision}` : "None"} hint={plan.draft ? "Server-backed editable draft" : "Using approved plan"} />
      <Kpi label="Commercial launch" value={activeOperatingPlan.milestoneMonths.commercialLaunch > 0 ? `M${activeOperatingPlan.milestoneMonths.commercialLaunch}` : "Historical"} hint={calendarMonthForPlanMonth(activeOperatingPlan, activeOperatingPlan.milestoneMonths.commercialLaunch)} />
      <Kpi label="Capital ladder" value={`₹${capitalLadder}L`} hint="Approved envelope; draw timing is forecast-driven" />
    </div>

    {message ? <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}

    <Panel title="Plan governance" kicker="Draft → submit → approval → one company truth">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface/40 p-4">
          <p className="text-[10px] uppercase tracking-wider text-subtle">Current editing basis</p>
          <p className="mt-2 text-lg font-semibold text-fg">{active ? `Revision ${active.revision} · ${active.status}` : "Initial defaults"}</p>
          <p className="mt-2 text-xs leading-5 text-muted">Scenario {active?.scenario ?? "base"}. The rolling driver set lives inside this governed revision; browser state is only an editing cache.</p>
          {plan.draft ? <button disabled={busy} onClick={() => void submit()} className="mt-4 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg disabled:opacity-50">Submit draft for approval</button> : null}
        </div>
        <div className="rounded-xl border border-border bg-surface/40 p-4">
          <p className="text-[10px] uppercase tracking-wider text-subtle">Approved company plan</p>
          <p className="mt-2 text-lg font-semibold text-fg">{plan.approved ? `R${plan.approved.revision}` : "Not approved yet"}</p>
          <p className="mt-2 text-xs leading-5 text-muted">Only this revision drives official planning. Working scenarios and drafts never silently replace it.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface/40 p-4">
          <p className="text-[10px] uppercase tracking-wider text-subtle">Pending approval</p>
          <p className="mt-2 text-lg font-semibold text-fg">{plan.pending.length}</p>
          <div className="mt-3 space-y-2">{plan.pending.slice(0, 3).map((pending) => <div key={pending.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2"><span className="text-xs">R{pending.revision} · {pending.createdBy}</span>{canApprove ? <button disabled={busy} onClick={() => void approve(pending.id)} className="text-xs font-semibold text-accent">Approve</button> : null}</div>)}</div>
        </div>
      </div>
    </Panel>

    <PlanningStudio role={role} approvedFinance={plan.approved?.finance ?? null} draftFinance={plan.draft?.finance ?? null} draftId={plan.draft?.id ?? null} />

    <nav className="overflow-x-auto rounded-xl border border-border bg-surface/40 p-1"><div className="flex min-w-max gap-1">{PLAN_TABS.map((tab) => <Link key={tab.label} to={tab.to as never} className={`rounded-lg px-4 py-2 text-xs font-semibold ${tab.to === "/command/planning" ? "bg-accent text-accent-fg" : "text-muted hover:bg-bg/60 hover:text-fg"}`}>{tab.label}</Link>)}</div></nav>

    <Panel title="Master milestones" kicker="Approved/draft timing · owner · dependency · evidence">
      <div className="overflow-x-auto rounded-xl border border-border"><table className="min-w-[900px] w-full text-left text-sm"><thead className="border-b border-border bg-bg-elevated/60 text-[10px] uppercase tracking-[0.13em] text-subtle"><tr><th className="px-4 py-3">Milestone</th><th className="px-4 py-3">Calendar</th><th className="px-4 py-3">Phase</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Dependency</th><th className="px-4 py-3">Evidence</th></tr></thead><tbody className="divide-y divide-border">{ROADMAP_META.map((row) => { const month = activeOperatingPlan.milestoneMonths[row.key]; return <tr key={row.key} className="bg-surface/20"><td className="px-4 py-3 font-semibold text-accent">{month > 0 ? `M${month}` : `${Math.abs(month)} mo prior`}</td><td className="px-4 py-3 text-xs text-muted">{calendarMonthForPlanMonth(activeOperatingPlan, month)}</td><td className="px-4 py-3 font-semibold text-fg">{row.phase}</td><td className="px-4 py-3 text-muted">{row.owner}</td><td className="px-4 py-3 text-xs text-muted">{row.dependency}</td><td className="px-4 py-3"><Link to={row.to as never} className="text-xs font-semibold text-fg hover:text-accent">{row.evidence} →</Link></td></tr>; })}</tbody></table></div>
    </Panel>

    <details className="rounded-xl border border-border bg-surface/25 p-5"><summary className="cursor-pointer text-sm font-semibold text-accent">36-month capital gates</summary><div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">{TRANCHES.filter((t) => t.id !== "STBY").map((t) => <div key={t.id} className="rounded-xl border border-border bg-surface/25 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-accent">{t.id}</p><p className="mt-2 text-lg font-semibold">₹{t.amount}L</p><p className="mt-1 text-xs text-muted">{t.name}</p></div>)}</div><p className="mt-4 text-xs text-muted">These are approved funding envelopes. Actual draw timing is derived from the published plan and forecast rather than treated as a separate planning truth.</p></details>
  </main>;
}
