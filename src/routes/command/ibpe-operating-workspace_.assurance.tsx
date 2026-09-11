import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import {
  captureVibpeAssuranceSnapshot,
  getVibpeAssuranceCoverage,
  listVibpeAssuranceExceptions,
} from "@/lib/vibpe-assurance";
import { getVibpeUiAssurance } from "@/lib/vibpe-ui-assurance";

type Row = Record<string, unknown>;

const str = (row: Row, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) return String(value);
  }
  return "";
};

const num = (row: Row, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return Number(value) || 0;
  }
  return 0;
};

const toneFor = (value: string) => {
  if (value === "full" || value === "PASS" || value === "passing") return "text-ok";
  if (value === "gap" || value === "FAIL" || value === "critical" || value === "failing") return "text-warn";
  return "text-muted";
};

export const Route = createFileRoute("/command/ibpe-operating-workspace/assurance")({
  loader: async () => {
    const [backend, exceptions, ui] = await Promise.all([
      getVibpeAssuranceCoverage(),
      listVibpeAssuranceExceptions(),
      getVibpeUiAssurance(),
    ]);
    return { backend, exceptions, ui };
  },
  component: VibpeAssurancePage,
});

function VibpeAssurancePage() {
  const data = Route.useLoaderData();
  const [snapshotState, setSnapshotState] = useState("No assurance snapshot captured in this session.");

  const surfaces = (data.backend.surfaces ?? []) as Row[];
  const gates = (data.backend.gates ?? []) as Row[];
  const workflows = (data.backend.workflow ?? []) as Row[];
  const uiCoverage = (data.ui.coverage ?? []) as Row[];
  const uiCapabilities = (data.ui.capabilities ?? []) as Row[];

  const summary = useMemo(() => {
    const full = surfaces.filter((row) => str(row, "coverage_status", "coverageStatus") === "full").length;
    const partial = surfaces.filter((row) => str(row, "coverage_status", "coverageStatus") === "partial").length;
    const gap = surfaces.filter((row) => str(row, "coverage_status", "coverageStatus") === "gap").length;
    const critical = data.exceptions.filter((item) => item.severity === "critical").length;
    const warnings = data.exceptions.filter((item) => item.severity === "warning").length;
    const uiFailing = uiCoverage.reduce((sum, row) => sum + num(row, "failing_capabilities", "failingCapabilities"), 0);
    const uiUnobserved = uiCoverage.reduce((sum, row) => sum + num(row, "unobserved_capabilities", "unobservedCapabilities"), 0);
    return { full, partial, gap, critical, warnings, uiFailing, uiUnobserved };
  }, [data.exceptions, surfaces, uiCoverage]);

  async function captureSnapshot() {
    setSnapshotState("Capturing immutable assurance evidence…");
    try {
      const result = await captureVibpeAssuranceSnapshot();
      setSnapshotState(
        `Snapshot ${result.snapshotId} captured: ${result.criticalCount} critical, ${result.warningCount} warning, ${result.exceptionCount} total exception(s).`,
      );
    } catch (error) {
      setSnapshotState(error instanceof Error ? error.message : "Assurance snapshot capture failed.");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">
          VYNDI · VIBPE · Assurance
        </p>
        <h1 className="mt-1 font-display text-4xl">VIBPE Assurance</h1>
        <p className="mt-2 max-w-5xl text-sm leading-6 text-muted">
          Evidence-first assurance across canonical business authority, governed workflows, gates, exception detection and runtime UI proof.
          Backend authority and UI binding are deliberately assessed separately: an unproved route remains a gap and is never promoted to a false pass.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={captureSnapshot}
            className="rounded-md border border-accent px-3 py-2 text-xs text-accent hover:bg-accent/10"
          >
            Capture assurance snapshot
          </button>
          <Link
            to="/command/ibpe-operating-workspace"
            className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg"
          >
            VIBPE Workspace
          </Link>
          <Link
            to="/command/control-tower"
            className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-fg"
          >
            Control Tower
          </Link>
        </div>
        <p className="mt-2 text-xs text-subtle">{snapshotState}</p>
      </header>

      <Panel title="Assurance Posture" kicker="Canonical authority + runtime evidence">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Critical exceptions" value={summary.critical.toLocaleString("en-IN")} hint="Deterministic blockers in the unified assurance stream" tone={summary.critical ? "warn" : "ok"} />
          <Kpi label="Warning exceptions" value={summary.warnings.toLocaleString("en-IN")} hint="Includes explicit gaps and unobserved UI capabilities" tone={summary.warnings ? "warn" : "ok"} />
          <Kpi label="Backend surface gaps" value={summary.gap.toLocaleString("en-IN")} hint={`${summary.full} full · ${summary.partial} partial`} tone={summary.gap ? "warn" : "ok"} />
          <Kpi label="UI proof outstanding" value={(summary.uiFailing + summary.uiUnobserved).toLocaleString("en-IN")} hint={`${summary.uiFailing} failing · ${summary.uiUnobserved} unobserved`} tone={summary.uiFailing + summary.uiUnobserved ? "warn" : "ok"} />
        </div>
      </Panel>

      <Panel title="Live Exceptions" kicker="Unified VIBPE assurance stream">
        {data.exceptions.length === 0 ? (
          <p className="rounded-md border border-ok/30 bg-ok/5 p-3 text-sm text-ok">No live assurance exceptions are currently projected.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-subtle">
                <tr className="border-b border-border">
                  <th className="px-2 py-2">Severity</th>
                  <th className="px-2 py-2">Domain</th>
                  <th className="px-2 py-2">Exception</th>
                  <th className="px-2 py-2">Entity</th>
                  <th className="px-2 py-2">Gate</th>
                  <th className="px-2 py-2">Correlation</th>
                </tr>
              </thead>
              <tbody>
                {data.exceptions.map((item) => (
                  <tr key={item.exceptionKey} className="border-b border-border/60 align-top">
                    <td className={`px-2 py-2 font-semibold ${toneFor(item.severity)}`}>{item.severity.toUpperCase()}</td>
                    <td className="px-2 py-2 text-muted">{item.domain}</td>
                    <td className="px-2 py-2 text-fg">{item.exceptionType}</td>
                    <td className="px-2 py-2 text-muted">{item.entityType}:{item.entityId}</td>
                    <td className="px-2 py-2 text-muted">{item.gateId || "—"}</td>
                    <td className="px-2 py-2 text-subtle">{item.correlationId || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Authority Surface Register" kicker="Full ≠ route proof unless the route itself is proven">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-subtle">
              <tr className="border-b border-border">
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Domain</th>
                <th className="px-2 py-2">Surface</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Owner</th>
                <th className="px-2 py-2">Evidence / note</th>
              </tr>
            </thead>
            <tbody>
              {surfaces.map((row, index) => {
                const status = str(row, "coverage_status", "coverageStatus");
                return (
                  <tr key={`${str(row, "surface_id", "surfaceId")}-${index}`} className="border-b border-border/60 align-top">
                    <td className={`px-2 py-2 font-semibold ${toneFor(status)}`}>{status || "unknown"}</td>
                    <td className="px-2 py-2 text-muted">{str(row, "domain")}</td>
                    <td className="px-2 py-2 text-fg">{str(row, "surface_name", "surfaceName")}</td>
                    <td className="px-2 py-2 text-muted">{str(row, "surface_type", "surfaceType")}</td>
                    <td className="px-2 py-2 text-muted">{str(row, "owner_workspace", "ownerWorkspace") || "—"}</td>
                    <td className="max-w-xl px-2 py-2 text-subtle">{str(row, "notes") || str(row, "evidence_source", "evidenceSource") || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Runtime UI Assurance" kicker="Observed evidence only; unobserved is not green">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {uiCoverage.map((row, index) => {
            const registered = num(row, "registered_capabilities", "registeredCapabilities");
            const observed = num(row, "observed_capabilities", "observedCapabilities");
            const passing = num(row, "passing_capabilities", "passingCapabilities");
            const failing = num(row, "failing_capabilities", "failingCapabilities");
            const unobserved = num(row, "unobserved_capabilities", "unobservedCapabilities");
            return (
              <article key={`${str(row, "domain")}-${index}`} className="rounded-xl border border-border bg-surface/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-fg">{str(row, "domain") || "unknown"}</p>
                    <p className="mt-1 text-xs text-muted">{observed}/{registered} capabilities observed</p>
                  </div>
                  <span className={`text-xs font-semibold ${failing || unobserved ? "text-warn" : "text-ok"}`}>
                    {failing ? `${failing} FAIL` : unobserved ? `${unobserved} UNOBSERVED` : "PASS"}
                  </span>
                </div>
                <p className="mt-3 text-xs text-subtle">{passing} passing · {failing} failing · {unobserved} unobserved</p>
              </article>
            );
          })}
        </div>
        <details className="mt-4 rounded-lg border border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-fg">Registered UI capabilities ({uiCapabilities.length})</summary>
          <div className="border-t border-border p-3">
            <div className="grid gap-2 lg:grid-cols-2">
              {uiCapabilities.map((row, index) => (
                <div key={`${str(row, "capability_id", "capabilityId")}-${index}`} className="rounded-md border border-border/70 p-3 text-xs">
                  <p className="font-semibold text-fg">{str(row, "capability_name", "capabilityName")}</p>
                  <p className="mt-1 text-muted">{str(row, "route_path", "routePath")}</p>
                  <p className="mt-1 text-subtle">Expected: {str(row, "expected_result", "expectedResult")}</p>
                </div>
              ))}
            </div>
          </div>
        </details>
      </Panel>

      <Panel title="Governed Gate & Workflow Coverage" kicker="Evidence model, not an alternate transaction engine">
        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">Active gates ({gates.length})</p>
            <div className="mt-2 space-y-2">
              {gates.map((row, index) => (
                <div key={`${str(row, "gate_id", "gateId")}-${index}`} className="rounded-md border border-border p-3 text-xs">
                  <p className="font-semibold text-fg">{str(row, "gate_id", "gateId")} · {str(row, "gate_name", "gateName")}</p>
                  <p className="mt-1 text-muted">{str(row, "domain")} · {str(row, "decision_criteria", "decisionCriteria")}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">Workflow stages ({workflows.length})</p>
            <div className="mt-2 space-y-2">
              {workflows.map((row, index) => (
                <div key={`${str(row, "workflow_id", "workflowId")}-${str(row, "stage_id", "stageId")}-${index}`} className="rounded-md border border-border p-3 text-xs">
                  <p className="font-semibold text-fg">{str(row, "workflow_id", "workflowId")} · {str(row, "stage_name", "stageName")}</p>
                  <p className="mt-1 text-muted">Entity {str(row, "entity_type", "entityType")} · Gate {str(row, "gate_id", "gateId") || "—"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <p className="text-xs leading-5 text-subtle">
        Assurance is observational and evidentiary. This page does not become a duplicate writer for Product, Engineering, Quality, People & Office, Dispatch, Finance or any other canonical domain.
      </p>
    </div>
  );
}
