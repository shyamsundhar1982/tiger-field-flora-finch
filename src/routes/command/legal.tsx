import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Panel } from "@/components/kpi";
import { AGREEMENTS, IP_FILINGS, WARRANTY } from "@/lib/data/legal";
import { COMPANY } from "@/lib/data/company";
import { listGovernanceRegister } from "@/lib/governance-register-authority";
import { saveOperatingActionStatus } from "@/lib/operating-action-authority";

export const Route = createFileRoute("/command/legal")({ component: Legal });

type FilingRow = { id: string; asset: string; type: string; when: string; cost: string | number; note: string; open: boolean };
type AgreementRow = { id: string; order: string | number; name: string; when: string; status: string; open: boolean };
const FILING_PREFIX = "legal-filing:";
const AGREEMENT_PREFIX = "legal-agreement:";
const filingDefaults: FilingRow[] = IP_FILINGS.map((f, i) => ({ id: `IP-${String(i + 1).padStart(2, "0")}`, ...f, open: true }));
const agreementDefaults: AgreementRow[] = AGREEMENTS.map((a, i) => ({ id: `AGR-${String(i + 1).padStart(2, "0")}`, ...a, open: true }));

function Legal() {
  const [filings, setFilings] = useState<FilingRow[]>(filingDefaults);
  const [agreements, setAgreements] = useState<AgreementRow[]>(agreementDefaults);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const [savedFilings, savedAgreements] = await Promise.all([
      listGovernanceRegister({ data: { prefix: FILING_PREFIX } }),
      listGovernanceRegister({ data: { prefix: AGREEMENT_PREFIX } }),
    ]);
    const fMap = Object.fromEntries(savedFilings.map((r) => [r.id, r]));
    const aMap = Object.fromEntries(savedAgreements.map((r) => [r.id, r]));
    setFilings(filingDefaults.map((row) => fMap[row.id] ? ({ ...row, ...fMap[row.id].data, open: fMap[row.id].open } as FilingRow) : row));
    setAgreements(agreementDefaults.map((row) => aMap[row.id] ? ({ ...row, ...aMap[row.id].data, open: aMap[row.id].open } as AgreementRow) : row));
  }
  useEffect(() => { void refresh().catch((e) => setMessage(e instanceof Error ? e.message : "Unable to load legal register.")); }, []);

  async function save(prefix: string, row: FilingRow | AgreementRow, data: Record<string, unknown>) {
    setBusy(`${prefix}${row.id}`); setMessage("");
    try {
      await saveOperatingActionStatus({ data: { actionId: `${prefix}${row.id}`, status: row.open ? "open" : "done", owner: "Legal", note: JSON.stringify(data) } });
      await refresh(); setMessage(`${row.id} saved · control ${row.open ? "OPEN" : "CLOSED"}.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Legal register save failed."); } finally { setBusy(null); }
  }

  return <div className="space-y-6">
    <div><p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Governance register · editable</p><h1 className="font-display text-4xl">IP & legal</h1><p className="mt-2 max-w-2xl text-sm text-muted">{COMPANY.para58Trigger}. ESOP {COMPANY.esopPool}% and founder {COMPANY.founderHold}% at CoI. Register controls are OPEN by default for workflow testing.</p></div>
    {message ? <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}

    <Panel title="Editable filing schedule" kicker={`${filings.filter((r)=>r.open).length}/${filings.length} controls open`}>
      <div className="overflow-x-auto"><table className="w-full min-w-[70rem] text-left text-sm"><thead className="text-[11px] uppercase tracking-[0.14em] text-subtle"><tr><th>Asset</th><th>Type</th><th>When</th><th>₹ L</th><th>Note</th><th>Control</th><th>Save</th></tr></thead><tbody>{filings.map((f)=><tr key={f.id} className="border-t border-border align-top"><td className="py-2 pr-2"><input className="control min-w-48" value={f.asset} onChange={(e)=>setFilings((xs)=>xs.map((x)=>x.id===f.id?{...x,asset:e.target.value}:x))}/><p className="mt-1 text-[10px] text-muted">{f.id}</p></td><td className="pr-2"><input className="control min-w-32" value={f.type} onChange={(e)=>setFilings((xs)=>xs.map((x)=>x.id===f.id?{...x,type:e.target.value}:x))}/></td><td className="pr-2"><input className="control min-w-28" value={f.when} onChange={(e)=>setFilings((xs)=>xs.map((x)=>x.id===f.id?{...x,when:e.target.value}:x))}/></td><td className="pr-2"><input className="control w-24" value={String(f.cost)} onChange={(e)=>setFilings((xs)=>xs.map((x)=>x.id===f.id?{...x,cost:e.target.value}:x))}/></td><td className="pr-2"><input className="control min-w-64" value={f.note} onChange={(e)=>setFilings((xs)=>xs.map((x)=>x.id===f.id?{...x,note:e.target.value}:x))}/></td><td className="pr-2"><button type="button" onClick={()=>setFilings((xs)=>xs.map((x)=>x.id===f.id?{...x,open:!x.open}:x))} className={`rounded-md border px-3 py-2 text-xs font-semibold ${f.open?"border-green/40 bg-green/10 text-green":"border-warn/40 bg-warn/10 text-warn"}`}>{f.open?"OPEN":"CLOSED"}</button></td><td><button type="button" disabled={busy===`${FILING_PREFIX}${f.id}`} onClick={()=>void save(FILING_PREFIX,f,{asset:f.asset,type:f.type,when:f.when,cost:f.cost,note:f.note})} className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-bg disabled:opacity-50">Save</button></td></tr>)}</tbody></table></div>
    </Panel>

    <Panel title="Editable agreement stack" kicker={`${agreements.filter((r)=>r.open).length}/${agreements.length} controls open`}>
      <div className="overflow-x-auto"><table className="w-full min-w-[60rem] text-left text-sm"><thead className="text-[11px] uppercase tracking-[0.14em] text-subtle"><tr><th>#</th><th>Agreement</th><th>When</th><th>Status</th><th>Control</th><th>Save</th></tr></thead><tbody>{agreements.map((a)=><tr key={a.id} className="border-t border-border"><td className="py-2 pr-2"><input className="control w-16" value={String(a.order)} onChange={(e)=>setAgreements((xs)=>xs.map((x)=>x.id===a.id?{...x,order:e.target.value}:x))}/></td><td className="pr-2"><input className="control min-w-72" value={a.name} onChange={(e)=>setAgreements((xs)=>xs.map((x)=>x.id===a.id?{...x,name:e.target.value}:x))}/><p className="mt-1 text-[10px] text-muted">{a.id}</p></td><td className="pr-2"><input className="control min-w-32" value={a.when} onChange={(e)=>setAgreements((xs)=>xs.map((x)=>x.id===a.id?{...x,when:e.target.value}:x))}/></td><td className="pr-2"><input className="control min-w-28" value={a.status} onChange={(e)=>setAgreements((xs)=>xs.map((x)=>x.id===a.id?{...x,status:e.target.value}:x))}/></td><td className="pr-2"><button type="button" onClick={()=>setAgreements((xs)=>xs.map((x)=>x.id===a.id?{...x,open:!x.open}:x))} className={`rounded-md border px-3 py-2 text-xs font-semibold ${a.open?"border-green/40 bg-green/10 text-green":"border-warn/40 bg-warn/10 text-warn"}`}>{a.open?"OPEN":"CLOSED"}</button></td><td><button type="button" disabled={busy===`${AGREEMENT_PREFIX}${a.id}`} onClick={()=>void save(AGREEMENT_PREFIX,a,{order:a.order,name:a.name,when:a.when,status:a.status})} className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-bg disabled:opacity-50">Save</button></td></tr>)}</tbody></table></div>
    </Panel>

    <Panel title="Warranty — reference"><dl className="grid gap-3 text-sm sm:grid-cols-2">{Object.entries(WARRANTY).map(([k,v])=><div key={k} className="rounded-md bg-surface p-4"><dt className="capitalize text-accent">{k}</dt><dd className="mt-1 text-muted">{v}</dd></div>)}</dl></Panel>
  </div>;
}
