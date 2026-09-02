import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";
import {
  KNOWLEDGE_STATUS_LABELS,
  MASTER_KNOWLEDGE,
  knowledgeSummary,
} from "@/lib/data/knowledge";

export const Route = createFileRoute("/command/knowledge")({ component: Knowledge });

function Knowledge() {
  const summary = knowledgeSummary();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Master control · Stage 2</p>
        <h1 className="font-display text-4xl">Knowledge base</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          One controlled view of the business baseline. Planning assumptions and unresolved engineering
          decisions are deliberately separated from confirmed evidence.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Records" value={summary.total} />
        <Stat label="Confirmed" value={summary.confirmed} />
        <Stat label="Planned" value={summary.planned} />
        <Stat label="Pending" value={summary.pending} />
        <Stat label="Conflicts" value={summary.conflict} />
      </div>

      <Panel title="Controlled records" kicker="Evidence status matters">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-subtle">
              <tr>
                <th className="py-3 pr-4">Domain</th>
                <th className="py-3 pr-4">Record</th>
                <th className="py-3 pr-4">Value</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Source</th>
              </tr>
            </thead>
            <tbody>
              {MASTER_KNOWLEDGE.map((record) => (
                <tr key={record.id} className="border-b border-line/60 align-top">
                  <td className="py-3 pr-4 text-accent">{record.domain}</td>
                  <td className="py-3 pr-4 font-medium text-fg">{record.title}</td>
                  <td className="py-3 pr-4 text-muted">{record.value}</td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full border border-line px-2 py-1 text-xs text-fg">
                      {KNOWLEDGE_STATUS_LABELS[record.status]}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs text-subtle">{record.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="text-[11px] uppercase tracking-wider text-subtle">{label}</p>
      <p className="mt-1 text-2xl tabular-nums text-fg">{value}</p>
    </div>
  );
}
