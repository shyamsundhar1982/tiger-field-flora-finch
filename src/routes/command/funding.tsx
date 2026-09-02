import { createFileRoute } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { FUNDING_DOCUMENTS, FUNDING_LADDER, FUNDING_PIPELINE, FUNDING_STATUS_LABELS } from "@/lib/data/funding-control";

export const Route = createFileRoute("/command/funding")({ component: Funding });

function Funding() {
  const ready = FUNDING_PIPELINE.filter((x) => x.status === "application-ready").length;
  const verify = FUNDING_PIPELINE.filter((x) => x.status === "verify").length;
  const closed = FUNDING_PIPELINE.filter((x) => x.status === "closed").length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Stage 5 · Funding intelligence</p>
        <h1 className="font-display text-4xl">Grants & Funding</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">One register for non-dilutive funding, debt-support routes and the eventual equity decision—without treating unverified programme terms as facts.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Opportunities" value={String(FUNDING_PIPELINE.length)} hint="Controlled funding register" />
        <Kpi label="Application ready" value={String(ready)} hint="Can move into submission prep" />
        <Kpi label="Verify" value={String(verify)} hint="Current terms must be checked" />
        <Kpi label="Closed" value={String(closed)} hint="Excluded from active plan" />
      </div>

      <Panel title="Funding pipeline" kicker="Status discipline">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[76rem] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-[0.14em] text-subtle"><tr><th className="py-2 pr-3">ID</th><th className="py-2 pr-3">Programme</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Stage</th><th className="py-2 pr-3">Quantum</th><th className="py-2 pr-3">Dilution</th><th className="py-2 pr-3">Fit</th><th className="py-2">Next action</th></tr></thead>
            <tbody>{FUNDING_PIPELINE.map((x) => <tr key={x.id} className="border-t border-border align-top"><td className="py-3 pr-3 text-accent">{x.id}</td><td className="py-3 pr-3 text-fg">{x.name}<div className="mt-1 text-xs text-muted">{x.provider}</div></td><td className="py-3 pr-3">{x.type}</td><td className="py-3 pr-3 whitespace-nowrap">{FUNDING_STATUS_LABELS[x.status]}</td><td className="py-3 pr-3">{x.stage}</td><td className="py-3 pr-3 max-w-xs text-muted">{x.quantum}</td><td className="py-3 pr-3 max-w-xs text-muted">{x.dilution}</td><td className="py-3 pr-3">{x.fit}</td><td className="py-3 max-w-sm text-muted">{x.nextAction}</td></tr>)}</tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Capital ladder" kicker="Evidence-led staged funding">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {FUNDING_LADDER.map((x) => <div key={x.gate} className="rounded-md bg-surface p-4"><p className="text-xs text-accent">{x.gate}</p><p className="mt-2 font-display text-2xl">₹{x.amountLakh}L</p><p className="mt-2 text-sm text-fg">{x.milestone}</p><p className="mt-1 text-xs text-muted">{x.source}</p></div>)}
        </div>
      </Panel>

      <Panel title="Application evidence pack" kicker="Reusable document checklist">
        <div className="grid gap-2 sm:grid-cols-2">
          {FUNDING_DOCUMENTS.map((doc, i) => <div key={doc} className="flex gap-3 rounded-md bg-surface p-3 text-sm"><span className="text-xs text-accent">{String(i + 1).padStart(2, "0")}</span><span className="text-muted">{doc}</span></div>)}
        </div>
      </Panel>

      <div className="rounded-md border border-border p-4 text-xs text-muted">Funding rule: grants first, equity last. Programme quantum, eligibility, deadlines and dilution mechanics marked “Verify current terms” must be checked against the current official notification before any application or financial commitment.</div>
    </div>
  );
}
