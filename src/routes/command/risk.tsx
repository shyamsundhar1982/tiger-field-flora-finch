import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import {
  listCanonicalRiskAuthority,
  transitionRiskRegisterItem,
} from "@/lib/finance-governance-authority";

type Row = Record<string, unknown>;
type RiskStatus = "open" | "mitigating" | "accepted" | "closed";
type RiskForm = { status: RiskStatus; mitigation: string; sourceReference: string };
const text = (row: Row, ...keys: string[]) => { for (const key of keys) if (row[key] != null) return String(row[key]); return ""; };

export const Route = createFileRoute("/command/risk")({ loader: () => listCanonicalRiskAuthority(), component: Risk });

function Risk() {
  const risks = Route.useLoaderData() as Row[];
  const router = useRouter();
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<RiskForm | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const open = risks.filter((row) => text(row,"status") !== "closed").length;
  const highHigh = risks.filter((row) => text(row,"likelihood") === "High" && text(row,"impact") === "High" && text(row,"status") !== "closed").length;

  function beginEdit(row: Row) {
    setEditingId(text(row, "id"));
    setForm({
      status: (text(row, "status") || "open") as RiskStatus,
      mitigation: text(row, "mitigation"),
      sourceReference: text(row, "source_reference", "sourceReference") || "UI:RISK_REGISTER",
    });
  }

  async function save(row: Row) {
    if (!form) return;
    const id = text(row, "id");
    setBusy(id);
    setMessage("");
    try {
      await transitionRiskRegisterItem({
        data: {
          id,
          status: form.status,
          mitigation: form.mitigation,
          sourceReference: form.sourceReference,
        },
      });
      setEditingId("");
      setForm(null);
      setMessage(`${id} updated through canonical Risk authority; audit evidence was appended.`);
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Risk register update failed.");
    } finally {
      setBusy("");
    }
  }

  return <div className="space-y-6">
    <header className="border-b border-border pb-6"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Governance · canonical risk authority</p><h1 className="mt-1 font-display text-4xl text-accent">Risk Register</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">This page reads the persisted VYNDI risk register. Authorised operators can update lifecycle status, mitigation and evidence source here; every change increments the canonical record revision and appends shared audit evidence.</p></header>
    <div className="grid gap-3 sm:grid-cols-3"><Kpi label="Register items" value={String(risks.length)} hint="Canonical risks"/><Kpi label="Open / active" value={String(open)} hint="Not closed" tone={open ? "warn" : "ok"}/><Kpi label="High × High" value={String(highHigh)} hint="Priority exposure" tone={highHigh ? "danger" : "ok"}/></div>
    {message ? <div role="status" className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}
    <Panel title="Canonical Risk Register" kicker="Likelihood · impact · mitigation · governed lifecycle">
      <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3 text-left">Risk</th><th className="px-3 py-3 text-left">L</th><th className="px-3 py-3 text-left">I</th><th className="px-3 py-3 text-left">Mitigation</th><th className="px-3 py-3 text-left">Status</th><th className="px-3 py-3 text-left">Evidence</th><th className="px-3 py-3 text-left">Controls</th></tr></thead><tbody>{risks.map((row) => {
        const id = text(row,"id");
        const editing = editingId === id && form;
        return <Fragment key={id}>
          <tr className="border-t border-border/70 align-top"><td className="px-3 py-3"><p className="font-semibold">{text(row,"risk")}</p><p className="font-mono text-[10px] text-muted">{id}</p></td><td className="px-3 py-3">{text(row,"likelihood")}</td><td className="px-3 py-3">{text(row,"impact")}</td><td className="max-w-md px-3 py-3 text-muted">{text(row,"mitigation")}</td><td className="px-3 py-3 font-semibold uppercase">{text(row,"status")}</td><td className="px-3 py-3 text-xs text-muted">{text(row,"source_reference","sourceReference")}</td><td className="px-3 py-3"><button type="button" disabled={busy === id} onClick={() => beginEdit(row)} className="rounded border border-border px-2.5 py-1.5 text-xs font-semibold hover:border-accent hover:text-accent disabled:opacity-40">Edit control</button></td></tr>
          {editing ? <tr className="border-t border-border/70 bg-surface/60"><td colSpan={7} className="p-4"><div className="grid gap-3 md:grid-cols-[180px_1fr_1fr]"><label className="text-xs font-medium text-muted">Status<select className="control mt-1.5 w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RiskStatus })}><option value="open">Open</option><option value="mitigating">Mitigating</option><option value="accepted">Accepted</option><option value="closed">Closed</option></select></label><label className="text-xs font-medium text-muted">Mitigation<textarea className="control mt-1.5 w-full" rows={3} value={form.mitigation} onChange={(e) => setForm({ ...form, mitigation: e.target.value })}/></label><label className="text-xs font-medium text-muted">Source / evidence<textarea className="control mt-1.5 w-full" rows={3} value={form.sourceReference} onChange={(e) => setForm({ ...form, sourceReference: e.target.value })}/></label></div><div className="mt-3 flex gap-2"><button type="button" disabled={busy === id || !form.mitigation.trim() || !form.sourceReference.trim()} onClick={() => void save(row)} className="rounded bg-accent px-3 py-2 text-xs font-semibold text-bg disabled:opacity-40">Save audited change</button><button type="button" onClick={() => { setEditingId(""); setForm(null); }} className="rounded border border-border px-3 py-2 text-xs font-semibold">Cancel</button></div></td></tr> : null}
        </Fragment>;
      })}</tbody></table></div>
    </Panel>
    <p className="text-xs text-muted">Canonical source: <code>vyndi_risk_register</code>. Risk identity, likelihood and impact remain controlled baseline fields; lifecycle, mitigation and source-evidence changes are written through <code>transitionRiskRegisterItem</code> and appended to <code>vyndi_audit_events</code>.</p>
  </div>;
}
