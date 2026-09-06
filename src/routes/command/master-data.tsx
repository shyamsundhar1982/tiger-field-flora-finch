import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MASTER_DATA_DOMAINS, MASTER_DATA_STATUS_LABELS, type MasterDataRecord, type MasterDataStatus } from "@/lib/master-data";
import { listMasterData, listMasterDataAudit, transitionMasterData } from "@/lib/master-data-actions";

export const Route = createFileRoute("/command/master-data")({ component: MasterDataEngine });

const statusOrder: MasterDataStatus[] = ["draft", "pending_approval", "approved", "superseded"];

function MasterDataEngine() {
  const [records, setRecords] = useState<MasterDataRecord[]>([]);
  const [audit, setAudit] = useState<Array<Record<string, string | null>>>([]);
  const [status, setStatus] = useState<MasterDataStatus | "all">("all");
  const [domain, setDomain] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [rows, events] = await Promise.all([listMasterData(), listMasterDataAudit()]);
      setRecords(rows as MasterDataRecord[]);
      setAudit(events as Array<Record<string, string | null>>);
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const filtered = useMemo(() => records.filter(r => (domain === "all" || r.domain === domain) && (status === "all" || r.status === status)), [records, domain, status]);
  const approved = records.filter(r => r.status === "approved").length;
  const pending = records.filter(r => r.status === "pending_approval").length;

  async function move(id: string, toStatus: MasterDataStatus) {
    await transitionMasterData({ data: { id, toStatus, note: `Phase M control action: ${toStatus}` } });
    await refresh();
  }

  return <div className="space-y-6">
    <header>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-subtle">VINDY · PHASE M</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Master Data Engine</h1>
      <p className="mt-2 max-w-4xl text-sm text-muted">Controlled source of truth for product, BOM, materials, suppliers, prices, inventory, processes, quality, EPR, finance and documents. Every record is revisioned and must be approved before it is operationally usable.</p>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[{label:"Records",value:records.length},{label:"Approved",value:approved},{label:"Pending approval",value:pending},{label:"Domains",value:MASTER_DATA_DOMAINS.length}].map(x=><div key={x.label} className="rounded-lg border border-border bg-surface/40 p-4"><p className="text-[10px] uppercase tracking-[0.18em] text-subtle">{x.label}</p><p className="mt-2 text-2xl font-semibold">{x.value}</p></div>)}
    </section>

    <section className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap gap-3">
        <select value={domain} onChange={e => setDomain(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm"><option value="all">All domains</option>{MASTER_DATA_DOMAINS.map(d=><option key={d.domain} value={d.domain}>{d.label}</option>)}</select>
        <select value={status} onChange={e => setStatus(e.target.value as MasterDataStatus | "all")} className="rounded-md border border-border bg-background px-3 py-2 text-sm"><option value="all">All statuses</option>{statusOrder.map(s=><option key={s} value={s}>{MASTER_DATA_STATUS_LABELS[s]}</option>)}</select>
        <span className="ml-auto self-center text-xs text-muted">{loading ? "Loading…" : `${filtered.length} records shown`}</span>
      </div>
    </section>

    <section className="overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-surface/40 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-[0.16em]">Master Register</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle"><tr><th className="px-4 py-3">Code / Name</th><th className="px-4 py-3">Domain</th><th className="px-4 py-3">Rev</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Owner → Approver</th><th className="px-4 py-3">Control</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id} className="border-b border-border last:border-0"><td className="px-4 py-3"><div className="font-medium">{r.code}</div><div className="text-xs text-muted">{r.name}</div></td><td className="px-4 py-3 capitalize">{r.domain}</td><td className="px-4 py-3">R{r.revision}</td><td className="px-4 py-3"><span className="rounded border border-border px-2 py-1 text-[10px] font-semibold uppercase">{MASTER_DATA_STATUS_LABELS[r.status]}</span></td><td className="px-4 py-3 text-xs">{r.ownerRole} → {r.approverRole}</td><td className="px-4 py-3"><div className="flex gap-2">{r.status === "draft" && <button onClick={() => void move(r.id, "pending_approval")} className="rounded border border-border px-2 py-1 text-xs">Submit</button>}{r.status === "pending_approval" && <button onClick={() => void move(r.id, "approved")} className="rounded border border-border px-2 py-1 text-xs">Approve</button>}{r.status === "approved" && <button onClick={() => void move(r.id, "superseded")} className="rounded border border-border px-2 py-1 text-xs">Supersede</button>}</div></td></tr>)}{!filtered.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">No master records yet. Phase M schema is ready for controlled data onboarding.</td></tr>}</tbody></table></div>
    </section>

    <section className="rounded-lg border border-border p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.16em]">Recent Master Data Audit</p><span className="text-xs text-muted">{audit.length} events</span></div><div className="mt-3 space-y-2">{audit.slice(0, 8).map(e=><div key={String(e.id)} className="flex flex-wrap gap-x-3 gap-y-1 rounded border border-border/60 px-3 py-2 text-xs"><span className="font-medium">{String(e.event_type)}</span><span className="text-muted">{String(e.actor_role)}</span><span>{e.from_status ?? "—"} → {e.to_status ?? "—"}</span><span className="ml-auto text-muted">{String(e.created_at)}</span></div>)}{!audit.length && <p className="text-sm text-muted">No audit events yet.</p>}</div></section>

    <div className="rounded-lg border border-border bg-surface/30 p-4 text-xs text-muted"><strong className="text-fg">Operational rule:</strong> downstream transactions should reference an approved master-data revision. Changes create a new revision rather than silently rewriting historical business state.</div>
  </div>;
}
