import { createFileRoute } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { listQualityAuthority } from "@/lib/quality-authority";

type Row = Record<string, unknown>;
const text = (row: Row, ...keys: string[]) => { for (const key of keys) if (row[key] != null) return String(row[key]); return ""; };
const num = (row: Row, ...keys: string[]) => { for (const key of keys) if (row[key] != null) return Number(row[key]) || 0; return 0; };

export const Route = createFileRoute("/command/quality")({
  loader: () => listQualityAuthority(),
  component: Quality,
});

function Quality() {
  const data = Route.useLoaderData();
  const inspections = data.inspections as Row[];
  const ncrs = data.ncrs as Row[];
  const capas = data.capas as Row[];
  const releases = data.releases as Row[];
  const openNcr = ncrs.filter((row) => !["closed", "rejected"].includes(text(row, "status"))).length;
  const openCapa = capas.filter((row) => !["closed", "rejected"].includes(text(row, "status"))).length;
  const released = releases.filter((row) => text(row, "status") === "released").length;
  return <div className="space-y-6">
    <header className="border-b border-border pb-6"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Quality · canonical inspection/NCR/CAPA/release authority</p><h1 className="mt-1 font-display text-4xl text-accent">Quality & Failure Control</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">This surface now reads governed Quality records only. The legacy static QC/NCR/warranty arrays have been removed from the route binding.</p></header>
    <div className="grid gap-3 sm:grid-cols-4"><Kpi label="Inspections" value={String(inspections.length)} hint="Canonical inspection records"/><Kpi label="Open NCR" value={String(openNcr)} hint="Containment / CAPA" tone={openNcr ? "warn" : "ok"}/><Kpi label="Open CAPA" value={String(openCapa)} hint="Effectiveness pending" tone={openCapa ? "warn" : "ok"}/><Kpi label="Current releases" value={String(released)} hint="Serialized G10 evidence" tone={released ? "ok" : "warn"}/></div>
    <Panel title="Inspection Register" kicker="Incoming · in-process · final">{inspections.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3 text-left">Inspection</th><th className="px-3 py-3 text-left">Stage / type</th><th className="px-3 py-3 text-left">Lineage</th><th className="px-3 py-3 text-left">Result</th><th className="px-3 py-3 text-left">Disposition</th><th className="px-3 py-3 text-right">Defects</th></tr></thead><tbody>{inspections.map((row) => <tr key={text(row,"id")} className="border-t border-border/70"><td className="px-3 py-3 font-mono text-xs text-accent">{text(row,"id")}</td><td className="px-3 py-3"><p>{text(row,"inspection_stage","inspectionStage")}</p><p className="text-xs text-muted">{text(row,"inspection_type","inspectionType")}</p></td><td className="px-3 py-3 text-xs text-muted"><p>JC {text(row,"job_card_id","jobCardId") || "—"}</p><p>TRV {text(row,"traveller_id","travellerId") || "—"}</p><p>SKU {text(row,"sku") || "—"}</p></td><td className="px-3 py-3 font-semibold uppercase">{text(row,"result")}</td><td className="px-3 py-3">{text(row,"disposition")}</td><td className="px-3 py-3 text-right tabular-nums">{num(row,"defect_quantity","defectQuantity")}/{num(row,"sample_size","sampleSize")}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted">No canonical inspection record has been posted yet.</p>}</Panel>
    <div className="grid gap-4 lg:grid-cols-2"><Panel title="NCR Register" kicker="Non-conformance control">{ncrs.length ? <div className="space-y-2">{ncrs.map((row) => <div key={text(row,"id")} className="rounded-lg border border-border p-3"><div className="flex justify-between gap-3"><span className="font-semibold text-accent">{text(row,"id")}</span><span className="text-xs uppercase text-muted">{text(row,"severity")} · {text(row,"status")}</span></div><p className="mt-2 text-sm">{text(row,"description")}</p></div>)}</div> : <p className="text-sm text-muted">No NCR recorded.</p>}</Panel><Panel title="Serialized Release Register" kicker="Current release evidence">{releases.length ? <div className="space-y-2">{releases.map((row) => <div key={text(row,"id")} className="rounded-lg border border-border p-3"><div className="flex justify-between gap-3"><span className="font-mono text-xs text-accent">{text(row,"id")}</span><span className="text-xs font-semibold uppercase">{text(row,"status")}</span></div><p className="mt-2 text-xs text-muted">Traveller {text(row,"traveller_id","travellerId") || "—"} · serial {text(row,"serial_number","serialNumber") || "—"}</p></div>)}</div> : <p className="text-sm text-muted">No serialized Quality release recorded.</p>}</Panel></div>
    <p className="text-xs text-muted">Canonical authority: <code>vyndi_quality_inspections</code>, <code>vyndi_quality_ncrs</code>, <code>vyndi_quality_capas</code>, <code>vyndi_quality_releases</code>.</p>
  </div>;
}
