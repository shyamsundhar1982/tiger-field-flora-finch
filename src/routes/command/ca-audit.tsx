import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/kpi";
import { LEGAL_CONTROLS } from "@/lib/data/legal-control";
import { QA_CHECKS } from "@/lib/data/qa-verification";

export const Route = createFileRoute("/command/ca-audit")({ component: CAAudit });

const statusLabel = (status: string) => status === "pass" || status === "complete" ? "PASS / COMPLETE" : status === "blocked" ? "BLOCKED" : status === "verify" ? "VERIFY" : "PENDING";

function CAAudit() {
  const financeChecks = QA_CHECKS.filter((c) => c.domain === "finance");
  const legalChecks = QA_CHECKS.filter((c) => c.domain === "legal");
  const blocked = QA_CHECKS.filter((c) => c.status === "blocked").length;
  const caControls = LEGAL_CONTROLS.filter((c) => c.domain === "tax" || c.domain === "corporate" || c.domain === "commercial");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Finance / governance · Dedicated assurance page</p>
        <h1 className="mt-1 font-display text-4xl">CA Verification / Audit</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">A controlled handover and verification workspace for the Chartered Accountant. It separates management assumptions from evidence that can be reconciled, certified or signed off.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">QA checks</p><p className="mt-1 text-2xl">{QA_CHECKS.length}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Finance checks</p><p className="mt-1 text-2xl">{financeChecks.length}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">CA control items</p><p className="mt-1 text-2xl">{caControls.length}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-wider text-subtle">Workspace blockers</p><p className="mt-1 text-2xl">{blocked}</p></div>
      </div>

      <Panel title="CA verification queue" kicker="Management model → professional review">
        <div className="space-y-3">
          {[
            "Validate the 36-month P&L / cash model assumptions, including ASP, COGS, OPEX, funding timing and breakeven markers.",
            "Reconcile the projected balance-sheet structure to books, bank records, inventory, receivables, payables, capex and statutory liabilities.",
            "Determine appropriate accounting treatment for development / I&AD expenditure and production tooling before any capitalisation claim is made.",
            "Classify funding correctly as equity, grant, debt, founder contribution or other appropriate category and document the basis.",
            "Review GST, TDS, payroll, vendor, import and other statutory implications applicable to actual transactions.",
            "Prepare CA-certified projections / utilisation schedules where required for funding, grant, lender or investor submissions.",
          ].map((item, i) => <div key={item} className="flex gap-3 rounded-md border border-border p-4 text-sm"><span className="text-accent">{String(i + 1).padStart(2, "0")}</span><span>{item}</span></div>)}
        </div>
      </Panel>

      <Panel title="Finance QA evidence" kicker="No certification is implied by a PASS status in this app">
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3">ID</th><th className="px-3 py-3">Check</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Evidence</th><th className="px-3 py-3">Next action</th></tr></thead><tbody>{[...financeChecks, ...legalChecks].map((c) => <tr key={c.id} className="border-t border-border align-top"><td className="px-3 py-3 text-accent">{c.id}</td><td className="px-3 py-3 font-medium">{c.title}</td><td className="px-3 py-3 whitespace-nowrap">{statusLabel(c.status)}</td><td className="px-3 py-3 text-muted">{c.evidence}</td><td className="px-3 py-3 text-muted">{c.nextAction}</td></tr>)}</tbody></table></div>
      </Panel>

      <Panel title="CA sign-off protocol" kicker="Suggested control status">
        <div className="grid gap-3 sm:grid-cols-4">{["Not reviewed", "Documents received", "Reconciled", "CA signed / certified"].map((s, i) => <div key={s} className="rounded-md border border-border p-4"><p className="text-xs text-subtle">Step {i + 1}</p><p className="mt-1 text-sm font-medium">{s}</p></div>)}</div>
        <p className="mt-4 text-xs text-muted">This workspace does not constitute an audit, certification, tax opinion or statutory filing. The responsible CA/CS/counsel must make those professional determinations from the underlying records.</p>
      </Panel>
    </div>
  );
}
