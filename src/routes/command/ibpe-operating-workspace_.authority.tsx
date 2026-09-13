import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";
import {
  approveAdvancedPlanningCapacity,
  approveAdvancedPlanningRoutingRevision,
  createAdvancedPlanningRoutingDrafts,
  getAdvancedPlanningAuthorityReadiness,
} from "@/lib/advanced-planning-authority-controls";

export const Route = createFileRoute("/command/ibpe-operating-workspace/authority")({
  loader: async () => getAdvancedPlanningAuthorityReadiness(),
  component: AdvancedPlanningAuthorityPage,
});

function stateTone(ok: boolean) {
  return ok ? "text-ok" : "text-warn";
}

function AdvancedPlanningAuthorityPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("No authority action started in this session.");

  async function runAction(key: string, action: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(key);
    setMessage(`${success}…`);
    try {
      await action();
      setMessage(success);
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Governed authority action failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">VYNDI VIBPE · governed planning authority</p>
        <h1 className="mt-1 font-display text-4xl">Advanced Planning Authority</h1>
        <p className="mt-2 max-w-5xl text-sm leading-6 text-muted">
          Close optimizer authority gaps without bypassing governance. Capacity approval preserves the controlled values already in the system.
          Routing drafts are deterministically derived from approved capacity standards and require a separate human approval. Supplier-lane facts are never inferred.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/command/ibpe-operating-workspace/optimizer" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">Optimizer</Link>
          <Link to="/command/ibpe-operating-workspace/assurance" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">VIBPE Assurance</Link>
          <Link to="/command/ibpe-operating-workspace" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">VIBPE Workspace</Link>
        </div>
        <p className="mt-3 text-xs text-subtle">{message}</p>
      </header>

      <Panel title="Authority sequence" kicker="Capacity → persisted routing → supplier lanes → rebuild packet">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-subtle">1 · Capacity</p>
            <p className={`mt-2 text-lg font-semibold ${stateTone(data.capacity.ready)}`}>{data.capacity.ready ? "READY" : "REVIEW REQUIRED"}</p>
            <p className="mt-1 text-xs text-muted">{data.capacity.approved}/{data.capacity.active} active standards approved</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-subtle">2 · Routing</p>
            <p className={`mt-2 text-lg font-semibold ${stateTone(data.routing.ready)}`}>{data.routing.ready ? "READY" : "REVIEW REQUIRED"}</p>
            <p className="mt-1 text-xs text-muted">{data.routing.coveredProductIds.length}/{data.plannedProductIds.length} planned products covered</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-subtle">3 · Supplier lanes</p>
            <p className={`mt-2 text-lg font-semibold ${stateTone(data.supplierLanes.ready)}`}>{data.supplierLanes.ready ? "READY" : "DATA REQUIRED"}</p>
            <p className="mt-1 text-xs text-muted">{data.supplierLanes.coveredSkus.length}/{data.requiredSkus.length} governed BOM SKUs covered</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">Latest governed IBPE run: <span className="font-mono text-fg">{data.latestIbpeRunId ?? "NONE"}</span></p>
      </Panel>

      <Panel title="Capacity authority" kicker="Approve existing controlled standards; do not change numeric values here">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-subtle"><tr className="border-b border-border"><th className="px-2 py-2">Status</th><th className="px-2 py-2">Work centre</th><th className="px-2 py-2">Available h/mo</th><th className="px-2 py-2">Efficiency</th><th className="px-2 py-2">Std h/unit</th><th className="px-2 py-2">Source</th></tr></thead>
            <tbody>
              {data.capacity.rows.map((row) => (
                <tr key={row.work_centre_id} className="border-b border-border/60">
                  <td className={`px-2 py-2 font-semibold ${row.planning_status === "approved" ? "text-ok" : "text-warn"}`}>{row.planning_status}</td>
                  <td className="px-2 py-2 text-fg">{row.work_centre_id} · {row.work_centre_name}</td>
                  <td className="px-2 py-2 text-muted">{Number(row.available_hours_per_month).toLocaleString("en-IN")}</td>
                  <td className="px-2 py-2 text-muted">{Number(row.efficiency).toFixed(2)}</td>
                  <td className="px-2 py-2 text-muted">{Number(row.standard_hours_per_unit).toFixed(2)}</td>
                  <td className="px-2 py-2 text-subtle">{row.source_ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.capacity.ready ? (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void runAction("capacity", () => approveAdvancedPlanningCapacity(), "Capacity standards approved; refresh the frozen planning packet after routing authority is complete")}
            className="mt-4 rounded-md border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10 disabled:opacity-40"
          >
            {busy === "capacity" ? "Approving capacity…" : `Approve ${data.capacity.planningDefault} current capacity standards`}
          </button>
        ) : <p className="mt-4 text-xs text-ok">All active capacity standards are approved.</p>}
      </Panel>

      <Panel title="Persisted routing authority" kicker="Derived draft → human review → governed approval">
        <p className="text-sm text-muted">
          Planned products: {data.plannedProductIds.join(", ") || "none"}. Missing approved routing: {data.routing.missingProductIds.join(", ") || "none"}.
        </p>
        {data.routing.rows.length ? (
          <div className="mt-4 space-y-2">
            {data.routing.rows.map((row) => (
              <div key={row.id} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[minmax(0,1fr)_120px_auto] md:items-center">
                <div><p className="text-sm font-semibold text-fg">{row.product_id} · {row.revision_code}</p><p className="mt-1 font-mono text-[11px] text-subtle">{row.id} · {row.operation_count} operations</p></div>
                <span className={row.status === "approved" ? "text-xs font-semibold text-ok" : "text-xs font-semibold text-warn"}>{row.status.toUpperCase()}</span>
                {row.status === "draft" ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void runAction(`routing:${row.id}`, () => approveAdvancedPlanningRoutingRevision({ data: { revisionId: row.id } }), `Routing ${row.id} approved`)}
                    className="rounded-md border border-accent px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/10 disabled:opacity-40"
                  >{busy === `routing:${row.id}` ? "Approving…" : "Approve routing"}</button>
                ) : <span className="text-xs text-subtle">Approved</span>}
              </div>
            ))}
          </div>
        ) : null}
        {!data.routing.ready ? (
          <button
            type="button"
            disabled={Boolean(busy) || !data.capacity.ready}
            onClick={() => void runAction("routing-drafts", () => createAdvancedPlanningRoutingDrafts(), "Routing drafts created from approved capacity standards; review and approve each product revision")}
            className="mt-4 rounded-md border border-border px-4 py-2 text-sm font-semibold text-fg hover:border-accent hover:text-accent disabled:opacity-40"
          >
            {busy === "routing-drafts" ? "Creating routing drafts…" : data.routing.rows.some((row) => row.status === "draft") ? "Refresh routing drafts" : "Create routing drafts from approved capacity"}
          </button>
        ) : <p className="mt-4 text-xs text-ok">Every planned product has approved persisted routing authority.</p>}
      </Panel>

      <Panel title="Supplier-lane authority" kicker="No inference: supplier terms, reliability and finite capacity need evidence">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted">Approved active suppliers</p><p className="mt-1 text-lg font-semibold text-fg">{data.supplierLanes.approvedActiveSuppliers}</p></div>
          <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted">Approved supplier prices</p><p className="mt-1 text-lg font-semibold text-fg">{data.supplierLanes.approvedSupplierPrices}</p></div>
          <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted">Approved supplier lanes</p><p className="mt-1 text-lg font-semibold text-fg">{data.supplierLanes.approvedLaneCount}</p></div>
        </div>
        {data.supplierLanes.ready ? (
          <p className="mt-4 text-sm text-ok">All governed BOM SKUs have approved supplier-lane authority.</p>
        ) : (
          <div className="mt-4 rounded-lg border border-warn/30 bg-warn/5 p-4">
            <p className="text-sm font-semibold text-warn">Supplier-lane authority is still incomplete.</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Missing governed SKU coverage: {data.supplierLanes.missingSkus.length}. A supplier lane requires an active approved supplier, lead-time evidence, MOQ/order multiple, alternate rank, landed cost with source, governed reliability evidence, policy source and finite capacity across the planning horizon. These facts are not auto-generated.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/command/procurement" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">Procurement Control</Link>
              <Link to="/command/procurement-planning" className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg">Requirements</Link>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Next optimizer step" kicker="Authority changes require a new immutable packet">
        <p className="text-sm leading-6 text-muted">
          After capacity and routing approvals—and once supplier-lane authority is complete—return to the Optimizer and press <strong className="text-fg">Refresh governed advanced-planning packet</strong>. The optimizer will evaluate the newly frozen authority evidence. Cash guardrails remain independent and are not overridden here.
        </p>
        <Link to="/command/ibpe-operating-workspace/optimizer" className="mt-4 inline-flex rounded-md border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10">Return to Optimizer</Link>
      </Panel>
    </div>
  );
}
