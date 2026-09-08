import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MASTER_DATA_DOMAINS, MASTER_DATA_STATUS_LABELS, type MasterDataRecord, type MasterDataStatus } from "@/lib/master-data";
import { bulkApproveMasterData, importLegacyInventoryAsDrafts, listMasterData, listMasterDataAudit, transitionMasterData } from "@/lib/master-data-actions";

export const Route = createFileRoute("/command/master-data")({ component: MasterDataEngine });

const statusOrder: MasterDataStatus[] = ["draft", "pending_approval", "approved", "superseded"];
function asArray<T>(value: unknown): T[] { return Array.isArray(value) ? (value as T[]) : []; }

function MasterDataEngine() {
  const [records, setRecords] = useState<MasterDataRecord[]>([]);
  const [audit, setAudit] = useState<Array<Record<string, string | null>>>([]);
  const [status, setStatus] = useState<MasterDataStatus | "all">("all");
  const [domain, setDomain] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const [rows, events] = await Promise.all([listMasterData(), listMasterDataAudit()]);
      const nextRecords = asArray<MasterDataRecord>(rows);
      const nextAudit = asArray<Record<string, string | null>>(events);
      setRecords(nextRecords);
      setAudit(nextAudit);
      setSelectedIds((current) => current.filter((id) => nextRecords.some((record) => record.id === id && record.status === "pending_approval")));
      return { records: nextRecords, audit: nextAudit };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Master data refresh failed.");
      return { records: [], audit: [] };
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { setSelectedIds([]); }, [domain, status]);

  const filtered = useMemo(() => records.filter((r) => (domain === "all" || r.domain === domain) && (status === "all" || r.status === status)), [records, domain, status]);
  const pendingShown = useMemo(() => filtered.filter((record) => record.status === "pending_approval"), [filtered]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedPending = useMemo(() => pendingShown.filter((record) => selectedSet.has(record.id)), [pendingShown, selectedSet]);
  const allPendingShownSelected = pendingShown.length > 0 && selectedPending.length === pendingShown.length;
  const approved = records.filter((r) => r.status === "approved").length;
  const pending = records.filter((r) => r.status === "pending_approval").length;
  const inventoryDrafts = records.filter((r) => r.domain === "inventory" && r.status === "draft").length;

  async function move(id: string, toStatus: MasterDataStatus) {
    setError("");
    setMessage("");
    try {
      await transitionMasterData({ data: { id, toStatus, note: `Phase M control action: ${toStatus}` } });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Master data transition failed."); }
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((current) => checked ? [...new Set([...current, id])] : current.filter((value) => value !== id));
  }

  function toggleAllPendingShown(checked: boolean) {
    setSelectedIds(checked ? pendingShown.map((record) => record.id) : []);
  }

  async function approveSelected() {
    const ids = selectedPending.map((record) => record.id);
    if (!ids.length || bulkApproving) return;
    setBulkApproving(true);
    setError("");
    setMessage("");
    try {
      const result = await bulkApproveMasterData({ data: { ids, note: `Master Data Engine bulk approval: ${ids.length} selected record(s)` } });
      setSelectedIds([]);
      await refresh();
      setMessage(`${result.approved} selected master-data record${result.approved === 1 ? "" : "s"} approved. Each approval was written to the audit trail.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Bulk master data approval failed."); }
    finally { setBulkApproving(false); }
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
    <section className="rounded-lg border border-border bg-surface/30 p-4"><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[0.16em]">Legacy component catalogue bridge</p><p className="mt-1 max-w-3xl text-xs leading-5 text-muted">The old <code>SEED_INVENTORY</code> catalogue is reference data only. This creates Inventory Master draft candidates; it does not approve them, create BOM mappings, or post inventory.</p></div><button disabled={importing} onClick={() => void importLegacyCatalogue()} className="rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold disabled:opacity-50">{importing ? "Creating drafts…" : "Create draft candidates"}</button></div></section>
    <section className="rounded-lg border border-border p-4"><div className="flex flex-wrap items-center gap-3"><select value={domain} onChange={(e)=>setDomain(e.target.value)} className="min-w-44 rounded-md border border-border bg-background px-3 py-2 text-sm"><option value="all">All domains</option>{MASTER_DATA_DOMAINS.map((d)=><option key={d.domain} value={d.domain}>{d.label}</option>)}</select><select value={status} onChange={(e)=>setStatus(e.target.value as MasterDataStatus|"all")} className="min-w-44 rounded-md border border-border bg-background px-3 py-2 text-sm"><option value="all">All statuses</option>{statusOrder.map((s)=><option key={s} value={s}>{MASTER_DATA_STATUS_LABELS[s]}</option>)}</select><span className="ml-auto self-center text-xs text-muted">{loading ? "Loading…" : `${filtered.length} records shown`}</span></div></section>
    {message ? <div role="status" className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}
    {error ? <div role="alert" className="rounded-lg border border-warn/40 bg-warn/5 px-4 py-3 text-sm text-warn">{error}</div> : null}
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em]">Master Register</p><p className="mt-1 text-[11px] text-muted">Compact list fitted to the workspace. Select pending rows and approve them together without horizontal scrolling.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {pending ? <span className="rounded-full border border-warn/40 px-3 py-1.5 text-xs font-semibold text-warn">{pending} awaiting approval</span> : null}
          <button type="button" disabled={!pendingShown.length || bulkApproving} onClick={()=>toggleAllPendingShown(true)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40">Select pending shown</button>
          <button type="button" disabled={!selectedIds.length || bulkApproving} onClick={()=>setSelectedIds([])} className="rounded-md border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40">Clear</button>
          <button type="button" disabled={!selectedPending.length || bulkApproving} onClick={()=>void approveSelected()} className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-bg disabled:opacity-40">{bulkApproving ? "Approving…" : `Approve selected (${selectedPending.length})`}</button>
        </div>
      </div>
      {filtered.length ? <div className="max-h-[68vh] overflow-y-auto rounded-lg border border-border/80">
        <div className="sticky top-0 z-10 hidden grid-cols-[2rem_minmax(0,2.1fr)_minmax(6rem,.75fr)_4rem_minmax(8rem,1fr)_minmax(7rem,.8fr)_9rem] items-center gap-3 border-b border-border bg-background/95 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-subtle backdrop-blur lg:grid">
          <input type="checkbox" aria-label="Select all pending records shown" checked={allPendingShownSelected} disabled={!pendingShown.length} onChange={(e)=>toggleAllPendingShown(e.target.checked)} className="size-4 accent-current" />
          <span>Record</span><span>Domain</span><span>Rev</span><span>Authority</span><span>Status</span><span className="text-right">Action</span>
        </div>
        <div className="divide-y divide-border/70">{filtered.map((r)=><article key={r.id} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-3 py-3 transition-colors hover:bg-surface/30 lg:grid-cols-[2rem_minmax(0,2.1fr)_minmax(6rem,.75fr)_4rem_minmax(8rem,1fr)_minmax(7rem,.8fr)_9rem] lg:items-center">
          <div className="pt-0.5 lg:pt-0"><input type="checkbox" aria-label={`Select ${r.code}`} checked={selectedSet.has(r.id)} disabled={r.status !== "pending_approval" || bulkApproving} onChange={(e)=>toggleSelected(r.id,e.target.checked)} className="size-4 accent-current disabled:opacity-25" title={r.status === "pending_approval" ? "Select for bulk approval" : "Only pending-approval records can be selected"} /></div>
          <div className="min-w-0"><p className="break-words font-mono text-xs font-semibold text-fg">{r.code}</p><p className="mt-0.5 break-words text-xs leading-5 text-muted">{r.name}</p></div>
          <ListCell label="Domain"><span className="capitalize">{r.domain}</span></ListCell>
          <ListCell label="Revision"><span className="font-mono">R{r.revision}</span></ListCell>
          <ListCell label="Authority"><span className="break-words">{r.ownerRole} → {r.approverRole}</span></ListCell>
          <ListCell label="Status"><span className={`inline-flex rounded border px-2 py-1 text-[9px] font-semibold uppercase ${r.status === "pending_approval" ? "border-warn/40 text-warn" : r.status === "approved" ? "border-green/40 text-green" : "border-border text-muted"}`}>{MASTER_DATA_STATUS_LABELS[r.status]}</span></ListCell>
          <div className="col-start-2 lg:col-auto lg:text-right">{r.status==="draft"?<RowAction onClick={()=>void move(r.id,"pending_approval")}>Submit</RowAction>:r.status==="pending_approval"?<RowAction primary onClick={()=>void move(r.id,"approved")}>Approve</RowAction>:r.status==="approved"?<RowAction onClick={()=>void move(r.id,"superseded")}>Supersede</RowAction>:<span className="text-[10px] text-subtle">Historical</span>}</div>
        </article>)}</div>
      </div>:<p className="py-8 text-center text-sm text-muted">No records match the current filters.</p>}
    </section>
    <section className="rounded-lg border border-border p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.16em]">Recent Master Data Audit</p><span className="text-xs text-muted">{audit.length} events</span></div><div className="mt-3 space-y-2">{audit.slice(0,8).map((e)=><div key={String(e.id)} className="flex flex-wrap gap-x-3 gap-y-1 rounded border border-border/60 px-3 py-2 text-xs"><span className="font-medium">{String(e.event_type)}</span><span className="text-muted">{String(e.actor_role)}</span><span>{e.from_status??"—"} → {e.to_status??"—"}</span><span className="ml-auto text-muted">{String(e.created_at)}</span></div>)}{!audit.length&&<p className="text-sm text-muted">No audit events yet.</p>}</div></section>
    <div className="rounded-lg border border-border bg-surface/30 p-4 text-xs text-muted"><strong className="text-fg">Operational rule:</strong> downstream transactions reference approved master-data revisions. Changes create a new revision rather than silently rewriting historical business state.</div>
  </div>;
}
function ListCell({label,children}:{label:string;children:React.ReactNode}){return <div className="col-start-2 flex min-w-0 items-baseline gap-2 text-xs lg:col-auto lg:block"><span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-subtle lg:hidden">{label}</span><span className="min-w-0 text-fg">{children}</span></div>;}
function RowAction({children,onClick,primary=false}:{children:React.ReactNode;onClick:()=>void;primary?:boolean}){return <button type="button" onClick={onClick} className={primary?"w-full rounded-md bg-accent px-3 py-2 text-xs font-semibold text-bg lg:w-auto lg:min-w-24":"w-full rounded-md border border-border px-3 py-2 text-xs font-semibold hover:border-accent lg:w-auto lg:min-w-24"}>{children}</button>;}
