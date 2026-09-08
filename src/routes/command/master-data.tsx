import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MASTER_DATA_DOMAINS, MASTER_DATA_STATUS_LABELS, type MasterDataRecord, type MasterDataStatus } from "@/lib/master-data";
import { importLegacyInventoryAsDrafts, listMasterData, listMasterDataAudit, transitionMasterData } from "@/lib/master-data-actions";

export const Route = createFileRoute("/command/master-data")({ component: MasterDataEngine });

const statusOrder: MasterDataStatus[] = ["draft", "pending_approval", "approved", "superseded"];
function asArray<T>(value: unknown): T[] { return Array.isArray(value) ? (value as T[]) : []; }

function MasterDataEngine() {
  const [records, setRecords] = useState<MasterDataRecord[]>([]);
  const [audit, setAudit] = useState<Array<Record<string, string | null>>>([]);
  const [status, setStatus] = useState<MasterDataStatus | "all">("all");
  const [domain, setDomain] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const [rows, events] = await Promise.all([listMasterData(), listMasterDataAudit()]);
      const nextRecords = asArray<MasterDataRecord>(rows);
      const nextAudit = asArray<Record<string, string | null>>(events);
      setRecords(nextRecords); setAudit(nextAudit); return { records: nextRecords, audit: nextAudit };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Master data refresh failed.");
      return { records: [], audit: [] };
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const filtered = useMemo(() => records.filter((r) => (domain === "all" || r.domain === domain) && (status === "all" || r.status === status)), [records, domain, status]);
  const approved = records.filter((r) => r.status === "approved").length;
  const pending = records.filter((r) => r.status === "pending_approval").length;
  const inventoryDrafts = records.filter((r) => r.domain === "inventory" && r.status === "draft").length;

  async function move(id: string, toStatus: MasterDataStatus) {
    setError("");
    try { await transitionMasterData({ data: { id, toStatus, note: `Phase M control action: ${toStatus}` } }); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Master data transition failed."); }
  }

  async function importLegacyCatalogue() {
    if (importing) return;
    setImporting(true); setError(""); setMessage("");
    try {
      const result = await importLegacyInventoryAsDrafts();
      const refreshed = await refresh();
      setMessage(`Legacy catalogue bridge complete: ${result.created} new draft inventory records created; ${result.existing} already present. ${refreshed.records.length} master records are now visible. Nothing was approved or posted.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Legacy catalogue import failed."); }
    finally { setImporting(false); }
  }

  return <div className="space-y-6">
    <header><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-subtle">VINDY · PHASE M</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Master Data Engine</h1><p className="mt-2 max-w-4xl text-sm text-muted">Controlled source of truth for product, BOM, materials, suppliers, prices, inventory, processes, quality, EPR, finance and documents. Every record is revisioned and must be approved before it is operationally usable.</p></header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[{label:"Records",value:records.length},{label:"Approved",value:approved},{label:"Pending approval",value:pending},{label:"Inventory drafts",value:inventoryDrafts},{label:"Domains",value:MASTER_DATA_DOMAINS.length}].map((x)=><div key={x.label} className="rounded-lg border border-border bg-surface/40 p-4"><p className="text-[10px] uppercase tracking-[0.18em] text-subtle">{x.label}</p><p className="mt-2 text-2xl font-semibold">{x.value}</p></div>)}</section>
    <section className="rounded-lg border border-border bg-surface/30 p-4"><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[0.16em]">Legacy component catalogue bridge</p><p className="mt-1 max-w-3xl text-xs leading-5 text-muted">The old <code>SEED_INVENTORY</code> catalogue is reference data only. This creates Inventory Master draft candidates; it does not approve them, create BOM mappings, or post inventory.</p></div><button disabled={importing} onClick={() => void importLegacyCatalogue()} className="rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold disabled:opacity-50">{importing ? "Creating drafts…" : "Create draft candidates"}</button></div>{message && <p className="mt-3 rounded border border-border px-3 py-2 text-xs">{message}</p>}{error && <p className="mt-3 rounded border border-warn/40 px-3 py-2 text-xs text-warn">{error}</p>}</section>
    <section className="rounded-lg border border-border p-4"><div className="flex flex-wrap gap-3"><select value={domain} onChange={(e)=>setDomain(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm"><option value="all">All domains</option>{MASTER_DATA_DOMAINS.map((d)=><option key={d.domain} value={d.domain}>{d.label}</option>)}</select><select value={status} onChange={(e)=>setStatus(e.target.value as MasterDataStatus|"all")} className="rounded-md border border-border bg-background px-3 py-2 text-sm"><option value="all">All statuses</option>{statusOrder.map((s)=><option key={s} value={s}>{MASTER_DATA_STATUS_LABELS[s]}</option>)}</select><span className="ml-auto self-center text-xs text-muted">{loading ? "Loading…" : `${filtered.length} records shown`}</span></div></section>
    <section className="rounded-lg border border-border p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em]">Master Register</p><p className="mt-1 text-[11px] text-muted">Approval is always visible on the card; no horizontal table scrolling.</p></div>{pending ? <span className="rounded-full border border-warn/40 px-3 py-1 text-xs font-semibold text-warn">{pending} awaiting approval</span> : null}</div>{filtered.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((r)=><article key={r.id} className="rounded-xl border border-border bg-surface/30 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-medium text-fg">{r.code}</p><p className="mt-1 text-xs text-muted">{r.name}</p></div><span className="shrink-0 rounded border border-border px-2 py-1 text-[9px] font-semibold uppercase">{MASTER_DATA_STATUS_LABELS[r.status]}</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-xs"><Mini label="Domain" value={r.domain}/><Mini label="Revision" value={`R${r.revision}`}/><Mini label="Authority" value={`${r.ownerRole} → ${r.approverRole}`}/></div><div className="mt-4 border-t border-border/70 pt-3">{r.status==="draft"?<Action onClick={()=>void move(r.id,"pending_approval")}>Submit for approval</Action>:r.status==="pending_approval"?<Action primary onClick={()=>void move(r.id,"approved")}>Approve record</Action>:r.status==="approved"?<Action onClick={()=>void move(r.id,"superseded")}>Supersede</Action>:<span className="text-xs text-subtle">Historical / superseded record</span>}</div></article>)}</div>:<p className="py-8 text-center text-sm text-muted">No records match the current filters.</p>}</section>
    <section className="rounded-lg border border-border p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.16em]">Recent Master Data Audit</p><span className="text-xs text-muted">{audit.length} events</span></div><div className="mt-3 space-y-2">{audit.slice(0,8).map((e)=><div key={String(e.id)} className="flex flex-wrap gap-x-3 gap-y-1 rounded border border-border/60 px-3 py-2 text-xs"><span className="font-medium">{String(e.event_type)}</span><span className="text-muted">{String(e.actor_role)}</span><span>{e.from_status??"—"} → {e.to_status??"—"}</span><span className="ml-auto text-muted">{String(e.created_at)}</span></div>)}{!audit.length&&<p className="text-sm text-muted">No audit events yet.</p>}</div></section>
    <div className="rounded-lg border border-border bg-surface/30 p-4 text-xs text-muted"><strong className="text-fg">Operational rule:</strong> downstream transactions reference approved master-data revisions. Changes create a new revision rather than silently rewriting historical business state.</div>
  </div>;
}
function Mini({label,value}:{label:string;value:string}){return <div><p className="text-[9px] uppercase tracking-wider text-subtle">{label}</p><p className="mt-1 break-words font-semibold text-fg">{value}</p></div>;}
function Action({children,onClick,primary=false}:{children:React.ReactNode;onClick:()=>void;primary?:boolean}){return <button onClick={onClick} className={primary?"w-full rounded-md bg-accent px-3 py-2 text-xs font-semibold text-bg":"w-full rounded-md border border-border px-3 py-2 text-xs font-semibold hover:border-accent"}>{children}</button>;}
