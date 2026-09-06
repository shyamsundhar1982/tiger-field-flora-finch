import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Panel } from "@/components/kpi";
import { DECISION_PACKETS, DECISION_STATE_LABELS, decisionPriorityRank } from "@/lib/data/decision-engine";
import { FOUNDER_ACTIONS } from "@/lib/data/founder-command";

export const Route = createFileRoute("/command/decision-engine")({ component: DecisionEngine });

function DecisionEngine() {
  const [filter, setFilter] = useState<"all" | "critical" | "approval" | "blocked">("all");
  const packets = useMemo(() => {
    return [...DECISION_PACKETS]
      .filter((p) => filter === "all" || p.priority === filter || p.state === filter)
      .sort((a, b) => decisionPriorityRank[a.priority] - decisionPriorityRank[b.priority]);
  }, [filter]);

  const critical = DECISION_PACKETS.filter((p) => p.priority === "critical").length;
  const approvals = DECISION_PACKETS.filter((p) => p.state === "approval").length;
  const blocked = DECISION_PACKETS.filter((p) => p.state === "blocked").length;
  const ready = DECISION_PACKETS.filter((p) => p.state === "ready").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Phase K · Integrated execution</p>
          <h1 className="font-display text-4xl">Decision Engine</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">The bridge from signal to action: Founder Command → alert → decision packet → evidence → governance → approval → financial and operational impact → stakeholder reporting.</p>
        </div>
        <div className="flex gap-3 text-sm"><Link to="/command/founder-command" className="text-accent hover:text-fg">Founder Command →</Link><Link to="/command/governance" className="text-accent hover:text-fg">Governance →</Link></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Critical</p><p className="mt-1 text-2xl tabular-nums">{critical}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Ready</p><p className="mt-1 text-2xl tabular-nums">{ready}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Approval</p><p className="mt-1 text-2xl tabular-nums">{approvals}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Blocked</p><p className="mt-1 text-2xl tabular-nums">{blocked}</p></div>
      </div>

      <Panel title="What must happen next?" kicker="Decision packet queue">
        <div className="mb-4 flex flex-wrap gap-2">
          {(["all", "critical", "approval", "blocked"] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-md border px-3 py-2 text-xs uppercase tracking-wider ${filter === value ? "border-accent text-accent" : "border-border text-muted hover:border-accent"}`}>{value}</button>)}
        </div>
        <div className="space-y-3">
          {packets.map((p) => (
            <div key={p.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-accent">{p.id}</span><span className="text-[10px] uppercase tracking-wider text-subtle">{p.priority}</span><span className="rounded-full border border-border px-2 py-1 text-[10px] text-muted">{DECISION_STATE_LABELS[p.state]}</span></div><h2 className="mt-2 text-lg font-medium">{p.title}</h2><p className="mt-1 text-xs text-muted">Trigger: {p.trigger}</p></div>
                <Link to={p.source as never} className="text-xs text-accent hover:text-fg">Open source control →</Link>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <div><p className="text-[10px] uppercase tracking-wider text-subtle">Decision</p><p className="mt-1 text-sm">{p.decision}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-subtle">Evidence</p><p className="mt-1 text-sm text-muted">{p.evidence}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-subtle">Approval</p><p className="mt-1 text-sm text-muted">{p.approval}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-subtle">Financial impact</p><p className="mt-1 text-sm text-muted">{p.financialImpact}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-subtle">Operational impact</p><p className="mt-1 text-sm text-muted">{p.operationalImpact}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-subtle">Next action</p><p className="mt-1 text-sm font-medium">{p.nextAction}</p></div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Execution chain" kicker="No silent transitions"><div className="space-y-2 text-sm">{["Signal / alert", "Accountable action", "Evidence captured", "Governance decision", "Approval", "Financial + operational impact", "Stakeholder disclosure"].map((step, i) => <div key={step} className="flex items-center gap-3 rounded-md border border-border p-3"><span className="text-xs text-accent">0{i + 1}</span><span>{step}</span></div>)}</div></Panel>
        <Panel title="Control rules" kicker="Founder authority"><ul className="space-y-3 text-sm text-muted"><li>• Blocked means blocked — the engine cannot mark it complete.</li><li>• Evidence is required before a gate can be presented as satisfied.</li><li>• Approval is explicit and remains separate from evidence.</li><li>• Financial impact is modeled, not represented as cash received.</li><li>• Stakeholder reporting inherits verified / modeled / pending disclosure discipline.</li></ul></Panel>
        <Panel title="Linked systems" kicker="Single operating graph"><div className="space-y-2"><Link className="block rounded-md border border-border p-3 text-sm hover:border-accent" to="/command/founder-command">Founder Command</Link><Link className="block rounded-md border border-border p-3 text-sm hover:border-accent" to="/command/financial-cockpit">Financial Cockpit</Link><Link className="block rounded-md border border-border p-3 text-sm hover:border-accent" to="/command/governance">Governance & Approvals</Link><Link className="block rounded-md border border-border p-3 text-sm hover:border-accent" to="/command/stakeholder-portal">Stakeholder Portal</Link><Link className="block rounded-md border border-border p-3 text-sm hover:border-accent" to="/command/actions">Action Log</Link></div></Panel>
      </div>

      <Panel title="Current dependency truth" kicker="Founder queue cross-check"><div className="grid gap-2 md:grid-cols-2">{FOUNDER_ACTIONS.map((a) => <div key={a.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3"><div><span className="text-xs text-accent">{a.id}</span><p className="mt-1 text-sm">{a.title}</p></div><span className="whitespace-nowrap text-[10px] uppercase tracking-wider text-subtle">{a.status}</span></div>)}</div></Panel>
    </div>
  );
}
