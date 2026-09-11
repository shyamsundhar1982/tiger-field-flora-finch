import { createFileRoute } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { listCanonicalLegalAuthority } from "@/lib/finance-governance-authority";

type Row = Record<string, unknown>;
const text = (row: Row, ...keys: string[]) => { for (const key of keys) if (row[key] != null) return String(row[key]); return ""; };
const num = (row: Row, ...keys: string[]) => { for (const key of keys) if (row[key] != null) return Number(row[key]) || 0; return 0; };

export const Route = createFileRoute("/command/legal")({ loader: () => listCanonicalLegalAuthority(), component: Legal });

function Legal() {
  const register = Route.useLoaderData() as Row[];
  const critical = register.filter((row) => text(row,"priority") === "Critical" && !["filed","executed","active","closed"].includes(text(row,"status"))).length;
  const ip = register.filter((row) => text(row,"register_type","registerType") === "ip").length;
  const agreements = register.filter((row) => text(row,"register_type","registerType") === "agreement").length;
  const plannedCost = register.reduce((sum,row) => sum + num(row,"cost_lakh","costLakh"),0);
  return <div className="space-y-6">
    <header className="border-b border-border pb-6"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Governance · canonical legal/IP authority</p><h1 className="mt-1 font-display text-4xl text-accent">Legal & IP Register</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">IP filings, agreements, insurance and compliance obligations now come from the persisted Legal register. The previous static schedule is migrated as baseline evidence rather than remaining the page authority.</p></header>
    <div className="grid gap-3 sm:grid-cols-4"><Kpi label="Register items" value={String(register.length)} hint="Canonical obligations"/><Kpi label="IP items" value={String(ip)} hint="Patent / design / marks"/><Kpi label="Agreements" value={String(agreements)} hint="Controlled legal stack"/><Kpi label="Critical open" value={String(critical)} hint={`Baseline cost ₹${plannedCost.toFixed(2)}L`} tone={critical ? "warn" : "ok"}/></div>
    <Panel title="Canonical Legal / IP Register" kicker="Source-referenced lifecycle authority"><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3 text-left">Subject</th><th className="px-3 py-3 text-left">Type</th><th className="px-3 py-3 text-left">Instrument</th><th className="px-3 py-3 text-left">Timing</th><th className="px-3 py-3 text-left">Priority</th><th className="px-3 py-3 text-left">Status</th><th className="px-3 py-3 text-left">Evidence</th></tr></thead><tbody>{register.map((row) => <tr key={text(row,"id")} className="border-t border-border/70 align-top"><td className="px-3 py-3"><p className="font-semibold">{text(row,"subject")}</p><p className="font-mono text-[10px] text-muted">{text(row,"id")}</p></td><td className="px-3 py-3 uppercase">{text(row,"register_type","registerType")}</td><td className="px-3 py-3">{text(row,"instrument")}</td><td className="px-3 py-3 text-muted">{text(row,"target_timing","targetTiming") || "—"}</td><td className={text(row,"priority") === "Critical" ? "px-3 py-3 font-semibold text-warn" : "px-3 py-3"}>{text(row,"priority")}</td><td className="px-3 py-3 font-semibold uppercase">{text(row,"status")}</td><td className="px-3 py-3 text-xs text-muted">{text(row,"source_reference","sourceReference")}</td></tr>)}</tbody></table></div></Panel>
    <p className="text-xs text-muted">Canonical source: <code>vyndi_legal_register</code>. Governed lifecycle transitions append audit evidence through <code>src/lib/finance-governance-authority.ts</code>.</p>
  </div>;
}
