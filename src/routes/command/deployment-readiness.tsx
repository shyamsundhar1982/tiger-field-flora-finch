import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, ShieldAlert } from "lucide-react";
import { DEPLOYMENT_GATES, HANDOVER_CHECKLIST, RELEASE_SUMMARY, UNRESOLVED_BLOCKERS } from "@/lib/data/deployment-readiness";
import { listOperatingActionStatus, saveOperatingActionStatus, type OperatingActionStatus } from "@/lib/operating-action-authority";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/command/deployment-readiness")({
  loader: () => listOperatingActionStatus(),
  component: DeploymentReadinessPage,
});

const gateKey = (id: string) => `deployment-gate:${id}`;

function icon(status: string) {
  if (status === "ready") return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (status === "blocked") return <ShieldAlert className="size-4 text-red-600" />;
  if (status === "conditional") return <AlertTriangle className="size-4 text-amber-600" />;
  return <CircleHelp className="size-4 text-muted" />;
}

function DeploymentReadinessPage() {
  const loaded = Route.useLoaderData();
  const [gates, setGates] = useState<Record<string, OperatingActionStatus>>(loaded);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const isOpen = (id: string) => (gates[gateKey(id)] ?? "open") !== "done";
  const openCount = DEPLOYMENT_GATES.filter((gate) => isOpen(gate.id)).length;
  const workflowOpen = openCount === DEPLOYMENT_GATES.length;

  async function setGate(id: string, open: boolean) {
    setBusy(id); setMessage("");
    try {
      const status: OperatingActionStatus = open ? "open" : "done";
      await saveOperatingActionStatus({ data: { actionId: gateKey(id), status, owner: "Deployment Readiness", note: open ? "Deployment gate opened for workflow testing." : "Deployment gate closed by authorised operator." } });
      setGates((current) => ({ ...current, [gateKey(id)]: status }));
      setMessage(`${id} ${open ? "opened" : "closed"}. Source evidence status remains unchanged.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update deployment gate."); }
    finally { setBusy(null); }
  }

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">Stage 12 · Final Deployment Readiness</p>
        <h1 className="text-3xl font-semibold tracking-tight">Editable deployment control.</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted">Deployment enforcement is now operator-controlled and separate from evidence maturity. All gates default OPEN for workflow testing and can later be closed individually with an audited toggle.</p>
      </header>

      {message ? <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}

      <section className="grid gap-3 sm:grid-cols-6">
        {[["Gates", RELEASE_SUMMARY.gates], ["Ready evidence", RELEASE_SUMMARY.ready], ["Conditional", RELEASE_SUMMARY.conditional], ["Blocked evidence", RELEASE_SUMMARY.blocked], ["External", RELEASE_SUMMARY.external], ["Open gates", openCount]].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-surface p-4"><p className="text-xs text-subtle">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}
      </section>

      <section className={cn("rounded-xl border p-5", workflowOpen ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5")}>
        <div className="flex items-center gap-2">{workflowOpen ? <CheckCircle2 className="size-5 text-emerald-600" /> : <ShieldAlert className="size-5 text-red-600" />}<h2 className="font-semibold">Web application workflow decision</h2></div>
        <p className="mt-2 text-sm leading-6 text-muted">{workflowOpen ? "OPEN FOR GO-LIVE WORKFLOW TESTING — no deployment gate is currently enforcing a stop." : "DEPLOYMENT WORKFLOW STOPPED — one or more gates have been deliberately closed."}</p>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Deployment gates</h2></div>
        <div className="divide-y divide-border">{DEPLOYMENT_GATES.map((gate) => {
          const open = isOpen(gate.id);
          return <article key={gate.id} className="grid gap-3 p-5 lg:grid-cols-[80px_1.05fr_1.35fr_1fr_150px] lg:items-start">
            <div className="text-xs font-mono text-subtle">{gate.id}</div>
            <div><div className="flex items-center gap-2">{icon(gate.status)}<h3 className="font-medium">{gate.title}</h3></div><p className="mt-1 text-xs uppercase tracking-wide text-subtle">Evidence: {gate.status} · {gate.priority}</p></div>
            <div><p className="text-sm leading-5">{gate.requirement}</p><p className="mt-2 text-xs text-muted">Evidence: {gate.evidence}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-subtle">Release condition</p><p className="mt-1 text-sm text-muted">{gate.releaseCondition}</p></div>
            <button type="button" disabled={busy === gate.id} onClick={() => void setGate(gate.id, !open)} className={cn("h-10 rounded-md px-3 text-xs font-medium disabled:opacity-50", open ? "bg-emerald-600 text-white" : "bg-red-600 text-white")}>{open ? "Gate OPEN" : "Gate CLOSED"}</button>
          </article>;
        })}</div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5"><h2 className="font-semibold">Evidence still unresolved</h2><div className="mt-4 space-y-3">{UNRESOLVED_BLOCKERS.map((item) => <div key={item.id} className="rounded-lg border border-border p-3"><div className="flex justify-between gap-3"><span className="font-medium text-sm">{item.title}</span><span className="text-[10px] uppercase tracking-wide text-red-600">{item.severity}</span></div><p className="mt-1 text-xs text-muted">Owner: {item.owner}</p></div>)}</div></div>
        <div className="rounded-xl border border-border bg-surface p-5"><h2 className="font-semibold">Handover checklist</h2><ul className="mt-4 space-y-3 text-sm text-muted">{HANDOVER_CHECKLIST.map((item) => <li key={item} className="flex gap-2"><span>□</span><span>{item}</span></li>)}</ul></div>
      </section>

      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm leading-6 text-muted"><strong className="text-fg">Control model:</strong> an OPEN gate permits the application workflow to continue; it does not certify the bicycle, engineering validation, legal position, funding, supplier readiness or security evidence. Close gates after workflow verification to enforce the required production controls.</section>
    </main>
  );
}
