import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";
import { CONTRACT_CLAUSES, GANTT, OEM_CRITERIA, QC_GATES } from "@/lib/data/ops";

export const Route = createFileRoute("/command/ops")({ component: Ops });

function Ops() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Schedule 4 + Gantt</p>
        <h1 className="font-display text-4xl">Manufacturing</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Taiwan / Vietnam for frames. India for assembly, brand, and service. No CAD leaves the house until
          NDA + M3 provisional filing.
        </p>
      </div>

      <Panel title="36-month operating critical path">
        <div className="space-y-2">
          {GANTT.map((g) => (
            <div key={g.id} className="grid grid-cols-[7rem_1fr] items-center gap-3 text-sm sm:grid-cols-[11rem_1fr_4rem]">
              <p className="truncate text-muted">{g.label}</p>
              <div className="relative h-7 rounded-md bg-surface">
                <div
                  className="absolute inset-y-1 rounded-sm bg-accent/80"
                  style={{
                    left: `${((g.start - 1) / 36) * 100}%`,
                    width: `${((g.end - g.start + 1) / 36) * 100}%`,
                  }}
                />
              </div>
              <p className="hidden tabular-nums text-xs text-subtle sm:block">
                M{g.start}–{g.end}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-subtle">M1 — M36</p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="OEM qualification">
          <ol className="list-decimal space-y-2 pl-4 text-sm text-muted">
            {OEM_CRITERIA.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
        </Panel>
        <Panel title="QC gates">
          <ol className="list-decimal space-y-2 pl-4 text-sm text-muted">
            {QC_GATES.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel title="Ten non-negotiable clauses">
        <div className="grid gap-3 md:grid-cols-2">
          {CONTRACT_CLAUSES.map((c) => (
            <div key={c.id} className="rounded-md bg-surface p-4">
              <p className="text-sm text-accent">
                {c.id}. {c.title}
              </p>
              <p className="mt-1 text-sm text-muted">{c.body}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
