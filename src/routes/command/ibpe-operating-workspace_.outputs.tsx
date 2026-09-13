import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { VibpeSectionNav } from "@/components/vibpe-section-nav";
import { getAdvancedPlanningAuthorityReadiness } from "@/lib/advanced-planning-authority-controls";
import { getAdvancedOptimizerControlState } from "@/lib/advanced-optimizer-control";
import { getVibpeOptimizerReleaseClosure } from "@/lib/vibpe-optimizer-release-closure";
import { getVibpeAssuranceCoverage, listVibpeAssuranceExceptions } from "@/lib/vibpe-assurance";
import { getVibpeUiAssurance } from "@/lib/vibpe-ui-assurance";

type Row = Record<string, unknown>;
const str = (row: Row, ...keys: string[]) => {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null) return String(row[key]);
  return "";
};
const num = (row: Row, ...keys: string[]) => {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null && row[key] !== "") return Number(row[key]) || 0;
  return 0;
};

export const Route = createFileRoute("/command/ibpe-operating-workspace/outputs")({
  loader: async () => {
    const [authority, optimizer, release, exceptions, backend, ui] = await Promise.all([
      getAdvancedPlanningAuthorityReadiness(),
      getAdvancedOptimizerControlState(),
      getVibpeOptimizerReleaseClosure(),
      listVibpeAssuranceExceptions(),
      getVibpeAssuranceCoverage(),
      getVibpeUiAssurance(),
    ]);
    return { generatedAt: new Date().toISOString(), authority, optimizer, release, exceptions, backend, ui };
  },
  component: VibpeOutputsPage,
});

function VibpeOutputsPage() {
  const data = Route.useLoaderData();
  const authorityReady = data.authority.capacity.ready && data.authority.routing.ready && data.authority.supplierLanes.ready;
  const critical = data.exceptions.filter((item) => item.severity === "critical").length;
  const warnings = data.exceptions.filter((item) => item.severity === "warning").length;
  const surfaces = (data.backend.surfaces ?? []) as Row[];
  const uiCoverage = (data.ui.coverage ?? []) as Row[];
  const backendGaps = surfaces.filter((row) => str(row, "coverage_status", "coverageStatus") === "gap").length;
  const uiOutstanding = uiCoverage.reduce((sum, row) => sum + num(row, "failing_capabilities", "failingCapabilities") + num(row, "unobserved_capabilities", "unobservedCapabilities"), 0);
  const blockedReleaseGates = data.release.gates.filter((gate) => !gate.pass);
  const evidenceSummary = {
    schema: "VYNDI-VIBPE-GOVERNED-EVIDENCE-1.0",
    generatedAt: data.generatedAt,
    advisoryOnly: true,
    authorityReady,
    latestIbpeRunId: data.authority.latestIbpeRunId,
    advancedPacketId: data.optimizer.packet?.id ?? null,
    optimizerReady: data.optimizer.readyForGovernedOptimization,
    optimizerIssues: data.optimizer.issues,
    latestOptimizerRun: data.optimizer.recentRun,
    assurance: { total: data.exceptions.length, critical, warnings, backendGaps, uiOutstanding },
    releaseVerdict: data.release.verdict,
    releaseGates: data.release.gates,
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <header className="print:border-b print:border-border print:pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">VYNDI VIBPE · governed outputs</p>
        <h1 className="mt-1 font-display text-4xl">Outputs & Evidence</h1>
        <p className="mt-2 max-w-5xl text-sm leading-6 text-muted">
          Consolidated read-only output from planning authority, immutable packet lineage, optimizer execution, assurance and release closure. No transaction authority is created here.
        </p>
        <p className="mt-2 text-xs text-subtle">Evidence generated {new Date(data.generatedAt).toLocaleString("en-IN")}</p>
        <button type="button" onClick={() => window.print()} className="mt-4 rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg print:hidden">Print governed report</button>
      </header>

      <VibpeSectionNav current="outputs" />

      <Panel title="Executive readiness" kicker="Authority → solver → assurance → release">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Planning authority" value={authorityReady ? "READY" : "BLOCKED"} hint={`${data.authority.capacity.approved}/${data.authority.capacity.active} capacity · ${data.authority.routing.coveredProductIds.length}/${data.authority.plannedProductIds.length} routing · ${data.authority.supplierLanes.coveredSkus.length}/${data.authority.requiredSkus.length} supplier-lane SKU coverage`} tone={authorityReady ? "ok" : "warn"} />
          <Kpi label="Optimizer gate" value={data.optimizer.readyForGovernedOptimization ? "READY" : "BLOCKED"} hint={`${data.optimizer.issues.length} preparation issue(s)`} tone={data.optimizer.readyForGovernedOptimization ? "ok" : "warn"} />
          <Kpi label="Assurance exceptions" value={data.exceptions.length.toLocaleString("en-IN")} hint={`${critical} critical · ${warnings} warning · ${backendGaps} backend gaps · ${uiOutstanding} UI proof outstanding`} tone={critical || backendGaps || uiOutstanding ? "warn" : "ok"} />
          <Kpi label="Release verdict" value={data.release.verdict} hint={`${blockedReleaseGates.length} closure gate(s) blocked`} tone={data.release.verdict === "GREEN" ? "ok" : "warn"} />
        </div>
      </Panel>

      <Panel title="Governed planning lineage" kicker="IBPE run → advanced packet → optimizer run → audit">
        <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted">Latest governed IBPE run</p><p className="mt-2 break-all font-mono text-xs text-fg">{data.authority.latestIbpeRunId ?? "NOT AVAILABLE"}</p></div>
          <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted">Advanced packet</p><p className="mt-2 break-all font-mono text-xs text-fg">{data.optimizer.packet?.id ?? "NOT AVAILABLE"}</p></div>
          <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted">Optimization run</p><p className="mt-2 break-all font-mono text-xs text-fg">{data.optimizer.recentRun?.id ?? "NOT AVAILABLE"}</p></div>
          <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted">Audit event</p><p className="mt-2 break-all font-mono text-xs text-fg">{data.release.audit?.id ?? "NOT AVAILABLE"}</p></div>
        </div>
      </Panel>

      <Panel title="Latest optimization output" kicker="Persisted advisory result only">
        {data.optimizer.recentRun ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div><p className="text-xs text-muted">Math status</p><p className="mt-1 font-semibold text-fg">{data.optimizer.recentRun.optimization_status}</p></div>
            <div><p className="text-xs text-muted">Cash governance</p><p className="mt-1 font-semibold text-fg">{data.optimizer.recentRun.cash_guardrail_status ?? "not-evaluated"}</p></div>
            <div><p className="text-xs text-muted">Accepted</p><p className="mt-1 font-semibold text-fg">{data.optimizer.recentRun.accepted ? "yes" : "no"}</p></div>
            <div><p className="text-xs text-muted">Objective</p><p className="mt-1 font-semibold text-fg">{data.optimizer.recentRun.objective_value ?? "—"}</p></div>
            <div><p className="text-xs text-muted">Created</p><p className="mt-1 text-fg">{new Date(data.optimizer.recentRun.created_at).toLocaleString("en-IN")}</p></div>
          </div>
        ) : <p className="rounded-lg border border-warn/30 bg-warn/5 p-4 text-sm text-warn">No persisted optimizer output exists for the latest packet.</p>}
        {data.optimizer.issues.map((issue) => <div key={`${issue.code}-${issue.message}`} className="mt-2 rounded-md border border-border p-3 text-xs"><span className="font-semibold text-warn">{issue.code}</span><span className="ml-2 text-muted">{issue.message}</span></div>)}
      </Panel>

      <Panel title="Authority evidence" kicker="No inferred approval">
        <div className="grid gap-3 md:grid-cols-3">
          <article className="rounded-xl border border-border p-4"><p className="text-xs text-subtle">CAPACITY</p><p className={`mt-2 text-xl font-semibold ${data.authority.capacity.ready ? "text-ok" : "text-warn"}`}>{data.authority.capacity.ready ? "READY" : "REVIEW REQUIRED"}</p><p className="mt-2 text-xs text-muted">{data.authority.capacity.approved}/{data.authority.capacity.active} approved</p></article>
          <article className="rounded-xl border border-border p-4"><p className="text-xs text-subtle">ROUTING</p><p className={`mt-2 text-xl font-semibold ${data.authority.routing.ready ? "text-ok" : "text-warn"}`}>{data.authority.routing.ready ? "READY" : "REVIEW REQUIRED"}</p><p className="mt-2 text-xs text-muted">Missing: {data.authority.routing.missingProductIds.join(", ") || "none"}</p></article>
          <article className="rounded-xl border border-border p-4"><p className="text-xs text-subtle">SUPPLIER LANES</p><p className={`mt-2 text-xl font-semibold ${data.authority.supplierLanes.ready ? "text-ok" : "text-warn"}`}>{data.authority.supplierLanes.ready ? "READY" : "DATA REQUIRED"}</p><p className="mt-2 text-xs text-muted">{data.authority.supplierLanes.missingSkus.length} BOM SKU(s) missing</p></article>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          <Link to="/command/ibpe-operating-workspace/authority" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">Authority workbench</Link>
          <Link to="/command/procurement" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">Procurement Control</Link>
          <Link to="/command/cash" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">Cash authority</Link>
        </div>
      </Panel>

      <Panel title="Release closure" kicker="Every gate must pass for GREEN">
        <div className="space-y-2">
          {data.release.gates.map((gate) => <article key={gate.id} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[110px_minmax(0,1fr)_auto] md:items-center"><span className="font-mono text-xs text-subtle">{gate.id}</span><div><p className="text-sm font-semibold text-fg">{gate.label}</p><p className="mt-1 text-xs leading-5 text-muted">{gate.evidence}</p></div><span className={`text-xs font-semibold ${gate.pass ? "text-ok" : "text-warn"}`}>{gate.pass ? "PASS" : "BLOCKED"}</span></article>)}
        </div>
      </Panel>

      <Panel title="Machine-readable evidence summary" kicker="Copyable evidence; not transaction authority">
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-surface/30 p-4 text-[11px] leading-5 text-muted">{JSON.stringify(evidenceSummary, null, 2)}</pre>
      </Panel>
    </div>
  );
}
