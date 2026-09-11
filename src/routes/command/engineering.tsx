import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { listEngineeringAuthority } from "@/lib/engineering-authority";

type Row = Record<string, unknown>;
const text = (row: Row, ...keys: string[]) => { for (const key of keys) if (row[key] != null) return String(row[key]); return ""; };

export const Route = createFileRoute("/command/engineering")({
  loader: () => listEngineeringAuthority(),
  component: Engineering,
});

function Engineering() {
  const data = Route.useLoaderData();
  const baselines = data.baselines as Row[];
  const changes = data.changes as Row[];
  const released = baselines.filter((row) => text(row, "status") === "released").length;
  const openChanges = changes.filter((row) => !["implemented", "rejected"].includes(text(row, "status"))).length;
  return <div className="space-y-6">
    <header className="border-b border-border pb-6"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Engineering · canonical baseline & ECR authority</p><h1 className="mt-1 font-display text-4xl text-accent">Engineering</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">Released baselines and engineering changes are loaded from the governed Engineering authority. Legacy in-page revision arrays are no longer a competing source of truth.</p><div className="mt-3 flex gap-3 text-sm font-semibold"><Link to="/command/product" className="text-accent">Product register →</Link><Link to="/command/bom-control" className="text-accent">BOM control →</Link></div></header>
    <div className="grid gap-3 sm:grid-cols-4"><Kpi label="Baselines" value={String(baselines.length)} hint="Canonical records"/><Kpi label="Released" value={String(released)} hint="G04 release evidence" tone={released ? "ok" : "warn"}/><Kpi label="ECRs" value={String(changes.length)} hint="Controlled change requests"/><Kpi label="Open change" value={String(openChanges)} hint="Requires lifecycle action" tone={openChanges ? "warn" : "ok"}/></div>
    <Panel title="Engineering Baseline Register" kicker="Geometry · material · tooling · drawing · BOM"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3 text-left">Family / variant</th><th className="px-3 py-3 text-left">Revision</th><th className="px-3 py-3 text-left">Geometry / material</th><th className="px-3 py-3 text-left">Tooling</th><th className="px-3 py-3 text-left">Drawing / BOM</th><th className="px-3 py-3 text-left">Status</th></tr></thead><tbody>{baselines.map((row) => <tr key={text(row,"id")} className="border-t border-border/70 align-top"><td className="px-3 py-3"><p className="font-semibold">{text(row,"family_name","familyName","family_code")}</p><p className="text-[10px] text-muted">{text(row,"variant_name","variantName","variant_id") || "Family baseline"}</p></td><td className="px-3 py-3 font-semibold text-accent">{text(row,"revision_code","revisionCode")}</td><td className="px-3 py-3 text-muted"><p>{text(row,"geometry_ref","geometryRef")}</p><p className="mt-1 text-xs">{text(row,"material_spec","materialSpec")}</p></td><td className="px-3 py-3 text-muted">{text(row,"tooling_ref","toolingRef") || "—"}</td><td className="px-3 py-3 text-muted"><p>{text(row,"drawing_ref","drawingRef")}</p><p className="mt-1 text-xs">BOM {text(row,"bom_revision","bomRevision") || "—"}</p></td><td className="px-3 py-3 font-semibold uppercase text-green">{text(row,"status")}</td></tr>)}</tbody></table></div></Panel>
    <Panel title="Engineering Change Requests" kicker="Attributable controlled lifecycle">{changes.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3 text-left">ECR</th><th className="px-3 py-3 text-left">Family</th><th className="px-3 py-3 text-left">Target</th><th className="px-3 py-3 text-left">Reason</th><th className="px-3 py-3 text-left">Status</th></tr></thead><tbody>{changes.map((row) => <tr key={text(row,"id")} className="border-t border-border/70"><td className="px-3 py-3 font-mono text-xs text-accent">{text(row,"id")}</td><td className="px-3 py-3">{text(row,"family_name","familyName","family_code")}</td><td className="px-3 py-3">{text(row,"target_revision_code","targetRevisionCode")}</td><td className="px-3 py-3 text-muted">{text(row,"reason")}</td><td className="px-3 py-3 font-semibold uppercase">{text(row,"status")}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted">No Engineering change request is currently recorded.</p>}</Panel>
    <p className="text-xs text-muted">Canonical authority: <code>vyndi_engineering_baselines</code> + <code>vyndi_engineering_change_requests</code>.</p>
  </div>;
}
