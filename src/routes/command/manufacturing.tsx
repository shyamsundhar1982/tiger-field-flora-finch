import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";
import { MANUFACTURING_CONTROLS, MANUFACTURING_GATES, MANUFACTURING_STATUS_LABELS } from "@/lib/data/manufacturing-control";

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
        <p className="mt-2 max-w-3xl text-sm text-muted">Supplier qualification, tooling custody, pilot production, traceability, quality release and logistics controls for the asset-light OEM model.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel title="Pending evidence"><p className="text-3xl tabular-nums">{pending}</p></Panel>
        <Panel title="Verify"><p className="text-3xl tabular-nums">{verify}</p></Panel>
        <Panel title="Planned"><p className="text-3xl tabular-nums">{planned}</p></Panel>
      </div>

      <Panel title="Manufacturing control register">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[68rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-subtle">
              <tr><th className="py-2">ID</th><th className="py-2">Control</th><th className="py-2">Domain</th><th className="py-2">Status</th><th className="py-2">Stage</th><th className="py-2">Evidence</th><th className="py-2">Owner</th></tr>
            </thead>
            <tbody>
              {MANUFACTURING_CONTROLS.map((c) => (
                <tr key={c.id} className="border-t border-border align-top">
                  <td className="py-3 tabular-nums text-accent">{c.id}</td>
                  <td className="py-3"><div>{c.title}</div><div className="mt-1 max-w-xl text-xs text-muted">{c.requirement}</div>{c.note && <div className="mt-1 max-w-xl text-xs text-warn">{c.note}</div>}</td>
                  <td className="py-3 text-muted">{c.domain}</td>
                  <td className="py-3 whitespace-nowrap">{MANUFACTURING_STATUS_LABELS[c.status]}</td>
                  <td className="py-3 whitespace-nowrap tabular-nums">{c.stage}</td>
                  <td className="py-3 text-muted">{c.evidence}</td>
                  <td className="py-3 whitespace-nowrap">{c.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Release gates">
        <div className="grid gap-3 md:grid-cols-2">
          {MANUFACTURING_GATES.map((g) => (
            <div key={g.gate} className="rounded-md bg-surface p-4">
              <div className="flex items-baseline justify-between gap-3"><span className="text-accent">{g.gate}</span><span className="text-xs text-muted">{g.when}</span></div>
              <p className="mt-1 font-medium">{g.title}</p>
              <p className="mt-2 text-xs text-muted">Controls: {g.controls.join(" · ")}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
