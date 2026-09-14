import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";
import {
  MANUFACTURING_CONTROLS,
  MANUFACTURING_GATES,
  MANUFACTURING_STATUS_LABELS,
} from "@/lib/data/manufacturing-control";

export const Route = createFileRoute("/command/manufacturing")({ component: Manufacturing });

function Manufacturing() {
  const pending = MANUFACTURING_CONTROLS.filter((c) => c.status === "pending").length;
  const verify = MANUFACTURING_CONTROLS.filter((c) => c.status === "verify").length;
  const planned = MANUFACTURING_CONTROLS.filter((c) => c.status === "planned").length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Schedule 7</p>
        <h1 className="font-display text-4xl">Manufacturing & supply chain</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Supplier qualification, tooling custody, pilot production, traceability, quality release
          and logistics controls for the asset-light OEM model.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel title="Pending evidence">
          <p className="text-3xl tabular-nums">{pending}</p>
        </Panel>
        <Panel title="Verify">
          <p className="text-3xl tabular-nums">{verify}</p>
        </Panel>
        <Panel title="Planned">
          <p className="text-3xl tabular-nums">{planned}</p>
        </Panel>
      </div>

      <Panel title="Manufacturing control register">
        <div
          className="space-y-2"
          data-full-view-table="manufacturing-control-register"
          aria-label="Full-view manufacturing control register"
        >
          <div className="hidden grid-cols-[minmax(0,.45fr)_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,.85fr)_minmax(0,.65fr)_minmax(0,1.25fr)_minmax(0,.85fr)] gap-2 rounded-lg border border-border bg-surface/55 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-subtle lg:grid">
            <span>ID</span>
            <span>Control</span>
            <span>Domain</span>
            <span>Status</span>
            <span>Stage</span>
            <span>Evidence</span>
            <span>Owner</span>
          </div>

          {MANUFACTURING_CONTROLS.map((c) => (
            <article
              key={c.id}
              className="rounded-lg border border-border/80 bg-bg/45 p-3 transition-colors hover:bg-surface/45"
            >
              <div className="hidden grid-cols-[minmax(0,.45fr)_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,.85fr)_minmax(0,.65fr)_minmax(0,1.25fr)_minmax(0,.85fr)] items-start gap-2 lg:grid">
                <p className="break-words text-xs font-semibold tabular-nums text-accent">{c.id}</p>
                <div className="min-w-0">
                  <p className="break-words text-xs font-semibold leading-5 text-fg">{c.title}</p>
                  <p className="mt-1 break-words text-[11px] leading-4 text-muted">{c.requirement}</p>
                  {c.note ? (
                    <p className="mt-1 break-words text-[11px] leading-4 text-warn">{c.note}</p>
                  ) : null}
                </div>
                <p className="min-w-0 break-words text-[11px] leading-4 text-muted">{c.domain}</p>
                <p className="min-w-0 break-words text-[11px] font-semibold leading-4">
                  {MANUFACTURING_STATUS_LABELS[c.status]}
                </p>
                <p className="text-[11px] tabular-nums">{c.stage}</p>
                <p className="min-w-0 break-words text-[11px] leading-4 text-muted">{c.evidence}</p>
                <p className="min-w-0 break-words text-[11px] leading-4">{c.owner}</p>
              </div>

              <div className="space-y-3 lg:hidden">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tabular-nums text-accent">{c.id}</p>
                    <p className="mt-1 break-words text-sm font-semibold leading-5 text-fg">{c.title}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border bg-surface px-2 py-1 text-[9px] font-semibold">
                    {MANUFACTURING_STATUS_LABELS[c.status]}
                  </span>
                </div>

                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-subtle">
                    Requirement
                  </p>
                  <p className="mt-1 break-words text-xs leading-5 text-muted">{c.requirement}</p>
                  {c.note ? (
                    <p className="mt-1 break-words text-xs leading-5 text-warn">{c.note}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-4">
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-subtle">Domain</p>
                    <p className="mt-1 break-words text-muted">{c.domain}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-subtle">Stage</p>
                    <p className="mt-1 tabular-nums">{c.stage}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-subtle">Evidence</p>
                    <p className="mt-1 break-words text-muted">{c.evidence}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-subtle">Owner</p>
                    <p className="mt-1 break-words">{c.owner}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="Release gates">
        <div className="grid gap-3 md:grid-cols-2">
          {MANUFACTURING_GATES.map((g) => (
            <div key={g.gate} className="rounded-md bg-surface p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-accent">{g.gate}</span>
                <span className="text-xs text-muted">{g.when}</span>
              </div>
              <p className="mt-1 font-medium">{g.title}</p>
              <p className="mt-2 text-xs text-muted">Controls: {g.controls.join(" · ")}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
