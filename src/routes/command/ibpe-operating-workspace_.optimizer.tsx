import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";
import { runAdvancedPlanningFromLatestIbpe } from "@/lib/advanced-planning-authority";
import { getAdvancedOptimizerControlState } from "@/lib/advanced-optimizer-control";
import { runAdvancedOptimizerFromPacket } from "@/lib/advanced-optimizer-execution";

export const Route = createFileRoute("/command/ibpe-operating-workspace/optimizer")({
  loader: async () => getAdvancedOptimizerControlState(),
  component: GovernedOptimizerPage,
});

function statusClass(ok: boolean) {
  return ok ? "text-ok" : "text-warn";
}

function GovernedOptimizerPage() {
  const state = Route.useLoaderData();
  const router = useRouter();
  const [packetBusy, setPacketBusy] = useState(false);
  const [packetMessage, setPacketMessage] = useState(
    state.packet
      ? "The latest complete governed advanced-planning packet is selected."
      : "No packet has been built in this session.",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("No optimizer run started in this session.");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function preparePacket() {
    if (packetBusy || busy) return;
    setPacketBusy(true);
    setPacketMessage("Building a governed advanced-planning packet from the latest complete IBPE snapshot…");
    try {
      const response = await runAdvancedPlanningFromLatestIbpe();
      setPacketMessage(
        `Governed packet ${response.id} persisted from IBPE run ${response.parentIbpeRunId}. Refreshing readiness evidence…`,
      );
      await router.invalidate();
    } catch (error) {
      setPacketMessage(error instanceof Error ? error.message : "Governed advanced-planning packet preparation failed.");
    } finally {
      setPacketBusy(false);
    }
  }

  async function execute() {
    if (!state.packet || !state.readyForGovernedOptimization || busy || packetBusy) return;
    setBusy(true);
    setMessage("Running governed HiGHS optimization against the exact frozen packet…");
    try {
      const response = await runAdvancedOptimizerFromPacket({
        data: {
          packetId: state.packet.id,
          requestId: `VIBPE-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        },
      });
      setResult(response as unknown as Record<string, unknown>);
      setMessage(
        `Persisted ${response.optimizationRunId}. Mathematical status ${response.result?.status ?? "error"}; cash governance ${response.cashGovernance.status}; accepted=${response.accepted ? "yes" : "no"}.`,
      );
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Governed optimizer execution failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">VYNDI VIBPE · governed optimization</p>
        <h1 className="mt-1 font-display text-4xl">Advanced Planning Optimizer</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
          Executes HiGHS only against an exact immutable advanced-planning packet. Output is advisory evidence only;
          it cannot create purchase orders, production orders, inventory movements, funding actions or sales commitments.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/command/ibpe-operating-workspace" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">VIBPE Workspace</Link>
          <Link to="/command/ibpe-operating-workspace/assurance" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">VIBPE Assurance</Link>
          <Link to="/command/ibpe-operating-workspace/release" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">Release Readiness</Link>
        </div>
      </header>

      <Panel title="Governed preparation gate" kicker="Exact packet → authority → cash guardrails → solver">
        {state.packet ? (
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted">Advanced packet</p><p className="mt-1 font-mono text-xs text-fg">{state.packet.id}</p></div>
            <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted">Parent IBPE run</p><p className="mt-1 font-mono text-xs text-fg">{state.packet.parent_ibpe_run_id}</p></div>
            <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted">Packet / model</p><p className="mt-1 text-fg">{state.packet.packet_version} · {state.packet.advanced_model_version}</p></div>
            <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted">Execution gate</p><p className={`mt-1 font-semibold ${statusClass(state.readyForGovernedOptimization)}`}>{state.readyForGovernedOptimization ? "READY" : "BLOCKED"}</p></div>
          </div>
        ) : (
          <div className="rounded-lg border border-warn/30 bg-warn/5 p-4">
            <p className="text-sm font-semibold text-warn">No complete advanced-planning packet is available.</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Build the packet from the latest complete governed IBPE snapshot first. Packet preparation freezes planning lineage,
              model and authority evidence; it does not run the solver or create business transactions.
            </p>
          </div>
        )}

        {state.issues.length ? (
          <div className="mt-4 space-y-2">
            {state.issues.map((issue) => (
              <div key={`${issue.code}-${issue.message}`} className="rounded-md border border-border px-3 py-2 text-xs">
                <span className={issue.severity === "error" ? "font-semibold text-warn" : "font-semibold text-muted"}>{issue.code}</span>
                <span className="ml-2 text-muted">{issue.message}</span>
              </div>
            ))}
          </div>
        ) : <p className="mt-4 text-xs text-ok">No preparation-gate issue detected.</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void preparePacket()}
            disabled={packetBusy || busy}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-fg hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {packetBusy
              ? "Building governed packet…"
              : state.packet
                ? "Refresh governed advanced-planning packet"
                : "Build governed advanced-planning packet"}
          </button>
          <p className="max-w-3xl text-xs leading-5 text-muted">{packetMessage}</p>
        </div>
      </Panel>

      <Panel title="Run governed optimizer" kicker="Human initiated · advisory only · immutable evidence">
        <button
          type="button"
          onClick={() => void execute()}
          disabled={!state.packet || !state.readyForGovernedOptimization || busy || packetBusy}
          className="rounded-md border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Running optimizer…" : "Run governed HiGHS optimization"}
        </button>
        <p className="mt-3 text-xs leading-5 text-muted">{message}</p>
        {result ? (
          <details className="mt-4 rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-xs font-semibold text-fg">Execution evidence</summary>
            <pre className="mt-3 overflow-x-auto text-[11px] leading-5 text-muted">{JSON.stringify(result, null, 2)}</pre>
          </details>
        ) : null}
      </Panel>

      <Panel title="Latest persisted run" kicker="Immutable advisory evidence for the selected packet">
        {state.recentRun ? (
          <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
            <div><p className="text-xs text-muted">Run</p><p className="mt-1 font-mono text-xs text-fg">{state.recentRun.id}</p></div>
            <div><p className="text-xs text-muted">Mathematical status</p><p className="mt-1 text-fg">{state.recentRun.optimization_status}</p></div>
            <div><p className="text-xs text-muted">Cash governance</p><p className="mt-1 text-fg">{state.recentRun.cash_guardrail_status ?? "not-evaluated"}</p></div>
            <div><p className="text-xs text-muted">Accepted</p><p className="mt-1 text-fg">{state.recentRun.accepted ? "yes" : "no"}</p></div>
            <div><p className="text-xs text-muted">Objective</p><p className="mt-1 text-fg">{state.recentRun.objective_value ?? "—"}</p></div>
            <div><p className="text-xs text-muted">Created</p><p className="mt-1 text-fg">{new Date(state.recentRun.created_at).toLocaleString("en-IN")}</p></div>
          </div>
        ) : <p className="text-sm text-muted">No persisted optimization run exists yet for this packet.</p>}
      </Panel>
    </div>
  );
}
