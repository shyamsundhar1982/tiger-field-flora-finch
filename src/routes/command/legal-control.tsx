import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";
import { LEGAL_CONTROLS, LEGAL_GATES, LEGAL_STATUS_LABELS } from "@/lib/data/legal-control";

export const Route = createFileRoute("/command/legal-control")({ component: LegalControl });

function LegalControl() {
  const pending = LEGAL_CONTROLS.filter((c) => c.status === "pending").length;
  const verify = LEGAL_CONTROLS.filter((c) => c.status === "verify").length;
  const complete = LEGAL_CONTROLS.filter((c) => c.status === "complete").length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Stage 6</p>
        <h1 className="font-display text-4xl">Legal / IP / CA Control</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Evidence-controlled legal, intellectual-property, corporate, tax and commercial gates. Planning items are not legal conclusions and must be confirmed by the appropriate CA, CS or counsel before execution.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Controls</p><p className="mt-1 text-2xl tabular-nums">{LEGAL_CONTROLS.length}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Pending evidence</p><p className="mt-1 text-2xl tabular-nums">{pending}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Verify / complete</p><p className="mt-1 text-2xl tabular-nums">{verify} / {complete}</p></div>
      </div>

      <Panel title="Stage gates">
        <div className="space-y-2">
          {LEGAL_GATES.map((g) => (
            <div key={g.gate} className="flex flex-wrap items-baseline gap-3 border-t border-border py-3 text-sm">
              <span className="w-8 text-accent">{g.gate}</span>
              <span className="w-20 text-muted">{g.when}</span>
              <span className="flex-1 font-medium">{g.title}</span>
              <span className="text-xs text-muted">{g.controls.join(" · ")}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Controlled legal register">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[68rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="py-2 pr-3">ID</th><th className="py-2 pr-3">Control</th><th className="py-2 pr-3">Domain</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Requirement</th><th className="py-2 pr-3">Evidence</th><th className="py-2 pr-3">Owner</th><th className="py-2">Stage</th>
              </tr>
            </thead>
            <tbody>
              {LEGAL_CONTROLS.map((c) => (
                <tr key={c.id} className="border-t border-border align-top">
                  <td className="py-3 pr-3 tabular-nums text-accent">{c.id}</td>
                  <td className="py-3 pr-3 font-medium">{c.title}</td>
                  <td className="py-3 pr-3 text-muted">{c.domain}</td>
                  <td className="py-3 pr-3 whitespace-nowrap"><span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-wider">{LEGAL_STATUS_LABELS[c.status]}</span></td>
                  <td className="py-3 pr-3 text-muted">{c.requirement}</td>
                  <td className="py-3 pr-3 text-muted">{c.evidence}</td>
                  <td className="py-3 pr-3 whitespace-nowrap text-muted">{c.owner}</td>
                  <td className="py-3 whitespace-nowrap text-muted">{c.stage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Release rule">
        <p className="text-sm text-muted">No item is considered legally complete merely because it is planned in this workspace. Mark <span className="text-fg">Complete</span> only after the corresponding executed document, filing receipt, adviser confirmation or policy evidence is attached to the project record.</p>
      </Panel>
    </div>
  );
}
