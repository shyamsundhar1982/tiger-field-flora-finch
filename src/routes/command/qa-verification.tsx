import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, CircleHelp, ShieldAlert } from "lucide-react";
import { QA_CHECKS, QA_RELEASE_RULES, QA_SUMMARY } from "@/lib/data/qa-verification";

export const Route = createFileRoute("/command/qa-verification")({
  component: QAVerificationPage,
});

function statusClass(status: string) {
  if (status === "pass") return "text-emerald-600";
  if (status === "blocked") return "text-red-600";
  if (status === "pending") return "text-amber-600";
  return "text-muted";
}

function QAVerificationPage() {
  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">Stage 11 · QA / Verification</p>
        <h1 className="text-3xl font-semibold tracking-tight">Release evidence, not assumptions.</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted">This control surface checks whether the workspace is internally disciplined and identifies blockers that still require external engineering, legal, financial, supplier or runtime evidence.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ["Checks", QA_SUMMARY.total],
          ["Pass", QA_SUMMARY.pass],
          ["Pending", QA_SUMMARY.pending],
          ["Blocked", QA_SUMMARY.blocked],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-subtle">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          {QA_SUMMARY.releaseReady ? <CheckCircle2 className="size-5 text-emerald-600" /> : <ShieldAlert className="size-5 text-red-600" />}
          <h2 className="font-semibold">Workspace release status</h2>
        </div>
        <p className="mt-2 text-sm text-muted">{QA_SUMMARY.releaseReady ? "No critical QA blocker is recorded in this matrix." : "NOT RELEASE-READY — critical blockers remain."}</p>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Verification matrix</h2></div>
        <div className="divide-y divide-border">
          {QA_CHECKS.map((check) => (
            <article key={check.id} className="grid gap-3 p-5 lg:grid-cols-[90px_1.1fr_1.5fr_1fr] lg:items-start">
              <div className="text-xs font-mono text-subtle">{check.id}</div>
              <div><div className="flex items-center gap-2"><span className={statusClass(check.status)}>{check.status === "pass" ? <CheckCircle2 className="size-4" /> : check.status === "blocked" ? <ShieldAlert className="size-4" /> : check.status === "pending" ? <AlertTriangle className="size-4" /> : <CircleHelp className="size-4" />}</span><h3 className="font-medium">{check.title}</h3></div><p className="mt-1 text-xs uppercase tracking-wide text-subtle">{check.domain} · {check.priority}</p></div>
              <div><p className="text-sm leading-5">{check.requirement}</p><p className="mt-2 text-xs text-muted">Evidence: {check.evidence}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-subtle">Next action</p><p className="mt-1 text-sm text-muted">{check.nextAction}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Release rules</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">{QA_RELEASE_RULES.map((rule) => <li key={rule} className="flex gap-2"><span>•</span><span>{rule}</span></li>)}</ul>
      </section>

      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm leading-6 text-muted">
        <strong className="text-fg">Verification limitation:</strong> this stage records the repository's QA contract and static evidence matrix. It does not claim a local npm build, typecheck or test run where an execution environment is unavailable. Vercel deployment status must be checked separately; successful deployment only proves the application deployment succeeded, not that the bicycle programme itself is validated.
      </section>
    </main>
  );
}
