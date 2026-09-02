import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";
import { FOUNDER_ACTIONS, FOUNDER_GATES, FOUNDER_STATUS_LABELS } from "@/lib/data/founder-command";

export const Route = createFileRoute("/command/founder-command")({ component: FounderCommand });

function FounderCommand() {
  const blocked = FOUNDER_ACTIONS.filter((a) => a.status === "blocked").length;
  const next = FOUNDER_ACTIONS.filter((a) => a.status === "next").length;
  const active = FOUNDER_ACTIONS.filter((a) => a.status === "active").length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Stage 8</p>
        <h1 className="font-display text-4xl">Founder Command Centre</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">One operating view for the founder: what must happen next, what is blocked, who owns it, and which gate unlocks the next capital or engineering decision.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Actions</p><p className="mt-1 text-2xl tabular-nums">{FOUNDER_ACTIONS.length}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Blocked</p><p className="mt-1 text-2xl tabular-nums">{blocked}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Next</p><p className="mt-1 text-2xl tabular-nums">{next}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Active</p><p className="mt-1 text-2xl tabular-nums">{active}</p></div>
      </div>

      <Panel title="Command gates">
        <div className="space-y-2">
          {FOUNDER_GATES.map((g) => <div key={g.gate} className="flex flex-wrap items-baseline gap-3 border-t border-border py-3 text-sm"><span className="w-8 text-accent">{g.gate}</span><span className="w-24 text-muted">{g.when}</span><span className="flex-1 font-medium">{g.title}</span><span className="text-xs text-muted">{g.controls.join(" · ")}</span></div>)}
        </div>
      </Panel>

      <Panel title="Founder action queue">
        <div className="overflow-x-auto"><table className="w-full min-w-[65rem] text-left text-sm"><thead className="text-[11px] uppercase tracking-[0.14em] text-subtle"><tr><th className="py-2 pr-3">ID</th><th className="py-2 pr-3">Priority</th><th className="py-2 pr-3">Action</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Stage</th><th className="py-2 pr-3">Owner</th><th className="py-2 pr-3">Outcome</th><th className="py-2">Dependency</th></tr></thead><tbody>{FOUNDER_ACTIONS.map((a) => <tr key={a.id} className="border-t border-border align-top"><td className="py-3 pr-3 text-accent">{a.id}</td><td className="py-3 pr-3 uppercase text-[10px] tracking-wider">{a.priority}</td><td className="py-3 pr-3 font-medium">{a.title}</td><td className="py-3 pr-3 whitespace-nowrap">{FOUNDER_STATUS_LABELS[a.status]}</td><td className="py-3 pr-3 whitespace-nowrap text-muted">{a.stage}</td><td className="py-3 pr-3 whitespace-nowrap text-muted">{a.owner}</td><td className="py-3 pr-3 text-muted">{a.outcome}</td><td className="py-3 text-muted">{a.dependency ?? "—"}</td></tr>)}</tbody></table></div>
      </Panel>

      <Panel title="Operating rule"><p className="text-sm text-muted">The Founder Command Centre does not mark downstream work complete automatically. A gate advances only when the underlying evidence exists in the relevant Technical, Finance, Funding, Legal or Manufacturing control register.</p></Panel>
    </div>
  );
}
