import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { DILUTION } from "@/lib/data/legal";
import { SCENARIOS } from "@/lib/finance/model";
import { lakh, pct } from "@/lib/format";
import { listGovernanceRegister } from "@/lib/governance-register-authority";
import { saveOperatingActionStatus } from "@/lib/operating-action-authority";

export const Route = createFileRoute("/command/risk")({ component: Risk });

type RiskRow = { id: string; risk: string; like: string; impact: string; mit: string; open: boolean };
const defaults: RiskRow[] = [
  ["RISK-01", "Grant delay 3–6 months", "High", "High", "Standby CN ₹25–40 L, cap ₹5 Cr"],
  ["RISK-02", "OEM quality / schedule", "Med", "High", "Dual qualify + factory visit + QC gates"],
  ["RISK-03", "ISO first-pass fail", "Med", "High", "FEA first, ₹2 L retest, tooling only after pass"],
  ["RISK-04", "IP leakage to OEM", "Med", "High", "Provisional at M3, staged CAD, tooling ownership"],
  ["RISK-05", "Early cheap equity", "Med", "High", "Grants + CN until ₹85 L / ISO"],
  ["RISK-06", "M10–M11 cash gap", "High", "High", "T4 at M10 + standby drawn if needed"],
  ["RISK-07", "Founder incapacity", "Low", "High", "Key-person insurance quotes in M1"],
  ["RISK-08", "HS / customs miss", "Med", "Med", "CHA + CA confirm before price list"],
  ["RISK-09", "Product liability", "Low", "High", "Bind insurance before first delivery"],
  ["RISK-10", "BIS (if ever e-bike)", "Low", "High", "Mechanical bikes likely out of scope — verify"],
].map(([id, risk, like, impact, mit]) => ({ id, risk, like, impact, mit, open: true }));
const PREFIX = "risk-register:";

function Risk() {
  const [rows, setRows] = useState<RiskRow[]>(defaults);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  async function refresh() {
    const saved = await listGovernanceRegister({ data: { prefix: PREFIX } });
    const map = Object.fromEntries(saved.map((r) => [r.id, r]));
    setRows(defaults.map((row) => {
      const s = map[row.id];
      return s ? { ...row, ...s.data, open: s.open } as RiskRow : row;
    }));
  }
  useEffect(() => { void refresh().catch((e) => setMessage(e instanceof Error ? e.message : "Unable to load risk register.")); }, []);
  function edit(id: string, patch: Partial<RiskRow>) { setRows((current) => current.map((r) => r.id === id ? { ...r, ...patch } : r)); }
  async function save(row: RiskRow) {
    setBusy(row.id); setMessage("");
    try {
      await saveOperatingActionStatus({ data: { actionId: `${PREFIX}${row.id}`, status: row.open ? "open" : "done", owner: "Risk", note: JSON.stringify({ risk: row.risk, like: row.like, impact: row.impact, mit: row.mit }) } });
      await refresh(); setMessage(`${row.id} saved · control ${row.open ? "OPEN" : "CLOSED"}.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Risk save failed."); } finally { setBusy(null); }
  }
  return <div className="space-y-6">
    <div><p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Governance register · editable</p><h1 className="font-display text-4xl">Risk & dilution</h1><p className="mt-2 text-sm text-muted">Risk controls are OPEN by default for workflow testing. Closing a control is deliberate enforcement; editing a row does not alter append-only audit history.</p></div>
    {message ? <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}
    <div className="grid gap-3 sm:grid-cols-3">{(Object.keys(SCENARIOS) as Array<keyof typeof SCENARIOS>).map((id) => { const s = SCENARIOS[id]; return <Kpi key={id} label={`${s.label} · ${s.probability}`} value={s.extra ? `+${lakh(s.extra, 0)}` : "₹2.00 Cr"} hint={s.note} tone={id === "stress" ? "danger" : id === "delayed" ? "warn" : "ok"} />; })}</div>
    <Panel title="Editable risk register" kicker={`${rows.filter((r) => r.open).length}/${rows.length} controls open`}>
      <div className="overflow-x-auto"><table className="w-full min-w-[70rem] text-left text-sm"><thead className="text-[11px] uppercase tracking-[0.14em] text-subtle"><tr><th className="py-2">Risk</th><th>L</th><th>I</th><th>Mitigation</th><th>Control</th><th>Save</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id} className="border-t border-border align-top"><td className="py-2 pr-2"><input className="control min-w-64" value={r.risk} onChange={(e) => edit(r.id,{risk:e.target.value})}/><p className="mt-1 text-[10px] text-muted">{r.id}</p></td><td className="pr-2"><input className="control w-24" value={r.like} onChange={(e)=>edit(r.id,{like:e.target.value})}/></td><td className="pr-2"><input className="control w-24" value={r.impact} onChange={(e)=>edit(r.id,{impact:e.target.value})}/></td><td className="pr-2"><input className="control min-w-80" value={r.mit} onChange={(e)=>edit(r.id,{mit:e.target.value})}/></td><td className="pr-2"><button type="button" onClick={()=>edit(r.id,{open:!r.open})} className={`rounded-md border px-3 py-2 text-xs font-semibold ${r.open?"border-green/40 bg-green/10 text-green":"border-warn/40 bg-warn/10 text-warn"}`}>{r.open?"OPEN":"CLOSED"}</button></td><td><button type="button" disabled={busy===r.id} onClick={()=>void save(r)} className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-bg disabled:opacity-50">Save</button></td></tr>)}</tbody></table></div>
    </Panel>
    <Panel title="Cap table — target path" kicker="ESOP 10% created at incorporation"><div className="overflow-x-auto"><table className="w-full min-w-[44rem] text-left text-sm"><thead className="text-[11px] uppercase tracking-[0.14em] text-subtle"><tr>{["Round","₹ L","Pre","Founder","ESOP","Investor","Note"].map((h)=><th key={h} className="py-2 font-medium">{h}</th>)}</tr></thead><tbody>{DILUTION.map((d)=><tr key={d.round} className="border-t border-border"><td className="py-2">{d.round}</td><td>{d.capital}</td><td>{d.pre?lakh(d.pre,0):"—"}</td><td>{pct(d.founder,1)}</td><td>{pct(d.esop,1)}</td><td>{pct(d.investor,1)}</td><td className="text-muted">{d.note}</td></tr>)}</tbody></table></div></Panel>
  </div>;
}
