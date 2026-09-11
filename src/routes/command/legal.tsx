import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import {
  listCanonicalLegalAuthority,
  transitionLegalRegisterItem,
} from "@/lib/finance-governance-authority";

type Row = Record<string, unknown>;
type LegalStatus = "planned" | "in_progress" | "filed" | "executed" | "active" | "closed" | "superseded";
type LegalForm = { status: LegalStatus; notes: string; sourceReference: string };
const text = (row: Row, ...keys: string[]) => { for (const key of keys) if (row[key] != null) return String(row[key]); return ""; };
const num = (row: Row, ...keys: string[]) => { for (const key of keys) if (row[key] != null) return Number(row[key]) || 0; return 0; };

export const Route = createFileRoute("/command/legal")({ loader: () => listCanonicalLegalAuthority(), component: Legal });

function Legal() {
  const register = Route.useLoaderData() as Row[];
  const router = useRouter();
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<LegalForm | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const critical = register.filter((row) => text(row,"priority") === "Critical" && !["filed","executed","active","closed"].includes(text(row,"status"))).length;
  const ip = register.filter((row) => text(row,"register_type","registerType") === "ip").length;
  const agreements = register.filter((row) => text(row,"register_type","registerType") === "agreement").length;
  const plannedCost = register.reduce((sum,row) => sum + num(row,"cost_lakh","costLakh"),0);

  function beginEdit(row: Row) {
    setEditingId(text(row, "id"));
    setForm({
      status: (text(row, "status") || "planned") as LegalStatus,
      notes: text(row, "notes"),
      sourceReference: text(row, "source_reference", "sourceReference") || "UI:LEGAL_REGISTER",
    });
  }

  async function save(row: Row) {
    if (!form) return;
    const id = text(row, "id");
    setBusy(id);
    setMessage("");
    try {
      await transitionLegalRegisterItem({
        data: {
          id,
          status: form.status,
          notes: form.notes,
          sourceReference: form.sourceReference,
        },
      });
      setEditingId("");
      setForm(null);
      setMessage(`${id} updated through canonical Legal authority; audit evidence was appended.`);
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Legal register update failed.");
    } finally {
      setBusy("");
    }
  }

  return <div className="space-y-6">
    <header className="border-b border-border pb-6"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Governance · canonical legal/IP authority</p><h1 className="mt-1 font-display text-4xl text-accent">Legal & IP Register</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">IP filings, agreements, insurance and compliance obligations come from the persisted Legal register. Authorised operators can update lifecycle status, notes and evidence source here; every change increments the canonical revision and appends shared audit evidence.</p></header>
    <div className="grid gap-3 sm:grid-cols-4"><Kpi label="Register items" value={String(register.length)} hint="Canonical obligations"/><Kpi label="IP items" value={String(ip)} hint="Patent / design / marks"/><Kpi label="Agreements" value={String(agreements)} hint="Controlled legal stack"/><Kpi label="Critical open" value={String(critical)} hint={`Baseline cost ₹${plannedCost.toFixed(2)}L`} tone={critical ? "warn" : "ok"}/></div>
    {message ? <div role="status" className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}
    <Panel title="Canonical Legal / IP Register" kicker="Source-referenced lifecycle authority · audited controls">
      <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3 text-left">Subject</th><th className="px-3 py-3 text-left">Type</th><th className="px-3 py-3 text-left">Instrument</th><th className="px-3 py-3 text-left">Timing</th><th className="px-3 py-3 text-left">Priority</th><th className="px-3 py-3 text-left">Status</th><th className="px-3 py-3 text-left">Evidence</th><th className="px-3 py-3 text-left">Controls</th></tr></thead><tbody>{register.map((row) => {
        const id = text(row,"id");
        const editing = editingId === id && form;
        return <div key={id} style={{ display: "contents" }}>
          <tr className="border-t border-border/70 align-top"><td className="px-3 py-3"><p className="font-semibold">{text(row,"subject")}</p><p className="font-mono text-[10px] text-muted">{id}</p></td><td className="px-3 py-3 uppercase">{text(row,"register_type","registerType")}</td><td className="px-3 py-3">{text(row,"instrument")}</td><td className="px-3 py-3 text-muted">{text(row,"target_timing","targetTiming") || "—"}</td><td className={text(row,"priority") === "Critical" ? "px-3 py-3 font-semibold text-warn" : "px-3 py-3"}>{text(row,"priority")}</td><td className="px-3 py-3 font-semibold uppercase">{text(row,"status")}</td><td className="px-3 py-3 text-xs text-muted">{text(row,"source_reference","sourceReference")}</td><td className="px-3 py-3"><button type="button" disabled={busy === id} onClick={() => beginEdit(row)} className="rounded border border-border px-2.5 py-1.5 text-xs font-semibold hover:border-accent hover:text-accent disabled:opacity-40">Edit control</button></td></tr>
          {editing ? <tr className="border-t border-border/70 bg-surface/60"><td colSpan={8} className="p-4"><div className="grid gap-3 md:grid-cols-[200px_1fr_1fr]"><label className="text-xs font-medium text-muted">Status<select className="control mt-1.5 w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as LegalStatus })}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="filed">Filed</option><option value="executed">Executed</option><option value="active">Active</option><option value="closed">Closed</option><option value="superseded">Superseded</option></select></label><label className="text-xs font-medium text-muted">Notes<textarea className="control mt-1.5 w-full" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}/></label><label className="text-xs font-medium text-muted">Source / evidence<textarea className="control mt-1.5 w-full" rows={3} value={form.sourceReference} onChange={(e) => setForm({ ...form, sourceReference: e.target.value })}/></label></div><div className="mt-3 flex gap-2"><button type="button" disabled={busy === id || !form.sourceReference.trim()} onClick={() => void save(row)} className="rounded bg-accent px-3 py-2 text-xs font-semibold text-bg disabled:opacity-40">Save audited change</button><button type="button" onClick={() => { setEditingId(""); setForm(null); }} className="rounded border border-border px-3 py-2 text-xs font-semibold">Cancel</button></div></td></tr> : null}
        </div>;
      })}</tbody></table></div>
    </Panel>
    <p className="text-xs text-muted">Canonical source: <code>vyndi_legal_register</code>. Legal subject, type, instrument, timing and priority remain controlled baseline fields; lifecycle, notes and source-evidence changes are written through <code>transitionLegalRegisterItem</code> and appended to <code>vyndi_audit_events</code>.</p>
  </div>;
}
