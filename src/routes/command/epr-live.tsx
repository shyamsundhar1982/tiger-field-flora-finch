import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardPlus, FilePlus2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kpi, Panel } from "@/components/kpi";
import { getEprSnapshot, createEprTraveller, recordEprEvidence, updateEprGate } from "@/lib/epr/execution";

export const Route = createFileRoute("/command/epr-live")({ component: LiveEpr });

type Snapshot = Awaited<ReturnType<typeof getEprSnapshot>>;

function LiveEpr() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ venture: "carbon", modelId: "core", modelName: "Longitude", sku: "VINDY-LONGITUDE-PILOT", bomRevision: "BOM-001", engineeringRevision: "VEDM-301-5.3.8", serialNumber: "", supplier: "" });
  const [evidence, setEvidence] = useState({ travellerId: "", gateId: "EPR-05", evidenceType: "process-record", title: "", reference: "", notes: "" });

  async function refresh() {
    try { setData(await getEprSnapshot()); } catch (error) { setMessage(error instanceof Error ? error.message : "Command access required."); }
  }
  useEffect(() => { void refresh(); }, []);

  async function create() {
    setBusy(true); setMessage("");
    try {
      if (!form.serialNumber.trim()) throw new Error("Serial number is required.");
      const result = await createEprTraveller({ data: { ...form, venture: form.venture as "carbon" | "aluminium", modelId: form.modelId as "core" | "pro" | "apex", modelName: form.modelName as "Longitude" | "Latitude" | "Altitude" } });
      setEvidence((v) => ({ ...v, travellerId: result.travellerId }));
      setForm((v) => ({ ...v, serialNumber: "" }));
      setMessage(`Traveller ${result.travellerId} created and EPR-04 opened.`);
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create traveller."); }
    finally { setBusy(false); }
  }

  async function gate(travellerId: string, venture: "carbon" | "aluminium", status: "in_progress" | "passed" | "blocked" | "hold" | "rework") {
    setBusy(true); setMessage("");
    try { await updateEprGate({ data: { travellerId, venture, gateId: evidence.gateId as any, status, reason: status === "passed" ? "Evidence reviewed by operator." : "Operator disposition." } }); setMessage(`${evidence.gateId} recorded as ${status}.`); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Gate transaction failed."); }
    finally { setBusy(false); }
  }

  async function addEvidence() {
    setBusy(true); setMessage("");
    try { if (!evidence.travellerId || !evidence.title) throw new Error("Traveller and evidence title are required."); await recordEprEvidence({ data: { ...evidence, venture: (data?.travellers.find((t) => t.id === evidence.travellerId)?.venture ?? "carbon") as "carbon" | "aluminium", gateId: evidence.gateId as any } }); setMessage("Evidence record committed to the EPR ledger."); setEvidence((v) => ({ ...v, title: "", reference: "", notes: "" })); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Evidence transaction failed."); }
    finally { setBusy(false); }
  }

  const travellers = data?.travellers ?? [];
  const evidenceRows = data?.evidence ?? [];
  const auditRows = data?.auditEvents ?? [];
  return <div className="space-y-6">
    <header className="rounded-2xl border border-border bg-bg-elevated/70 p-5"><div className="flex flex-wrap items-center justify-between gap-5"><div><p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Vāyú Shastr · VINDY · Production control</p><h1 className="mt-1 font-display text-4xl text-accent">Live EPR Transaction Core</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">Authenticated, venture-scoped durable transactions for pilot travellers, gate decisions, evidence and audit. This is the transactional layer beneath Phase 6A.</p></div><ShieldCheck className="size-12 text-accent" /></div></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Travellers" value={String(travellers.length)} hint="durable records"/><Kpi label="Evidence" value={String(evidenceRows.length)} hint="ledger records"/><Kpi label="Audit events" value={String(auditRows.length)} hint="append-only"/><Kpi label="Persistence" value={data ? "ONLINE" : "LOCKED"} tone={data ? "ok" : "danger"}/></div>
    <Panel title="Create controlled pilot traveller" kicker="EPR-04 · Pilot traveller release"><div className="grid gap-3 md:grid-cols-4">
      <select value={form.venture} onChange={e=>setForm({...form,venture:e.target.value})} className="rounded-md border border-border bg-bg px-3 py-2 text-sm"><option value="carbon">VINDY · Carbon</option><option value="aluminium">Aluminium Bicycle</option></select>
      <select value={form.modelId} onChange={e=>{const id=e.target.value;setForm({...form,modelId:id,modelName:id==="core"?"Longitude":id==="pro"?"Latitude":"Altitude"})}} className="rounded-md border border-border bg-bg px-3 py-2 text-sm"><option value="core">Longitude</option><option value="pro">Latitude</option><option value="apex">Altitude</option></select>
      <input value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})} placeholder="SKU" className="rounded-md border border-border bg-bg px-3 py-2 text-sm"/>
      <input value={form.serialNumber} onChange={e=>setForm({...form,serialNumber:e.target.value})} placeholder="Serial number *" className="rounded-md border border-border bg-bg px-3 py-2 text-sm"/>
      <input value={form.bomRevision} onChange={e=>setForm({...form,bomRevision:e.target.value})} placeholder="BOM revision" className="rounded-md border border-border bg-bg px-3 py-2 text-sm"/>
      <input value={form.engineeringRevision} onChange={e=>setForm({...form,engineeringRevision:e.target.value})} placeholder="Engineering revision" className="rounded-md border border-border bg-bg px-3 py-2 text-sm"/>
      <input value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})} placeholder="Supplier / OEM" className="rounded-md border border-border bg-bg px-3 py-2 text-sm"/>
      <Button disabled={busy} onClick={create}><ClipboardPlus /> Create traveller</Button>
    </div></Panel>
    <Panel title="Traveller register" kicker="Server-backed · venture scoped"><div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b border-border text-[10px] uppercase tracking-[0.12em] text-subtle"><tr><th className="p-3">Serial</th><th className="p-3">Model</th><th className="p-3">Venture</th><th className="p-3">SKU</th><th className="p-3">BOM</th><th className="p-3">Engineering</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{travellers.map((t:any)=><tr key={t.id} className="border-t border-border/70"><td className="p-3 font-semibold text-accent">{t.serial_number}</td><td className="p-3">{t.model_name}</td><td className="p-3">{t.venture}</td><td className="p-3">{t.sku}</td><td className="p-3">{t.bom_revision}</td><td className="p-3">{t.engineering_revision}</td><td className="p-3">{t.status}</td><td className="p-3"><div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={()=>{setEvidence({...evidence,travellerId:t.id});void gate(t.id,t.venture,"in_progress")}}>Start EPR-05 <ArrowRight /></Button><Button size="sm" disabled={busy} onClick={()=>{setEvidence({...evidence,travellerId:t.id});void gate(t.id,t.venture,"passed")}}><CheckCircle2 /> Pass</Button></div></td></tr>)}{travellers.length===0&&<tr><td colSpan={8} className="p-8 text-center text-muted">No travellers yet. Create the first controlled pilot unit above.</td></tr>}</tbody></table></div></Panel>
    <div className="grid gap-6 lg:grid-cols-2"><Panel title="Record evidence" kicker="Durable EPR evidence"><div className="space-y-3"><select value={evidence.travellerId} onChange={e=>setEvidence({...evidence,travellerId:e.target.value})} className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"><option value="">Select traveller</option>{travellers.map((t:any)=><option key={t.id} value={t.id}>{t.serial_number} · {t.model_name}</option>)}</select><select value={evidence.gateId} onChange={e=>setEvidence({...evidence,gateId:e.target.value})} className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm">{["EPR-05","EPR-06","EPR-07","EPR-08","EPR-09","EPR-10","EPR-11","EPR-12"].map(g=><option key={g}>{g}</option>)}</select><input value={evidence.evidenceType} onChange={e=>setEvidence({...evidence,evidenceType:e.target.value})} placeholder="Evidence type" className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"/><input value={evidence.title} onChange={e=>setEvidence({...evidence,title:e.target.value})} placeholder="Evidence title *" className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"/><input value={evidence.reference} onChange={e=>setEvidence({...evidence,reference:e.target.value})} placeholder="Document / file / test reference" className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"/><textarea value={evidence.notes} onChange={e=>setEvidence({...evidence,notes:e.target.value})} placeholder="Notes" className="min-h-24 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"/><Button disabled={busy} onClick={addEvidence}><FilePlus2 /> Commit evidence</Button></div></Panel>
    <Panel title="Recent audit ledger" kicker="Append-only event history"><div className="space-y-2">{auditRows.slice(0,12).map((a:any)=><div key={a.id} className="rounded-lg border border-border p-3"><div className="flex justify-between gap-3"><span className="font-semibold text-accent">{a.action}</span><span className="text-[10px] text-subtle">{a.actor}</span></div><p className="mt-1 text-xs text-muted">{a.entity_type} · {a.entity_id} · {a.venture}</p><p className="mt-1 text-[10px] text-subtle">{String(a.created_at)}</p></div>)}{auditRows.length===0&&<p className="text-sm text-muted">No audit events yet.</p>}</div></Panel></div>
    {message&&<div className="rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm text-fg">{message}</div>}
  </div>;
}
