import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, CircleHelp, ShieldAlert } from "lucide-react";
import { DEPLOYMENT_GATES, HANDOVER_CHECKLIST, RELEASE_SUMMARY, UNRESOLVED_BLOCKERS } from "@/lib/data/deployment-readiness";

export const Route = createFileRoute("/command/deployment-readiness")({ component: DeploymentReadinessPage });

function icon(status: string) {
  if (status === "ready") return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (status === "blocked") return <ShieldAlert className="size-4 text-red-600" />;
  if (status === "conditional") return <AlertTriangle className="size-4 text-amber-600" />;
  return <CircleHelp className="size-4 text-muted" />;
}

function DeploymentReadinessPage() {
  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">Stage 12 · Final Deployment Readiness</p>
        <h1 className="text-3xl font-semibold tracking-tight">One release gate for the whole workspace.</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted">This is the final handover layer. It separates repository integration from product validation, legal completion, funding readiness and deployment success so none of those states can be confused.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-5">
        {[["Gates", RELEASE_SUMMARY.gates], ["Ready", RELEASE_SUMMARY.ready], ["Conditional", RELEASE_SUMMARY.conditional], ["Blocked", RELEASE_SUMMARY.blocked], ["External", RELEASE_SUMMARY.external]].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-surface p-4"><p className="text-xs text-subtle">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}
      </section>

      <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
        <div className="flex items-center gap-2"><ShieldAlert className="size-5 text-red-600" /><h2 className="font-semibold">Final release decision</h2></div>
        <p className="mt-2 text-sm leading-6 text-muted">NOT RELEASE-READY. Critical blockers and external verification gates remain. This is intentional: the workspace must not represent unverified engineering, runtime or security conditions as complete.</p>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Final deployment gates</h2></div>
        <div className="divide-y divide-border">{DEPLOYMENT_GATES.map((gate) => <article key={gate.id} className="grid gap-3 p-5 lg:grid-cols-[80px_1.1fr_1.5fr_1fr] lg:items-start"><div className="text-xs font-mono text-subtle">{gate.id}</div><div><div className="flex items-center gap-2">{icon(gate.status)}<h3 className="font-medium">{gate.title}</h3></div><p className="mt-1 text-xs uppercase tracking-wide text-subtle">{gate.status} · {gate.priority}</p></div><div><p className="text-sm leading-5">{gate.requirement}</p><p className="mt-2 text-xs text-muted">Evidence: {gate.evidence}</p></div><div><p className="text-xs uppercase tracking-wide text-subtle">Release condition</p><p className="mt-1 text-sm text-muted">{gate.releaseCondition}</p></div></article>)}</div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5"><h2 className="font-semibold">Unresolved blockers</h2><div className="mt-4 space-y-3">{UNRESOLVED_BLOCKERS.map((item) => <div key={item.id} className="rounded-lg border border-border p-3"><div className="flex justify-between gap-3"><span className="font-medium text-sm">{item.title}</span><span className="text-[10px] uppercase tracking-wide text-red-600">{item.severity}</span></div><p className="mt-1 text-xs text-muted">Owner: {item.owner}</p></div>)}</div></div>
        <div className="rounded-xl border border-border bg-surface p-5"><h2 className="font-semibold">Handover checklist</h2><ul className="mt-4 space-y-3 text-sm text-muted">{HANDOVER_CHECKLIST.map((item) => <li key={item} className="flex gap-2"><span>□</span><span>{item}</span></li>)}</ul></div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 text-sm leading-6 text-muted"><strong className="text-fg">Important:</strong> Stage 12 does not certify the bicycle, company, funding, legal position or production system. It establishes the release-control contract and makes the remaining evidence explicit. A successful Vercel deployment would certify only that the application deployment succeeded for that commit.</section>
    </main>
  );
}
