import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, ShieldAlert } from "lucide-react";
import { QA_CHECKS, QA_RELEASE_RULES, QA_SUMMARY } from "@/lib/data/qa-verification";
import { listOperatingActionStatus, saveOperatingActionStatus, type OperatingActionStatus } from "@/lib/operating-action-authority";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/command/qa-verification")({
  loader: () => listOperatingActionStatus(),
  component: QAVerificationPage,
});

const gateKey = (id: string) => `qa-gate:${id}`;

function statusClass(status: string) {
  if (status === "pass") return "text-emerald-600";
  if (status === "blocked") return "text-red-600";
  if (status === "pending") return "text-amber-600";
  return "text-muted";
}

function QAVerificationPage() {
  const loaded = Route.useLoaderData();
  const [gates, setGates] = useState<Record<string, OperatingActionStatus>>(loaded);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const isOpen = (id: string) => (gates[gateKey(id)] ?? "open") !== "done";
  const openCount = QA_CHECKS.filter((check) => isOpen(check.id)).length;
  const releaseOpen = openCount === QA_CHECKS.length;

  async function setGate(id: string, open: boolean) {
    setBusy(id); setMessage("");
    try {
      const status: OperatingActionStatus = open ? "open" : "done";
      await saveOperatingActionStatus({ data: { actionId: gateKey(id), status, owner: "QA / Verification", note: open ? "Gate opened for workflow execution." : "Gate closed by authorised operator." } });
      setGates((current) => ({ ...current, [gateKey(id)]: status }));
      setMessage(`${id} gate ${open ? "opened" : "closed"}. Evidence status was not changed.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update gate."); }
    finally { setBusy(null); }
  }

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">Stage 11 · QA / Verification</p>
        <h1 className="text-3xl font-semibold tracking-tight">Editable verification gates.</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted">Evidence status and gate enforcement are separate. All gates default OPEN for workflow testing; authorised users can close or reopen each gate without falsifying the underlying evidence record.</p>
      </header>

      {message ? <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}

      <section className="grid gap-3 sm:grid-cols-5">
        {[["Checks", QA_SUMMARY.total], ["Pass evidence", QA_SUMMARY.pass], ["Pending evidence", QA_SUMMARY.pending], ["Blocked evidence", QA_SUMMARY.blocked], ["Open gates", openCount]].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-4"><p className="text-xs text-subtle">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>
        ))}
      </section>

      <section className={cn("rounded-xl border p-5", releaseOpen ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5")}>
        <div className="flex items-center gap-2">{releaseOpen ? <CheckCircle2 className="size-5 text-emerald-600" /> : <ShieldAlert className="size-5 text-amber-600" />}<h2 className="font-semibold">QA workflow gate status</h2></div>
        <p className="mt-2 text-sm text-muted">{releaseOpen ? "OPEN FOR WORKFLOW TESTING — no QA gate is currently enforcing a stop." : "One or more QA gates are closed and will be treated as deliberate workflow stops."}</p>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Verification matrix</h2></div>
        <div className="divide-y divide-border">{QA_CHECKS.map((check) => {
          const open = isOpen(check.id);
          return <article key={check.id} className="grid gap-3 p-5 lg:grid-cols-[90px_1.05fr_1.4fr_1fr_150px] lg:items-start">
            <div className="text-xs font-mono text-subtle">{check.id}</div>
            <div><div className="flex items-center gap-2"><span className={statusClass(check.status)}>{check.status === "pass" ? <CheckCircle2 className="size-4" /> : check.status === "blocked" ? <ShieldAlert className="size-4" /> : check.status === "pending" ? <AlertTriangle className="size-4" /> : <CircleHelp className="size-4" />}</span><h3 className="font-medium">{check.title}</h3></div><p className="mt-1 text-xs uppercase tracking-wide text-subtle">Evidence: {check.status} · {check.domain} · {check.priority}</p></div>
            <div><p className="text-sm leading-5">{check.requirement}</p><p className="mt-2 text-xs text-muted">Evidence: {check.evidence}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-subtle">Next action</p><p className="mt-1 text-sm text-muted">{check.nextAction}</p></div>
            <button type="button" disabled={busy === check.id} onClick={() => void setGate(check.id, !open)} className={cn("h-10 rounded-md px-3 text-xs font-medium disabled:opacity-50", open ? "bg-emerald-600 text-white" : "bg-red-600 text-white")}>{open ? "Gate OPEN" : "Gate CLOSED"}</button>
          </article>;
        })}</div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5"><h2 className="font-semibold">Evidence rules remain active</h2><ul className="mt-3 space-y-2 text-sm text-muted">{QA_RELEASE_RULES.map((rule) => <li key={rule} className="flex gap-2"><span>•</span><span>{rule}</span></li>)}</ul></section>
      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm leading-6 text-muted"><strong className="text-fg">Control model:</strong> opening a gate authorises workflow continuation only. It does not convert pending or blocked engineering, legal, security, financial or validation evidence into a pass.</section>
    </main>
  );
}
