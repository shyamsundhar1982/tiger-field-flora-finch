import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";
import { getVibpeOptimizerReleaseClosure } from "@/lib/vibpe-optimizer-release-closure";

export const Route = createFileRoute("/command/ibpe-operating-workspace/release")({
  loader: async () => getVibpeOptimizerReleaseClosure(),
  component: VibpeOptimizerReleasePage,
});

function VibpeOptimizerReleasePage() {
  const closure = Route.useLoaderData();
  const green = closure.verdict === "GREEN";

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">VYNDI VIBPE · production closure</p>
        <h1 className="mt-1 font-display text-4xl">Governed Optimizer Release</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
          Final production verdict derived from runtime, database migration, exact packet lineage, persisted solver execution,
          cash-governance consistency, attributed actor evidence and append-only audit evidence. No gate is inferred.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/command/ibpe-operating-workspace/optimizer" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">Optimizer</Link>
          <Link to="/command/ibpe-operating-workspace/assurance" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">VIBPE Assurance</Link>
          <Link to="/command/ibpe-operating-workspace" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">VIBPE Workspace</Link>
        </div>
      </header>

      <section className={`rounded-2xl border p-6 ${green ? "border-ok/40 bg-ok/5" : "border-warn/40 bg-warn/5"}`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Release verdict</p>
        <p className={`mt-2 font-display text-5xl font-semibold ${green ? "text-ok" : "text-warn"}`}>{closure.verdict}</p>
        <p className="mt-3 text-sm text-muted">
          {green
            ? "All governed production closure gates are evidenced."
            : "At least one production closure gate lacks evidence. The system must not be described as fully production-proven yet."}
        </p>
      </section>

      <Panel title="Closure gates" kicker="Every gate must pass for GREEN">
        <div className="space-y-3">
          {closure.gates.map((gate) => (
            <article key={gate.id} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[120px_minmax(0,1fr)_auto] md:items-center">
              <span className="font-mono text-xs text-subtle">{gate.id}</span>
              <div>
                <p className="text-sm font-semibold text-fg">{gate.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{gate.evidence}</p>
              </div>
              <span className={`text-xs font-semibold ${gate.pass ? "text-ok" : "text-warn"}`}>{gate.pass ? "PASS" : "BLOCKED"}</span>
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="Production runtime" kicker="Safe operational evidence">
        <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div><p className="text-xs text-muted">Transport</p><p className="mt-1 text-fg">{closure.readiness.transportSource}</p></div>
          <div><p className="text-xs text-muted">Migration 0071</p><p className="mt-1 text-fg">{closure.readiness.migration0071Applied ? "applied" : "missing"}</p></div>
          <div><p className="text-xs text-muted">v2 persistence</p><p className="mt-1 text-fg">{closure.readiness.persistenceFunctionPresent ? "present" : "missing"}</p></div>
          <div><p className="text-xs text-muted">Optimizer runs</p><p className="mt-1 text-fg">{closure.readiness.optimizationRunCount}</p></div>
        </div>
      </Panel>

      <Panel title="Release evidence identifiers" kicker="Exact packet → run → audit lineage">
        <div className="space-y-3 text-xs">
          <div className="rounded-lg border border-border p-3"><span className="text-muted">Advanced packet</span><p className="mt-1 break-all font-mono text-fg">{closure.packet?.id ?? "NOT AVAILABLE"}</p></div>
          <div className="rounded-lg border border-border p-3"><span className="text-muted">Optimization run</span><p className="mt-1 break-all font-mono text-fg">{closure.run?.id ?? "NOT AVAILABLE"}</p></div>
          <div className="rounded-lg border border-border p-3"><span className="text-muted">Audit event</span><p className="mt-1 break-all font-mono text-fg">{closure.audit?.id ?? "NOT AVAILABLE"}</p></div>
        </div>
      </Panel>
    </div>
  );
}
