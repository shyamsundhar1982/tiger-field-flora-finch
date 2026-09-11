import { createFileRoute } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { listCanonicalRiskAuthority } from "@/lib/finance-governance-authority";

type Row = Record<string, unknown>;
const text = (row: Row, ...keys: string[]) => { for (const key of keys) if (row[key] != null) return String(row[key]); return ""; };

export const Route = createFileRoute("/command/risk")({ loader: () => listCanonicalRiskAuthority(), component: Risk });

function Risk() {
  const risks = Route.useLoaderData() as Row[];
  const open = risks.filter((row) => text(row,"status") !== "closed").length;
  const highHigh = risks.filter((row) => text(row,"likelihood") === "High" && text(row,"impact") === "High" && text(row,"status") !== "closed").length;
  return <div className="space-y-6">
    <header className="border-b border-border pb-6"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Governance · canonical risk authority</p><h1 className="mt-1 font-display text-4xl text-accent">Risk Register</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">This page reads the persisted VYNDI risk register. The former in-component static array is retained only as migrated baseline evidence, not as an alternate source.</p></header>
    <div className="grid gap-3 sm:grid-cols-3"><Kpi label="Register items" value={String(risks.length)} hint="Canonical risks"/><Kpi label="Open / active" value={String(open)} hint="Not closed" tone={open ? "warn" : "ok"}/><Kpi label="High × High" value={String(highHigh)} hint="Priority exposure" tone={highHigh ? "danger" : "ok"}/></div>
    <Panel title="Canonical Risk Register" kicker="Likelihood · impact · mitigation · lifecycle"><div className="overflow-x-auto"><table className="w-full min-w-[950px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3 text-left">Risk</th><th className="px-3 py-3 text-left">L</th><th className="px-3 py-3 text-left">I</th><th className="px-3 py-3 text-left">Mitigation</th><th className="px-3 py-3 text-left">Status</th><th className="px-3 py-3 text-left">Evidence</th></tr></thead><tbody>{risks.map((row) => <tr key={text(row,"id")} className="border-t border-border/70 align-top"><td className="px-3 py-3"><p className="font-semibold">{text(row,"risk")}</p><p className="font-mono text-[10px] text-muted">{text(row,"id")}</p></td><td className="px-3 py-3">{text(row,"likelihood")}</td><td className="px-3 py-3">{text(row,"impact")}</td><td className="px-3 py-3 text-muted">{text(row,"mitigation")}</td><td className="px-3 py-3 font-semibold uppercase">{text(row,"status")}</td><td className="px-3 py-3 text-xs text-muted">{text(row,"source_reference","sourceReference")}</td></tr>)}</tbody></table></div></Panel>
    <p className="text-xs text-muted">Canonical source: <code>vyndi_risk_register</code>. Status/mitigation changes are available through the governed Finance & Governance authority service and append audit evidence.</p>
  </div>;
}
