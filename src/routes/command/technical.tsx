import { createFileRoute } from "@tanstack/react-router";
import { Panel, Kpi } from "@/components/kpi";
import { TECHNICAL_CONTROLS } from "@/lib/data/technical";
import { KNOWLEDGE_STATUS_LABELS, type KnowledgeStatus } from "@/lib/data/knowledge";

export const Route = createFileRoute("/command/technical")({ component: Technical });

const STATUS_ORDER: KnowledgeStatus[] = ["confirmed", "planned", "pending", "conflict", "superseded"];

function Technical() {
  const counts = STATUS_ORDER.map((status) => ({
    status,
    count: TECHNICAL_CONTROLS.filter((item) => item.status === status).length,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Stage 3 · Engineering control</p>
        <h1 className="font-display text-4xl">Technical & Product</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Controlled engineering path from VEDM baseline through geometry, clearance, materials, FEA, NDT, ISO 4210 and design freeze.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Controls" value={TECHNICAL_CONTROLS.length.toString()} hint="Stage 3 register" />
        <Kpi label="Pending" value={String(counts.find((x) => x.status === "pending")?.count ?? 0)} hint="Evidence/source required" />
        <Kpi label="Conflict" value={String(counts.find((x) => x.status === "conflict")?.count ?? 0)} hint="Must resolve before freeze" />
        <Kpi label="Release gate" value="ISO → Freeze" hint="Tooling follows freeze" />
      </div>

      <Panel title="Engineering control register" kicker="No pending/conflict item is treated as production-locked">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[70rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="py-2 pr-3 font-medium">ID</th>
                <th className="py-2 pr-3 font-medium">Control</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Current value</th>
                <th className="py-2 pr-3 font-medium">Evidence</th>
                <th className="py-2 font-medium">Gate</th>
              </tr>
            </thead>
            <tbody>
              {TECHNICAL_CONTROLS.map((item) => (
                <tr key={item.id} className="border-t border-border align-top">
                  <td className="py-3 pr-3 text-accent">{item.id}</td>
                  <td className="py-3 pr-3">
                    <p className="text-fg">{item.title}</p>
                    <p className="mt-1 text-xs text-muted">{item.requirement}</p>
                  </td>
                  <td className="py-3 pr-3 whitespace-nowrap">{KNOWLEDGE_STATUS_LABELS[item.status]}</td>
                  <td className="py-3 pr-3 max-w-sm text-muted">{item.currentValue}</td>
                  <td className="py-3 pr-3 max-w-sm text-muted">{item.evidence}</td>
                  <td className="py-3 text-muted whitespace-nowrap">{item.gate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Release sequence" kicker="Stage 3">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          {[
            ["01", "VEDM baseline", "Verify master source"],
            ["02", "Geometry + 40 mm", "Reconcile fit and clearance"],
            ["03", "FEA + prototype", "Structural and dimensional evidence"],
            ["04", "ISO → freeze → tooling", "No tooling before controlled release"],
          ].map(([n, title, body]) => (
            <li key={n} className="rounded-md bg-surface p-4">
              <span className="text-xs text-accent">{n}</span>
              <p className="mt-2 text-fg">{title}</p>
              <p className="mt-1 text-xs text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
